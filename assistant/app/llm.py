"""
Optional local LLM hook via Ollama.

Disabled by default (LLM_ENABLED=false).

When enabled, the LLM is called in two situations:
  1. Rule-based NLU returns intent="unknown" or confidence < threshold
  2. To generate a more natural-sounding reply in the detected language

Setup:
    # Install Ollama: https://ollama.com/download
    ollama serve          # starts the server on port 11434
    ollama pull gemma2:2b  # or mistral, llama3.2, etc.
    # Then set in .env:
    LLM_ENABLED=true
    OLLAMA_MODEL=gemma2:2b

The LLM prompt asks Ollama to return a structured JSON object with intent / entities
so we can reuse the same homecontrol pipeline.  Plain-text replies are also supported.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


_SYSTEM_PROMPT = """\
You are Alexa, a helpful Russian-English voice assistant for smart home control.
The user may speak Russian or English.

Available intents:
  lights_on, lights_off, set_brightness, set_color, set_effect, greeting, help, status, unknown

Available strip targets: left, right, all (default: all)
Available effects: rainbow, breathing, pulse, chase, fire, solid, blink, twinkle

When you understand the user's intent, respond ONLY with a valid JSON object (no markdown):
{
  "intent": "<intent_name>",
  "entities": {
    "target": "all" | "left" | "right",
    "brightness": <0-100 integer, only for set_brightness>,
    "color_hex": "<#RRGGBB, only for set_color>",
    "color_name": "<human name, only for set_color>",
    "effect": "<effect name, only for set_effect>"
  },
  "reply": "<short spoken reply in the same language as the user>"
}

If you cannot determine the intent, use intent="unknown" and explain in the reply field.
Keep the reply short (1-2 sentences) and friendly.
"""


async def enhance_intent(
    text: str,
    lang: str = "ru",
    current_intent: Optional[str] = None,
) -> dict[str, Any]:
    """
    Call Ollama to determine (or refine) intent + entities + reply.

    Returns a dict with keys: intent, entities, reply
    or an empty dict if LLM is disabled or call fails.
    """
    settings = get_settings()

    if not settings.llm_enabled:
        return {}

    url = f"{settings.ollama_url.rstrip('/')}/api/chat"
    payload = {
        "model": settings.ollama_model,
        "stream": False,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
    except httpx.ConnectError:
        logger.warning("LLM: Cannot connect to Ollama at %s", settings.ollama_url)
        return {}
    except Exception as exc:
        logger.warning("LLM call failed: %s", exc)
        return {}

    raw = data.get("message", {}).get("content", "").strip()
    logger.debug("LLM raw response: %r", raw)

    # Strip potential markdown code fences
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    try:
        parsed = json.loads(raw)
        return {
            "intent": parsed.get("intent", "unknown"),
            "entities": parsed.get("entities", {}),
            "reply": parsed.get("reply", ""),
        }
    except json.JSONDecodeError:
        # LLM returned plain text — treat as a helpful reply with unknown intent
        return {
            "intent": "unknown",
            "entities": {},
            "reply": raw[:300],
        }


async def check_available() -> dict:
    """Test connectivity to Ollama server."""
    settings = get_settings()
    if not settings.llm_enabled:
        return {"enabled": False}

    url = f"{settings.ollama_url.rstrip('/')}/api/tags"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url)
            models = [m["name"] for m in resp.json().get("models", [])]
            return {
                "enabled": True,
                "available": True,
                "models": models,
                "configured_model": settings.ollama_model,
            }
    except Exception as exc:
        return {"enabled": True, "available": False, "error": str(exc)}
