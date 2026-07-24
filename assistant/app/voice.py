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
    "lights_on":       "Готово. Включила свет{target_suffix}.",
    "lights_off":      "Готово. Выключила свет{target_suffix}.",
    "toggle":          "Готово. Переключила свет{target_suffix}.",
    "set_brightness":  "Готово. Поставила яркость{target_suffix} на {brightness} процентов.",
    "set_color":       "Готово. Поставила цвет{target_suffix}: {color_name}.",
    "set_effect":      "Готово. Включила эффект «{effect}»{target_suffix}.",
    "set_speed":       "Готово. Поставила скорость{target_suffix} на {speed} процентов.",
    "activate_scene":  "Готово. Активировала сцену{detail_suffix}.",
    "run_automation":  "Готово. Запустила автоматизацию{detail_suffix}.",
    "run_script":      "Готово. Запустила скрипт{detail_suffix}.",
    "greeting":        "На связи. Чем помочь?",
    "help":            (
        "Могу включать и выключать свет, менять яркость, цвет и эффекты, "
        "запускать сцены и правила. Скажите «Алекса» или «Света» и команду."
    ),
    "status":          "Я на связи, умный дом отвечает.",
    "unknown":         "Не поняла. Например: «Света, яркость 100» или «Алекса, сделай радугу».",
}

_REPLIES_EN: dict[str, str] = {
    "lights_on":       "Done. I turned the lights on{target_suffix}.",
    "lights_off":      "Done. I turned the lights off{target_suffix}.",
    "toggle":          "Done. I toggled the lights{target_suffix}.",
    "set_brightness":  "Done. I set brightness{target_suffix} to {brightness} percent.",
    "set_color":       "Done. I set the color{target_suffix} to {color_name}.",
    "set_effect":      "Done. I set the {effect} effect{target_suffix}.",
    "set_speed":       "Done. I set speed{target_suffix} to {speed} percent.",
    "activate_scene":  "Done. I activated scene{detail_suffix}.",
    "run_automation":  "Done. I ran automation{detail_suffix}.",
    "run_script":      "Done. I ran script{detail_suffix}.",
    "greeting":        "Listening. How can I help?",
    "help":            (
        "I can control lights, brightness, color, effects, scenes and rules. "
        "Say Alexa or Sveta plus a command."
    ),
    "status":          "I'm online and the home is reachable.",
    "unknown":         "I didn't catch that. Try 'Sveta, brightness 100' or 'Alexa, rainbow'.",
}


def _target_suffix(target: str, lang: str) -> str:
    if target == "all":
        return " на обеих лентах" if lang == "ru" else " on both strips"
    if lang == "ru":
        return " на левой ленте" if target == "left" else " на правой ленте"
    return " on the left strip" if target == "left" else " on the right strip"


def _detail_suffix(detail: str, lang: str) -> str:
    if not detail:
        return ""
    return f" «{detail}»" if lang == "ru" else f" {detail}"


def _format_reply(intent: str, entities: dict, lang: str, detail: str = "") -> str:
    templates = _REPLIES_RU if lang == "ru" else _REPLIES_EN
    template = templates.get(intent, templates["unknown"])
    target = entities.get("target", "all")
    brightness = entities.get("brightness", "?")
    if brightness == "?" and entities.get("relative") is not None and not detail:
        # relative step applied — value filled after action when available
        brightness = entities.get("brightness", "?")
    try:
        return template.format(
            target_suffix=_target_suffix(target, lang),
            brightness=brightness,
            color_name=entities.get("color_name", entities.get("color_hex", "?")),
            effect=entities.get("effect", "?"),
            speed=entities.get("speed", "?"),
            detail_suffix=_detail_suffix(detail, lang),
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

_HOME_INTENTS = frozenset({
    "lights_on",
    "lights_off",
    "toggle",
    "set_brightness",
    "set_color",
    "set_effect",
    "set_speed",
    "activate_scene",
    "run_automation",
    "run_script",
})


async def _execute_home_action(intent: nlu.Intent) -> list[dict]:
    """
    Call the appropriate home.py function based on intent.
    Returns a list of action-result dicts for the API response.
    """
    ent = intent.entities
    strip = ent.get("target", "all")
    raw_idx = ent.get("target_index")
    target_index = int(raw_idx) if isinstance(raw_idx, (int, float)) or (
        isinstance(raw_idx, str) and str(raw_idx).isdigit()
    ) else None
    results = []

    try:
        if intent.name == "lights_on":
            r = await home.lights_on(strip=strip, target_index=target_index)
            results.append({"action": "lights_on", "strip": strip, "success": r.success,
                            "backend": r.backend, "detail": r.detail})

        elif intent.name == "lights_off":
            r = await home.lights_off(strip=strip, target_index=target_index)
            results.append({"action": "lights_off", "strip": strip, "success": r.success,
                            "backend": r.backend, "detail": r.detail})

        elif intent.name == "toggle":
            r = await home.toggle(strip=strip, target_index=target_index)
            results.append({"action": "toggle", "strip": strip, "success": r.success,
                            "backend": r.backend, "detail": r.detail})

        elif intent.name == "set_brightness":
            value = ent.get("brightness")
            relative = ent.get("relative")
            if value is not None:
                r = await home.set_brightness(value, strip=strip, target_index=target_index)
                results.append({"action": "set_brightness", "strip": strip, "value": value,
                                 "success": r.success, "backend": r.backend, "detail": r.detail})
            elif relative is not None:
                # Approximate relative step from current strip brightness (percent).
                strips = await home.list_strips()
                picked = home._pick_strips(strips, strip, target_index)  # noqa: SLF001
                current_pct = 50
                if picked:
                    bri = int(picked[0].get("brightness") or 128)
                    current_pct = max(0, min(100, round(bri * 100 / 255)))
                value = max(0, min(100, current_pct + int(relative)))
                ent["brightness"] = value
                r = await home.set_brightness(value, strip=strip, target_index=target_index)
                results.append({
                    "action": "set_brightness",
                    "strip": strip,
                    "value": value,
                    "relative": relative,
                    "success": r.success,
                    "backend": r.backend,
                    "detail": r.detail,
                })

        elif intent.name == "set_color":
            hex_val = ent.get("color_hex", "#FFFFFF")
            r = await home.set_color(hex_val, strip=strip, target_index=target_index)
            results.append({"action": "set_color", "strip": strip, "color": hex_val,
                             "success": r.success, "backend": r.backend, "detail": r.detail})

        elif intent.name == "set_effect":
            effect = ent.get("effect", "solid")
            r = await home.set_effect(effect, strip=strip, target_index=target_index)
            results.append({"action": "set_effect", "strip": strip, "effect": effect,
                             "success": r.success, "backend": r.backend, "detail": r.detail})

        elif intent.name == "set_speed":
            speed = ent.get("speed", 50)
            r = await home.set_speed(int(speed), strip=strip, target_index=target_index)
            results.append({"action": "set_speed", "strip": strip, "speed": speed,
                             "success": r.success, "backend": r.backend, "detail": r.detail})

        elif intent.name == "activate_scene":
            r = await home.activate_scene(ent.get("scene_query"))
            results.append({"action": "activate_scene", "success": r.success,
                            "backend": r.backend, "detail": r.detail})

        elif intent.name == "run_automation":
            r = await home.run_automation(ent.get("automation_query"))
            results.append({"action": "run_automation", "success": r.success,
                            "backend": r.backend, "detail": r.detail})

        elif intent.name == "run_script":
            r = await home.run_script(ent.get("script_query"))
            results.append({"action": "run_script", "success": r.success,
                            "backend": r.backend, "detail": r.detail})

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
    if intent.name in _HOME_INTENTS:
        action_list = await _execute_home_action(intent)

    # 4. Build reply text
    action_detail = ""
    if action_list:
        action_detail = str(action_list[0].get("detail") or "")
        if intent.name in ("activate_scene", "run_automation", "run_script") and not action_list[0].get("success"):
            fail = action_detail or "error"
            reply_text = (
                f"Не получилось: {fail}"
                if intent.lang == "ru"
                else f"Failed: {fail}"
            )
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

    reply_text = _format_reply(intent.name, intent.entities, intent.lang, detail=action_detail)

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
