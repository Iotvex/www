"""
Voice pipeline — orchestrates the full request lifecycle:

  text or audio
       ↓
  [STT if audio]
       ↓
  NLU  (intent + entities + lang)
       ↓
  [LLM enhance if enabled & low confidence]
       ↓
  Home action  (async HTTP to Iotvex)
       ↓
  Generate reply text  (Russian by default)
       ↓
  [TTS → MP3 bytes → base64]
       ↓
  Return PipelineResult
"""

from __future__ import annotations

import asyncio
import base64
import logging
from dataclasses import dataclass, field
from typing import Any, Optional

from app import nlu, tts, home, llm, stt
from app.config import get_settings

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Reply templates (Russian + English)
# ─────────────────────────────────────────────

_REPLIES_RU: dict[str, str] = {
    "lights_on":       "Хорошо, включаю свет{target_suffix}!",
    "lights_off":      "Выключаю свет{target_suffix}.",
    "set_brightness":  "Устанавливаю яркость{target_suffix} на {brightness}%.",
    "set_color":       "Меняю цвет{target_suffix} на {color_name}.",
    "set_effect":      "Включаю эффект «{effect}»{target_suffix}.",
    "greeting":        "Привет! Я Алекса, ваш умный помощник. Чем могу помочь?",
    "help":            (
        "Я умею: включать и выключать свет, менять яркость (например «яркость 70%»), "
        "цвет (красный, синий, тёплый белый…) и эффекты (радуга, дыхание, огонь…). "
        "Просто скажите «Алекса» и команду!"
    ),
    "status":          "Система работает. Все сервисы в норме.",
    "unknown":         "Извините, я не поняла команду. Скажите «Алекса, помощь», чтобы узнать, что я умею.",
}

_REPLIES_EN: dict[str, str] = {
    "lights_on":       "Sure, turning on the lights{target_suffix}!",
    "lights_off":      "Turning off the lights{target_suffix}.",
    "set_brightness":  "Setting brightness{target_suffix} to {brightness}%.",
    "set_color":       "Changing the color{target_suffix} to {color_name}.",
    "set_effect":      "Setting effect to {effect}{target_suffix}.",
    "greeting":        "Hi there! I'm Alexa, your smart home assistant. How can I help?",
    "help":            (
        "I can: turn lights on or off, set brightness (e.g. 'brightness 70%'), "
        "color (red, blue, warm white…), and effects (rainbow, breathing, fire…). "
        "Just say 'Alexa' followed by a command!"
    ),
    "status":          "System is running. All services are healthy.",
    "unknown":         "Sorry, I didn't understand that. Say 'Alexa help' to see what I can do.",
}


def _target_suffix(target: str, lang: str) -> str:
    if target == "all":
        return ""
    if lang == "ru":
        return " (левую ленту)" if target == "left" else " (правую ленту)"
    return " (left strip)" if target == "left" else " (right strip)"


def _format_reply(intent: str, entities: dict, lang: str) -> str:
    templates = _REPLIES_RU if lang == "ru" else _REPLIES_EN
    template = templates.get(intent, templates["unknown"])
    target = entities.get("target", "all")
    try:
        return template.format(
            target_suffix=_target_suffix(target, lang),
            brightness=entities.get("brightness", "?"),
            color_name=entities.get("color_name", entities.get("color_hex", "?")),
            effect=entities.get("effect", "?"),
        )
    except KeyError:
        return templates.get("unknown", "?")


# ─────────────────────────────────────────────
# Pipeline result
# ─────────────────────────────────────────────

@dataclass
class PipelineResult:
    reply: str
    intent: str
    confidence: float
    lang: str
    entities: dict[str, Any]
    actions: list[dict[str, Any]] = field(default_factory=list)
    audio_b64: Optional[str] = None
    stt_text: Optional[str] = None   # set when input was audio
    error: Optional[str] = None


# ─────────────────────────────────────────────
# Home action dispatcher
# ─────────────────────────────────────────────

async def _execute_home_action(intent: nlu.Intent) -> list[dict]:
    """
    Call the appropriate home.py function based on intent.
    Returns a list of action-result dicts for the API response.
    """
    ent = intent.entities
    strip = ent.get("target", "all")
    results = []

    try:
        if intent.name == "lights_on":
            r = await home.lights_on(strip=strip)
            results.append({"action": "lights_on", "strip": strip, "success": r.success, "backend": r.backend})

        elif intent.name == "lights_off":
            r = await home.lights_off(strip=strip)
            results.append({"action": "lights_off", "strip": strip, "success": r.success, "backend": r.backend})

        elif intent.name == "set_brightness":
            value = ent.get("brightness")
            relative = ent.get("relative")
            if value is not None:
                r = await home.set_brightness(value, strip=strip)
                results.append({"action": "set_brightness", "strip": strip, "value": value,
                                 "success": r.success, "backend": r.backend})
            elif relative is not None:
                # Approximate relative step from current strip brightness (percent).
                strips = await home.list_strips()
                picked = home._pick_strips(strips, strip)  # noqa: SLF001
                current_pct = 50
                if picked:
                    bri = int(picked[0].get("brightness") or 128)
                    current_pct = max(0, min(100, round(bri * 100 / 255)))
                value = max(0, min(100, current_pct + int(relative)))
                r = await home.set_brightness(value, strip=strip)
                results.append({
                    "action": "set_brightness",
                    "strip": strip,
                    "value": value,
                    "relative": relative,
                    "success": r.success,
                    "backend": r.backend,
                })

        elif intent.name == "set_color":
            hex_val = ent.get("color_hex", "#FFFFFF")
            r = await home.set_color(hex_val, strip=strip)
            results.append({"action": "set_color", "strip": strip, "color": hex_val,
                             "success": r.success, "backend": r.backend})

        elif intent.name == "set_effect":
            effect = ent.get("effect", "solid")
            r = await home.set_effect(effect, strip=strip)
            results.append({"action": "set_effect", "strip": strip, "effect": effect,
                             "success": r.success, "backend": r.backend})

    except Exception as exc:
        logger.error("Home action error (intent=%s): %s", intent.name, exc)
        results.append({"action": intent.name, "success": False, "error": str(exc)})

    return results


# ─────────────────────────────────────────────
# Main pipeline
# ─────────────────────────────────────────────

async def process_text(text: str, include_audio: Optional[bool] = None) -> PipelineResult:
    """
    Full pipeline for text input.
    """
    settings = get_settings()
    if include_audio is None:
        include_audio = settings.tts_include_audio

    # 1. NLU
    intent = nlu.parse(text)
    logger.info("NLU: text=%r intent=%s conf=%.2f entities=%s",
                text, intent.name, intent.confidence, intent.entities)

    # 2. Optional LLM enhancement
    if settings.llm_enabled and intent.confidence < settings.llm_confidence_threshold:
        logger.debug("Confidence %.2f below threshold %.2f — querying LLM",
                     intent.confidence, settings.llm_confidence_threshold)
        llm_result = await llm.enhance_intent(intent.cleaned_text or text, lang=intent.lang,
                                               current_intent=intent.name)
        if llm_result.get("intent") and llm_result["intent"] != "unknown":
            # Merge LLM entities into intent
            intent.name = llm_result["intent"]
            intent.entities.update(llm_result.get("entities") or {})
            intent.confidence = 0.75  # trusted enough after LLM pass
            logger.info("LLM override: intent=%s", intent.name)

    # 3. Execute home action (fire-and-forget style, don't block reply on failure)
    action_list: list[dict] = []
    if intent.name in ("lights_on", "lights_off", "set_brightness", "set_color", "set_effect"):
        action_list = await _execute_home_action(intent)

    # 4. Build reply text
    # Check if LLM provided a custom reply
    llm_reply = ""
    if settings.llm_enabled and intent.confidence >= settings.llm_confidence_threshold:
        # Could still ask LLM for a natural reply — skip for performance
        pass

    reply_text = _format_reply(intent.name, intent.entities, intent.lang)

    # 5. TTS
    audio_b64: Optional[str] = None
    if include_audio:
        audio_bytes = await tts.synthesize(reply_text, lang=intent.lang)
        if audio_bytes:
            audio_b64 = base64.b64encode(audio_bytes).decode()

    return PipelineResult(
        reply=reply_text,
        intent=intent.name,
        confidence=intent.confidence,
        lang=intent.lang,
        entities=intent.entities,
        actions=action_list,
        audio_b64=audio_b64,
    )


async def process_audio(
    audio_bytes: bytes,
    mime_type: str = "audio/wav",
    include_audio: Optional[bool] = None,
) -> PipelineResult:
    """
    Full pipeline for audio input (STT → text → process_text).
    """
    try:
        text = await stt.transcribe(audio_bytes, mime_type=mime_type)
    except stt.STTError as exc:
        reply = str(exc)
        audio_b64 = None
        if get_settings().tts_include_audio:
            audio_bytes_reply = await tts.synthesize(
                "Распознавание речи недоступно. Используйте текстовый ввод.",
                lang="ru",
            )
            if audio_bytes_reply:
                audio_b64 = base64.b64encode(audio_bytes_reply).decode()
        return PipelineResult(
            reply=reply,
            intent="error",
            confidence=0.0,
            lang="ru",
            entities={},
            error=str(exc),
            audio_b64=audio_b64,
        )

    result = await process_text(text, include_audio=include_audio)
    result.stt_text = text
    return result
