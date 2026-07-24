"""
Iotvex Assistant — FastAPI server
Wake word: Alexa / Алекса

Endpoints:
  GET  /health            → system health + TTS/STT status
  POST /v1/text           → text command → intent + reply + optional audio
  POST /v1/audio          → audio upload → STT → same as text
  GET  /v1/voices         → list available TTS voices
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from typing import Annotated, Optional

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app import tts, stt, llm, voice
from app.config import get_settings
from app import __version__

# ─────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("iotvex.assistant")

_startup_time = time.time()


# ─────────────────────────────────────────────
# Lifespan (startup / shutdown)
# ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("═══════════════════════════════════════════")
    logger.info("  Iotvex Assistant  v%s", __version__)
    logger.info("  Wake word : %s / Алекса", settings.wake_word)
    logger.info("  TTS voice : %s", settings.tts_voice_ru)
    logger.info("  STT       : %s", settings.stt_backend)
    logger.info("  LLM       : %s", "enabled" if settings.llm_enabled else "disabled")
    logger.info("  Home URL  : %s", settings.iotvex_www_url)
    logger.info("═══════════════════════════════════════════")
    yield
    logger.info("Iotvex Assistant shutting down.")


# ─────────────────────────────────────────────
# App
# ─────────────────────────────────────────────

app = FastAPI(
    title="Iotvex Assistant",
    description=(
        "Voice assistant for Iotvex smart home. "
        "Wake word: Alexa / Алекса. Russian female TTS, RU+EN NLU."
    ),
    version=__version__,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────

class TextRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2048,
                       example="Алекса, включи свет")
    include_audio: Optional[bool] = Field(
        default=None,
        description="Override global tts_include_audio setting for this request.",
    )


class AssistantResponse(BaseModel):
    reply: str
    intent: str
    confidence: float
    lang: str
    entities: dict
    actions: list[dict]
    audio_b64: Optional[str] = None
    stt_text: Optional[str] = None
    error: Optional[str] = None


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health():
    """Returns service health, uptime, and capability status."""
    settings = get_settings()
    uptime = round(time.time() - _startup_time, 1)

    tts_status = await tts.verify_tts("Тест.")
    stt_info = stt.backend_info()
    llm_info = await llm.check_available()

    return {
        "status": "ok",
        "version": __version__,
        "uptime_seconds": uptime,
        "wake_word": settings.wake_word,
        "tts": tts_status,
        "stt": stt_info,
        "llm": llm_info,
        "home": {
            "www_url": settings.iotvex_www_url,
            "agent_url": settings.iotvex_agent_url,
            "token_set": bool(settings.iotvex_token),
        },
    }


@app.post("/v1/text", response_model=AssistantResponse, tags=["Assistant"])
async def text_command(req: TextRequest):
    """
    Send a text command (with or without the wake word).

    Examples:
    - "Алекса, включи левую ленту"
    - "Alexa set brightness to 60%"
    - "Алекса, красный цвет"
    - "Alexa rainbow effect"
    """
    result = await voice.process_text(req.text, include_audio=req.include_audio)
    return AssistantResponse(
        reply=result.reply,
        intent=result.intent,
        confidence=result.confidence,
        lang=result.lang,
        entities=result.entities,
        actions=result.actions,
        audio_b64=result.audio_b64,
        error=result.error,
    )


@app.post("/v1/audio", response_model=AssistantResponse, tags=["Assistant"])
async def audio_command(
    audio: UploadFile = File(..., description="Audio file: wav, webm, ogg, mp3"),
    include_audio: Optional[bool] = Form(default=None),
):
    """
    Send an audio file to be transcribed and processed.

    Requires STT_BACKEND != 'stub' (set STT_BACKEND=whisper and install openai-whisper).
    Returns the same shape as /v1/text, plus `stt_text` with the transcription.
    """
    audio_bytes = await audio.read()
    mime = audio.content_type or "audio/wav"

    result = await voice.process_audio(audio_bytes, mime_type=mime, include_audio=include_audio)
    return AssistantResponse(
        reply=result.reply,
        intent=result.intent,
        confidence=result.confidence,
        lang=result.lang,
        entities=result.entities,
        actions=result.actions,
        audio_b64=result.audio_b64,
        stt_text=result.stt_text,
        error=result.error,
    )


@app.get("/v1/voices", tags=["TTS"])
async def voices():
    """List available TTS voices."""
    settings = get_settings()
    return {
        "voices": tts.list_voices(),
        "current_ru": settings.tts_voice_ru,
        "current_en": settings.tts_voice_en,
    }


# ─────────────────────────────────────────────
# Entry point for direct execution
# ─────────────────────────────────────────────

def start():
    import uvicorn
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="debug" if settings.debug else "info",
    )


if __name__ == "__main__":
    start()
