"""
Central configuration — reads from environment variables or .env file.

Copy .env.example to .env and adjust before running:
    cp .env.example .env
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Server ────────────────────────────────────────────────────────────
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8777)
    debug: bool = Field(default=False)

    # ── Iotvex home control ───────────────────────────────────────────────
    # Primary smart-home server (www)
    iotvex_www_url: str = Field(default="http://127.0.0.1")
    # Optional direct agent URL (used when set, falls back to www)
    iotvex_agent_url: Optional[str] = Field(default=None)
    # Service / API token sent as Bearer header
    iotvex_token: Optional[str] = Field(default=None)
    # HTTP request timeout in seconds
    home_timeout: float = Field(default=5.0)

    # ── TTS ───────────────────────────────────────────────────────────────
    # edge-tts: Emma Multilingual (female, speaks Russian; different from Svetlana)
    tts_voice_ru: str = Field(default="en-US-EmmaMultilingualNeural")
    # edge-tts voice for English replies
    tts_voice_en: str = Field(default="en-US-AriaNeural")
    # Include base64 audio in every /v1/text response?
    tts_include_audio: bool = Field(default=True)
    # Audio output format: mp3 | wav
    tts_format: str = Field(default="mp3")

    # ── STT ───────────────────────────────────────────────────────────────
    # "stub" | "whisper" | "vosk"
    stt_backend: str = Field(default="stub")
    # Whisper model size: tiny | base | small | medium | large
    whisper_model: str = Field(default="base")

    # ── LLM (optional) ────────────────────────────────────────────────────
    llm_enabled: bool = Field(default=False)
    # Ollama base URL
    ollama_url: str = Field(default="http://localhost:11434")
    # Model tag available in ollama
    ollama_model: str = Field(default="gemma2:2b")
    # Use LLM only when rule-based NLU confidence is below this threshold
    llm_confidence_threshold: float = Field(default=0.55)

    # ── Wake word ─────────────────────────────────────────────────────────
    # Canonical wake word displayed to users
    wake_word: str = Field(default="Alexa / Света")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
