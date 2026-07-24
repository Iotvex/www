"""
Natural Language Understanding — Russian + English, rule-based.

Responsibilities:
1. Strip wake-word variants (Alexa / Алекса / Алексу / Алексой …)
2. Detect intent with a confidence score
3. Extract entities: target strip, brightness value, color, effect

Supported intents
-----------------
lights_on       включи свет / turn on lights
lights_off      выключи свет / turn off lights
set_brightness  яркость 70% / set brightness to 70
set_color       красный / set color red
set_effect      радуга / set effect rainbow
greeting        привет / hello
help            помощь / help
status          статус / status
unknown         fallback
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Optional


# ─────────────────────────────────────────────
# Data structures
# ─────────────────────────────────────────────

@dataclass
class Intent:
    name: str
    confidence: float  # 0.0–1.0
    entities: dict[str, Any] = field(default_factory=dict)
    cleaned_text: str = ""   # text after wake-word strip
    lang: str = "ru"         # detected language hint


# ─────────────────────────────────────────────
# Wake-word patterns
# ─────────────────────────────────────────────

# Russian inflections: Алекса, Алексу, Алексой, Алексе, Алексы, Алексо (mis-spell)
_RU_WAKE = r"алекс[аеуойы]?"
# English: Alexa (case-insensitive applied after lower())
_EN_WAKE = r"alexa"

_WAKE_RE = re.compile(
    rf"^\s*(?:{_RU_WAKE}|{_EN_WAKE})[,\s!.]*",
    re.IGNORECASE | re.UNICODE,
)


def strip_wake_word(text: str) -> tuple[str, bool]:
    """
    Remove leading wake-word from text.
    Returns (cleaned_text, had_wake_word).
    """
    m = _WAKE_RE.match(text)
    if m:
        return text[m.end():].strip(), True
    return text.strip(), False


# ─────────────────────────────────────────────
# Language detection (heuristic)
# ─────────────────────────────────────────────

_CYRILLIC_RE = re.compile(r"[а-яё]", re.IGNORECASE)

def detect_lang(text: str) -> str:
    """Return 'ru' if Cyrillic chars dominate, else 'en'."""
    cyrillic = len(_CYRILLIC_RE.findall(text))
    return "ru" if cyrillic > len(text) * 0.15 else "en"


# ─────────────────────────────────────────────
# Entity: target strip
# ─────────────────────────────────────────────

_TARGET_MAP: list[tuple[re.Pattern, str]] = [
    # Russian
    (re.compile(r"\b(левую?|левые?|левой|левая|лев[оу]м?)\b", re.IGNORECASE), "left"),
    (re.compile(r"\b(правую?|правые?|правой|правая|прав[оу]м?)\b", re.IGNORECASE), "right"),
    (re.compile(r"\b(все|всё|все\s+ленты|обе|оба)\b", re.IGNORECASE), "all"),
    # English
    (re.compile(r"\bleft\b", re.IGNORECASE), "left"),
    (re.compile(r"\bright\b", re.IGNORECASE), "right"),
    (re.compile(r"\b(all|both)\b", re.IGNORECASE), "all"),
]

def extract_target(text: str) -> str:
    for pattern, value in _TARGET_MAP:
        if pattern.search(text):
            return value
    return "all"


# ─────────────────────────────────────────────
# Entity: brightness
# ─────────────────────────────────────────────

_BRIGHTNESS_RE = re.compile(
    r"(?:яркость|brightness|яркост[ьи])\s*(?:на\s*|до\s*|to\s*|=\s*)?(\d{1,3})\s*%?",
    re.IGNORECASE,
)
_JUST_NUMBER_RE = re.compile(r"\b(\d{1,3})\s*%?\b")

def extract_brightness(text: str) -> Optional[int]:
    m = _BRIGHTNESS_RE.search(text)
    if m:
        val = int(m.group(1))
        return max(0, min(100, val))
    # fallback: lone number in a brightness-context call
    m2 = _JUST_NUMBER_RE.search(text)
    if m2:
        val = int(m2.group(1))
        if 0 <= val <= 100:
            return val
    return None


# ─────────────────────────────────────────────
# Entity: color
# ─────────────────────────────────────────────

# name → hex RGB
COLOR_MAP: dict[str, str] = {
    # Russian
    "красный":      "#FF0000",
    "красная":      "#FF0000",
    "красное":      "#FF0000",
    "оранжевый":    "#FF8C00",
    "оранжевая":    "#FF8C00",
    "жёлтый":       "#FFE000",
    "желтый":       "#FFE000",
    "зелёный":      "#00CC44",
    "зеленый":      "#00CC44",
    "голубой":      "#00BFFF",
    "синий":        "#0033FF",
    "фиолетовый":   "#8800FF",
    "розовый":      "#FF69B4",
    "белый":        "#FFFFFF",
    "тёплый белый": "#FFD580",
    "теплый белый": "#FFD580",
    "тёплобелый":   "#FFD580",
    "холодный белый":"#F0F4FF",
    # English
    "red":          "#FF0000",
    "orange":       "#FF8C00",
    "yellow":       "#FFE000",
    "green":        "#00CC44",
    "cyan":         "#00BFFF",
    "blue":         "#0033FF",
    "purple":       "#8800FF",
    "violet":       "#8800FF",
    "pink":         "#FF69B4",
    "white":        "#FFFFFF",
    "warm white":   "#FFD580",
    "warm":         "#FFD580",
    "cool white":   "#F0F4FF",
}

# Build regex from longest to shortest to avoid partial matches
_COLOR_KEYS = sorted(COLOR_MAP.keys(), key=len, reverse=True)
_COLOR_RE = re.compile(
    r"(?:цвет[а-яе]*\s*)?(" + "|".join(re.escape(k) for k in _COLOR_KEYS) + r")",
    re.IGNORECASE | re.UNICODE,
)

def extract_color(text: str) -> Optional[tuple[str, str]]:
    """Return (color_name, hex) or None."""
    m = _COLOR_RE.search(text)
    if m:
        name = m.group(1).lower()
        hex_val = COLOR_MAP.get(name)
        if hex_val:
            return name, hex_val
    return None


# ─────────────────────────────────────────────
# Entity: effect
# ─────────────────────────────────────────────

EFFECT_MAP: dict[str, str] = {
    # Russian → canonical name
    "радуга":       "rainbow",
    "радугу":       "rainbow",
    "радугой":      "rainbow",
    "радуги":       "rainbow",
    "радужный":     "rainbow",
    "радужную":     "rainbow",
    "дыхание":      "pulse",
    "дышать":       "pulse",
    "пульс":        "pulse",
    "пульсация":    "pulse",
    "бегущий":      "chase",
    "погоня":       "chase",
    "огонь":        "fire",
    "комета":       "comet",
    "комету":       "comet",
    "снег":         "snow",
    "волна":        "wave",
    "волну":        "wave",
    "театр":        "theater",
    "сканер":       "scanner",
    "искры":        "sparkle",
    "статичный":    "solid",
    "однотонный":   "solid",
    "одноцветный":  "solid",
    "сплошной":     "solid",
    "мигание":      "twinkle",
    "мигает":       "twinkle",
    "мерцание":     "twinkle",
    # English
    "rainbow":      "rainbow",
    "breathing":    "pulse",
    "pulse":        "pulse",
    "chase":        "chase",
    "fire":         "fire",
    "comet":        "comet",
    "snow":         "snow",
    "wave":         "wave",
    "theater":      "theater",
    "scanner":      "scanner",
    "sparkle":      "sparkle",
    "solid":        "solid",
    "static":       "solid",
    "blink":        "twinkle",
    "twinkle":      "twinkle",
    "gradient":     "gradient",
    "color_loop":   "color_loop",
}

_EFFECT_KEYS = sorted(EFFECT_MAP.keys(), key=len, reverse=True)
_EFFECT_RE = re.compile(
    r"(?:эффект[а-яе]*\s*|режим[а-яе]*\s*|effect\s*|mode\s*)?("
    + "|".join(re.escape(k) for k in _EFFECT_KEYS) + r")",
    re.IGNORECASE | re.UNICODE,
)

def extract_effect(text: str) -> Optional[str]:
    m = _EFFECT_RE.search(text)
    if m:
        name = m.group(1).lower()
        return EFFECT_MAP.get(name)
    return None


# ─────────────────────────────────────────────
# Intent patterns
# ─────────────────────────────────────────────

# Each entry: (pattern, intent_name, base_confidence)
_PATTERNS: list[tuple[re.Pattern, str, float]] = [
    # ── Greeting ──────────────────────────────
    (re.compile(r"\b(привет|здравствуй|здравствуйте|добрый\s+день|добрый\s+вечер|доброе\s+утро)\b",
                re.IGNORECASE), "greeting", 0.95),
    (re.compile(r"\b(hi|hello|hey|good\s+morning|good\s+evening|good\s+day)\b",
                re.IGNORECASE), "greeting", 0.95),

    # ── Help ──────────────────────────────────
    (re.compile(r"\b(помощь|помоги|помогите|что\s+ты\s+умеешь|что\s+умеешь|команды|список\s+команд)\b",
                re.IGNORECASE), "help", 0.95),
    (re.compile(r"\b(help|what\s+can\s+you\s+do|commands|show\s+commands)\b",
                re.IGNORECASE), "help", 0.95),

    # ── Status ────────────────────────────────
    (re.compile(r"\b(статус|состояние|как\s+дела|всё\s+ли\s+работает)\b",
                re.IGNORECASE), "status", 0.90),
    (re.compile(r"\b(status|ping|are\s+you\s+there|health)\b",
                re.IGNORECASE), "status", 0.90),

    # ── Set brightness ────────────────────────
    (re.compile(r"\b(яркость|сделай\s+ярче|сделай\s+темнее|brightness|dim|bright)\b",
                re.IGNORECASE), "set_brightness", 0.85),

    # ── Set effect ────────────────────────────
    (re.compile(
        r"(эффект|режим|сделай\s+радуг|включи\s+радуг|"
        + "|".join(re.escape(k) for k in _EFFECT_KEYS) + r")",
        re.IGNORECASE | re.UNICODE), "set_effect", 0.80),

    # ── Set color ─────────────────────────────
    (re.compile(
        r"(цвет|поставь\s+цвет|сделай\s+цвет|color|set\s+color|make\s+it|"
        + "|".join(re.escape(k) for k in _COLOR_KEYS) + r")",
        re.IGNORECASE | re.UNICODE), "set_color", 0.80),

    # ── Lights ON ─────────────────────────────
    (re.compile(r"(включи|включить|врубить|включай|turn\s+on|switch\s+on|lights?\s+on)",
                re.IGNORECASE | re.UNICODE), "lights_on", 0.90),

    # ── Lights OFF ────────────────────────────
    (re.compile(r"(выключи|выключить|вырубить|выключай|turn\s+off|switch\s+off|lights?\s+off)",
                re.IGNORECASE | re.UNICODE), "lights_off", 0.90),
]


# ─────────────────────────────────────────────
# Main parse function
# ─────────────────────────────────────────────

def parse(text: str) -> Intent:
    """
    Full NLU pipeline:
      1. Strip wake word
      2. Detect language
      3. Match intent patterns
      4. Extract entities
    """
    cleaned, had_wake = strip_wake_word(text)
    lang = detect_lang(cleaned or text)

    if not cleaned:
        return Intent(
            name="greeting",
            confidence=0.70,
            cleaned_text="",
            lang=lang,
        )

    lo = cleaned.lower()

    # Score all matching intents, pick highest
    best_intent = "unknown"
    best_conf = 0.0
    for pattern, intent_name, base_conf in _PATTERNS:
        if pattern.search(lo):
            # Slight boost if wake word was present (user was talking to us)
            conf = base_conf + (0.05 if had_wake else 0.0)
            if conf > best_conf:
                best_conf = conf
                best_intent = intent_name

    # Clamp
    best_conf = min(best_conf, 1.0)

    # Extract entities
    entities: dict[str, Any] = {}

    if best_intent in ("lights_on", "lights_off", "set_brightness", "set_color", "set_effect"):
        entities["target"] = extract_target(lo)

    if best_intent == "set_brightness":
        val = extract_brightness(lo)
        if val is None:
            # "ярче" / "bright" → relative
            if re.search(r"\b(ярче|bright|increase|повысить)\b", lo, re.IGNORECASE):
                entities["relative"] = +25
            elif re.search(r"\b(темнее|dim|decrease|понизить|тусклее)\b", lo, re.IGNORECASE):
                entities["relative"] = -25
            else:
                best_intent = "unknown"
                best_conf = 0.0
        else:
            entities["brightness"] = val

    if best_intent == "set_color":
        result = extract_color(lo)
        if result:
            entities["color_name"], entities["color_hex"] = result
        else:
            best_intent = "unknown"
            best_conf = 0.0

    if best_intent == "set_effect":
        eff = extract_effect(lo)
        if eff:
            entities["effect"] = eff
        else:
            best_intent = "unknown"
            best_conf = 0.0

    return Intent(
        name=best_intent,
        confidence=best_conf,
        entities=entities,
        cleaned_text=cleaned,
        lang=lang,
    )
