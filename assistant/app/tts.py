"""
Text-to-Speech module.

Primary backend  : edge-tts (Microsoft Neural TTS, online)
                   Russian: en-US-EmmaMultilingualNeural (female, multilingual)
                   English: en-US-AriaNeural
Fallback backend : gTTS (Google TTS, online, lower quality)
Final fallback   : returns None (silent mode)

Usage:
    from app.tts import synthesize, list_voices
    audio_bytes = await synthesize("Привет!", lang="ru")
"""

from __future__ import annotations

import asyncio
import io
import logging
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Voice catalogue (subset — the good ones)
# ─────────────────────────────────────────────

VOICES_RU: list[dict] = [
    {"name": "en-US-EmmaMultilingualNeural", "gender": "Female", "lang": "ru", "quality": "neural", "default": True},
    {"name": "ru-RU-SvetlanaNeural", "gender": "Female", "lang": "ru", "quality": "neural"},
    {"name": "ru-RU-DmitryNeural",   "gender": "Male",   "lang": "ru", "quality": "neural"},
]

VOICES_EN: list[dict] = [
    {"name": "en-US-AriaNeural",     "gender": "Female", "lang": "en", "quality": "neural", "default": True},
    {"name": "en-US-JennyNeural",    "gender": "Female", "lang": "en", "quality": "neural"},
    {"name": "en-US-GuyNeural",      "gender": "Male",   "lang": "en", "quality": "neural"},
]

ALL_VOICES = VOICES_RU + VOICES_EN


# ─────────────────────────────────────────────
# edge-tts synthesizer
# ─────────────────────────────────────────────

async def _synthesize_edge_tts(text: str, voice: str) -> bytes:
    """Stream audio bytes from edge-tts for the given voice."""
    try:
        import edge_tts  # noqa: PLC0415
    except ImportError as exc:
        raise RuntimeError(
            "edge-tts not installed. Run: pip install edge-tts"
        ) from exc

    audio_chunks: list[bytes] = []
    communicate = edge_tts.Communicate(text, voice)
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_chunks.append(chunk["data"])

    if not audio_chunks:
        raise RuntimeError(f"edge-tts returned no audio for voice={voice!r}")

    return b"".join(audio_chunks)


# ─────────────────────────────────────────────
# gTTS fallback synthesizer
# ─────────────────────────────────────────────

def _synthesize_gtts(text: str, lang: str) -> bytes:
    try:
        from gtts import gTTS  # noqa: PLC0415
    except ImportError as exc:
        raise RuntimeError(
            "gTTS not installed. Run: pip install gTTS"
        ) from exc

    buf = io.BytesIO()
    tts = gTTS(text=text, lang=lang)
    tts.write_to_fp(buf)
    buf.seek(0)
    return buf.read()


# ─────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────

async def synthesize(text: str, lang: str = "ru") -> Optional[bytes]:
    """
    Synthesize speech and return MP3 bytes.

    Args:
        text: The string to speak.
        lang: "ru" or "en" — selects the configured voice.

    Returns:
        bytes (MP3) on success, None if all backends fail.
    """
    settings = get_settings()
    voice = settings.tts_voice_ru if lang == "ru" else settings.tts_voice_en

    # 1. Try edge-tts
    try:
        audio = await _synthesize_edge_tts(text, voice)
        logger.debug("TTS via edge-tts OK, voice=%s, len=%d", voice, len(audio))
        return audio
    except Exception as exc:
        logger.warning("edge-tts failed (%s), trying gTTS fallback", exc)

    # 2. Try gTTS
    try:
        loop = asyncio.get_event_loop()
        audio = await loop.run_in_executor(None, _synthesize_gtts, text, lang)
        logger.debug("TTS via gTTS OK, lang=%s, len=%d", lang, len(audio))
        return audio
    except Exception as exc:
        logger.error("gTTS fallback also failed: %s", exc)

    return None


def list_voices() -> list[dict]:
    """Return the catalogue of supported voices."""
    return ALL_VOICES


async def verify_tts(text: str = "Привет! Я Алекса, твой умный помощник.") -> dict:
    """
    Quick smoke-test — synthesize a phrase and return stats.
    Called from /health or startup.
    """
    try:
        audio = await synthesize(text, lang="ru")
        if audio:
            return {"ok": True, "bytes": len(audio), "voice": get_settings().tts_voice_ru}
        return {"ok": False, "error": "synthesis returned None"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
