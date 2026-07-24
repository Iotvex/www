"""
Speech-to-Text module.

Backend selection (STT_BACKEND env var):
  stub    — returns an error explaining Whisper is not installed (default / safe)
  whisper — OpenAI Whisper (local model, pip install openai-whisper)
  vosk    — Vosk offline engine  (pip install vosk, download model)

For /v1/audio endpoint, the server accepts multipart audio (wav, webm, ogg, mp3).

Whisper install:
    pip install openai-whisper
    # first transcription downloads the model automatically

Vosk install + model (Russian):
    pip install vosk
    wget https://alphacephei.com/vosk/models/vosk-model-ru-0.42.zip
    unzip vosk-model-ru-0.42.zip -d models/
    # Set env: VOSK_MODEL_PATH=models/vosk-model-ru-0.42
"""

from __future__ import annotations

import io
import logging
import os
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Whisper backend
# ─────────────────────────────────────────────

_whisper_model = None  # lazy-loaded


def _load_whisper():
    global _whisper_model
    if _whisper_model is None:
        import whisper  # noqa: PLC0415
        model_name = get_settings().whisper_model
        logger.info("Loading Whisper model: %s …", model_name)
        _whisper_model = whisper.load_model(model_name)
        logger.info("Whisper model loaded.")
    return _whisper_model


def _transcribe_whisper(audio_bytes: bytes, mime_type: str = "audio/wav") -> str:
    import tempfile  # noqa: PLC0415
    import numpy as np  # noqa: PLC0415

    model = _load_whisper()

    # Write to temp file because whisper.load_audio expects a path
    suffix = ".wav"
    if "webm" in mime_type:
        suffix = ".webm"
    elif "mp3" in mime_type or "mpeg" in mime_type:
        suffix = ".mp3"
    elif "ogg" in mime_type:
        suffix = ".ogg"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name

    try:
        result = model.transcribe(tmp_path, language=None)  # auto-detect
        text = result["text"].strip()
        logger.debug("Whisper transcript: %r", text)
        return text
    finally:
        os.unlink(tmp_path)


# ─────────────────────────────────────────────
# Vosk backend
# ─────────────────────────────────────────────

_vosk_recognizer = None


def _load_vosk():
    global _vosk_recognizer
    if _vosk_recognizer is None:
        from vosk import Model, KaldiRecognizer  # noqa: PLC0415
        model_path = os.environ.get("VOSK_MODEL_PATH", "models/vosk-model-ru-0.42")
        if not os.path.isdir(model_path):
            raise FileNotFoundError(
                f"Vosk model not found at {model_path!r}. "
                "Download from https://alphacephei.com/vosk/models"
            )
        logger.info("Loading Vosk model from %s …", model_path)
        vmodel = Model(model_path)
        _vosk_recognizer = KaldiRecognizer(vmodel, 16000)
        logger.info("Vosk model loaded.")
    return _vosk_recognizer


def _transcribe_vosk(audio_bytes: bytes) -> str:
    import json  # noqa: PLC0415
    # Vosk requires raw 16-bit PCM @ 16 kHz mono
    # If the input is not raw PCM we attempt a basic conversion via soundfile/pydub
    try:
        import soundfile as sf  # noqa: PLC0415
        buf = io.BytesIO(audio_bytes)
        data, samplerate = sf.read(buf, dtype="int16")
        if len(data.shape) > 1:
            data = data[:, 0]  # mono
        if samplerate != 16000:
            # Basic resampling via scipy if available
            try:
                from scipy.signal import resample  # noqa: PLC0415
                new_len = int(len(data) * 16000 / samplerate)
                data = resample(data, new_len).astype("int16")
            except ImportError:
                pass  # try anyway
        pcm = data.tobytes()
    except Exception:
        # Last resort: assume already raw PCM
        pcm = audio_bytes

    rec = _load_vosk()
    rec.AcceptWaveform(pcm)
    result = json.loads(rec.FinalResult())
    text = result.get("text", "").strip()
    logger.debug("Vosk transcript: %r", text)
    return text


# ─────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────

class STTError(Exception):
    """Raised when STT is not available or fails."""


async def transcribe(audio_bytes: bytes, mime_type: str = "audio/wav") -> str:
    """
    Transcribe audio bytes to text.

    Returns the transcription string.
    Raises STTError if the backend is unavailable or transcription fails.
    """
    backend = get_settings().stt_backend.lower()

    if backend == "stub":
        raise STTError(
            "STT backend is 'stub' — install Whisper and set STT_BACKEND=whisper, "
            "or use the POST /v1/text endpoint with plain text instead."
        )

    if backend == "whisper":
        try:
            import asyncio  # noqa: PLC0415
            loop = asyncio.get_event_loop()
            text = await loop.run_in_executor(None, _transcribe_whisper, audio_bytes, mime_type)
            return text
        except ImportError as exc:
            raise STTError(
                "Whisper not installed. Run: pip install openai-whisper"
            ) from exc
        except Exception as exc:
            raise STTError(f"Whisper transcription failed: {exc}") from exc

    if backend == "vosk":
        try:
            import asyncio  # noqa: PLC0415
            loop = asyncio.get_event_loop()
            text = await loop.run_in_executor(None, _transcribe_vosk, audio_bytes)
            return text
        except ImportError as exc:
            raise STTError("Vosk not installed. Run: pip install vosk") from exc
        except FileNotFoundError as exc:
            raise STTError(str(exc)) from exc
        except Exception as exc:
            raise STTError(f"Vosk transcription failed: {exc}") from exc

    raise STTError(f"Unknown STT backend: {backend!r}. Use stub / whisper / vosk.")


def backend_info() -> dict:
    settings = get_settings()
    backend = settings.stt_backend
    available = False

    if backend == "stub":
        available = False
    elif backend == "whisper":
        try:
            import whisper  # noqa: F401, PLC0415
            available = True
        except ImportError:
            available = False
    elif backend == "vosk":
        try:
            import vosk  # noqa: F401, PLC0415
            available = True
        except ImportError:
            available = False

    return {
        "backend": backend,
        "available": available,
        "note": (
            "Install openai-whisper and set STT_BACKEND=whisper to enable audio input."
            if not available else None
        ),
    }
