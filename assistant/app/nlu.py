"""
Flexible Alice-like NLU — synonym bag scoring (RU + EN paraphrases).

Not rigid phrase matching: bags of synonyms score paraphrases for lights,
brightness, color, effect, speed, scenes, automations, scripts, and meta intents.

Intent fields align with voice.py:
  name, confidence, entities, cleaned_text, lang
"""

from __future__ import annotations

import math
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
    cleaned_text: str = ""
    lang: str = "ru"
    had_wake: bool = False


# ─────────────────────────────────────────────
# Wake-word (leading + mid-sentence)
# ─────────────────────────────────────────────

_RU_WAKE = r"(?:алекс[аеуойы]?|свет(?:а|у|е|ой|ы|ою))"
_EN_WAKE = r"(?:alexa|sveta)"
_WAKE_LEAD_RE = re.compile(
    rf"^\s*(?:{_RU_WAKE}|{_EN_WAKE})[,\s!.:]*",
    re.IGNORECASE | re.UNICODE,
)
# Avoid ASCII \\b for Cyrillic — use non-letter edges.
_WAKE_MID_RE = re.compile(
    rf"(?<![\w])(?:{_RU_WAKE}|{_EN_WAKE})(?![\w])[,\s!.:]*",
    re.IGNORECASE | re.UNICODE,
)


def strip_wake_word(text: str) -> tuple[str, bool]:
    """Remove wake-word (leading or mid-sentence). Returns (cleaned, had_wake)."""
    m = _WAKE_LEAD_RE.match(text)
    if m:
        return text[m.end():].strip(), True
    mid = _WAKE_MID_RE.sub(" ", text).strip()
    mid = re.sub(r"\s+", " ", mid)
    if mid != text.strip():
        return mid, True
    return text.strip(), False


# ─────────────────────────────────────────────
# Language / normalize
# ─────────────────────────────────────────────

_CYRILLIC_RE = re.compile(r"[а-яё]", re.IGNORECASE)


def detect_lang(text: str) -> str:
    cyrillic = len(_CYRILLIC_RE.findall(text))
    return "ru" if cyrillic > len(text) * 0.12 else "en"


def normalize(text: str) -> str:
    t = text.lower().replace("ё", "е")
    t = re.sub(r"[^\w%\s#-]+", " ", t, flags=re.UNICODE)
    t = re.sub(r"_", " ", t)
    return re.sub(r"\s+", " ", t).strip()


# ─────────────────────────────────────────────
# Entity maps
# ─────────────────────────────────────────────

COLOR_MAP: dict[str, str] = {
    "красный": "#FF0000",
    "красная": "#FF0000",
    "красное": "#FF0000",
    "оранжевый": "#FF8C00",
    "оранжевая": "#FF8C00",
    "жёлтый": "#FFE000",
    "желтый": "#FFE000",
    "зелёный": "#00CC44",
    "зеленый": "#00CC44",
    "голубой": "#00BFFF",
    "синий": "#0033FF",
    "фиолетовый": "#8800FF",
    "розовый": "#FF69B4",
    "белый": "#FFFFFF",
    "тёплый белый": "#FFD580",
    "теплый белый": "#FFD580",
    "тёплобелый": "#FFD580",
    "холодный белый": "#F0F4FF",
    "red": "#FF0000",
    "orange": "#FF8C00",
    "yellow": "#FFE000",
    "green": "#00CC44",
    "cyan": "#00BFFF",
    "blue": "#0033FF",
    "purple": "#8800FF",
    "violet": "#8800FF",
    "pink": "#FF69B4",
    "white": "#FFFFFF",
    "warm white": "#FFD580",
    "warm": "#FFD580",
    "cool white": "#F0F4FF",
}

EFFECT_MAP: dict[str, str] = {
    "радуга": "rainbow",
    "радугу": "rainbow",
    "радугой": "rainbow",
    "радуги": "rainbow",
    "радужный": "rainbow",
    "радужную": "rainbow",
    "дыхание": "pulse",
    "дышать": "pulse",
    "пульс": "pulse",
    "пульсация": "pulse",
    "бегущий": "chase",
    "погоня": "chase",
    "огонь": "fire",
    "комета": "comet",
    "комету": "comet",
    "снег": "snow",
    "волна": "wave",
    "волну": "wave",
    "театр": "theater",
    "сканер": "scanner",
    "искры": "sparkle",
    "статичный": "solid",
    "однотонный": "solid",
    "одноцветный": "solid",
    "сплошной": "solid",
    "мигание": "twinkle",
    "мигает": "twinkle",
    "мерцание": "twinkle",
    "градиент": "gradient",
    "rainbow": "rainbow",
    "breathing": "pulse",
    "pulse": "pulse",
    "chase": "chase",
    "fire": "fire",
    "comet": "comet",
    "snow": "snow",
    "wave": "wave",
    "theater": "theater",
    "scanner": "scanner",
    "sparkle": "sparkle",
    "solid": "solid",
    "static": "solid",
    "blink": "twinkle",
    "twinkle": "twinkle",
    "gradient": "gradient",
    "color_loop": "color_loop",
}

# Normalized color/effect keys (ё→е) for matching after normalize()
_COLOR_NORM = {normalize(k): (k, v) for k, v in COLOR_MAP.items()}
_EFFECT_NORM = {normalize(k): v for k, v in EFFECT_MAP.items()}


# ─────────────────────────────────────────────
# Synonym bags
# ─────────────────────────────────────────────

@dataclass(frozen=True)
class _Bag:
    intent: str
    weight: float
    words: tuple[str, ...]


_BAGS: tuple[_Bag, ...] = (
    _Bag(
        "lights_on",
        1.0,
        (
            "включи", "включить", "включай", "зажги", "свет", "ленту", "ленты", "огни",
            "turn", "on", "switch", "lights", "light", "strip", "enable", "power",
        ),
    ),
    _Bag(
        "lights_off",
        1.0,
        (
            "выключи", "выключить", "выключай", "погаси", "выруби", "выключите", "темн",
            "turn", "off", "switch", "lights", "disable", "kill",
        ),
    ),
    _Bag(
        "toggle",
        1.1,
        ("переключи", "переключить", "toggle", "инверт", "наоборот"),
    ),
    _Bag(
        "set_brightness",
        1.2,
        (
            "яркость", "яркост", "ярче", "темнее", "тускл", "диммер",
            "brightness", "bright", "dim", "процент", "%",
        ),
    ),
    _Bag(
        "set_color",
        1.15,
        ("цвет", "окрась", "покрась", "color", "colour", "make", "it", *tuple(COLOR_MAP.keys())),
    ),
    _Bag(
        "set_effect",
        1.2,
        ("эффект", "режим", "анимац", "effect", "mode", "сделай", *tuple(EFFECT_MAP.keys())),
    ),
    _Bag(
        "set_speed",
        1.1,
        ("скорость", "быстрее", "медленнее", "speed", "faster", "slower"),
    ),
    _Bag(
        "activate_scene",
        1.25,
        ("сцена", "сцену", "сцены", "атмосфер", "scene", "activate", "включи сцен"),
    ),
    _Bag(
        "run_automation",
        1.2,
        ("автоматизац", "автоматия", "правило", "automation", "rule", "запусти авто"),
    ),
    _Bag(
        "run_script",
        1.2,
        ("скрипт", "сценарий", "script", "запусти скрипт"),
    ),
    _Bag(
        "help",
        1.3,
        ("помощь", "помоги", "умеешь", "команды", "help", "commands", "what can"),
    ),
    _Bag(
        "status",
        1.2,
        ("статус", "состояние", "как дела", "status", "health", "ping"),
    ),
    _Bag(
        "greeting",
        1.3,
        ("привет", "здравствуй", "добрый", "hello", "hi", "hey"),
    ),
)


# ─────────────────────────────────────────────
# Entity extractors
# ─────────────────────────────────────────────

def extract_target(text: str) -> dict[str, Any]:
    """Return {target, target_index?} for left/right/ordinal/strip N."""
    if re.search(
        r"перв(?:ой|ую|ая|ое|ый|ом)?|first|1[\-\s]?[яийе]"
        r"|(?:лент[аыуеию]|strip|канал)\s*(?:номер\s*|№\s*|number\s*)?1(?:\D|$)",
        text,
        re.IGNORECASE,
    ):
        return {"target": "strip:0", "target_index": 0}
    if re.search(
        r"втор(?:ой|ую|ая|ое|ый|ом)?|second|2[\-\s]?[яийе]"
        r"|(?:лент[аыуеию]|strip|канал)\s*(?:номер\s*|№\s*|number\s*)?2(?:\D|$)",
        text,
        re.IGNORECASE,
    ):
        return {"target": "strip:1", "target_index": 1}
    if re.search(
        r"трет(?:ьей|ью|ья|ий|ьем)|third|3[\-\s]?[яийе]"
        r"|(?:лент[аыуеию]|strip|канал)\s*(?:номер\s*|№\s*|number\s*)?3(?:\D|$)",
        text,
        re.IGNORECASE,
    ):
        return {"target": "strip:2", "target_index": 2}

    if re.search(r"(?<!\w)(?:лев(?:ую|ая|ой|ые|ом|ое)?|left)(?!\w)", text, re.IGNORECASE):
        return {"target": "left", "target_index": 0}
    if re.search(r"(?<!\w)(?:прав(?:ую|ая|ой|ые|ом|ое)?|right)(?!\w)", text, re.IGNORECASE):
        return {"target": "right", "target_index": 1}
    if re.search(r"(?<!\w)(?:все|всё|обе|оба|all|both)(?!\w)", text, re.IGNORECASE):
        return {"target": "all"}
    return {"target": "all"}


def extract_brightness(text: str) -> dict[str, int]:
    if re.search(r"яркость|brightness|яркост", text, re.IGNORECASE):
        pct = re.search(r"(\d{1,3})\s*%", text)
        if pct:
            n = int(pct.group(1))
            if 0 <= n <= 100:
                return {"brightness": n}
        cleaned = re.sub(
            r"(?:лент[аыуеию]|strip|канал)\s*(?:номер\s*|№\s*|#\s*|number\s*)?[0-8](?!\d)",
            " ",
            text,
            flags=re.IGNORECASE,
        )
        cleaned = re.sub(
            r"(?:перв|втор|трет|first|second|third)\w*",
            " ",
            cleaned,
            flags=re.IGNORECASE,
        )
        parts = re.split(r"яркость|brightness|яркост\w*", cleaned, flags=re.IGNORECASE)
        after = " ".join(parts[1:]) if len(parts) > 1 else cleaned
        nums = [int(x) for x in re.findall(r"(\d{1,3})", after)]
        nums = [n for n in nums if 0 <= n <= 100]
        if nums:
            return {"brightness": nums[-1]}
    m = re.search(r"(?:^|\s)(\d{1,3})\s*%(?:\s|$)", text)
    if m:
        n = int(m.group(1))
        if 0 <= n <= 100:
            return {"brightness": n}
    if re.search(r"ярче|bright(?:er)?|повыше|увелич", text, re.IGNORECASE):
        return {"relative": 20}
    if re.search(r"темнее|dim(?:mer)?|тусклее|пониже|уменьш", text, re.IGNORECASE):
        return {"relative": -20}
    return {}


def extract_color(text: str) -> dict[str, str]:
    keys = sorted(_COLOR_NORM.keys(), key=len, reverse=True)
    for k in keys:
        if k and k in text:
            orig, hex_val = _COLOR_NORM[k]
            return {"color_name": orig, "color_hex": hex_val}
    return {}


def extract_effect(text: str) -> Optional[str]:
    keys = sorted(_EFFECT_NORM.keys(), key=len, reverse=True)
    for k in keys:
        if k and k in text:
            return _EFFECT_NORM[k]
    return None


def extract_speed(text: str) -> Optional[int]:
    m = re.search(
        r"(?:скорость|speed)\s*(?:на\s*|до\s*|to\s*)?(\d{1,3})",
        text,
        re.IGNORECASE,
    )
    if m:
        return max(1, min(100, int(m.group(1))))
    if re.search(r"\b(быстрее|faster)\b", text, re.IGNORECASE):
        return 80
    if re.search(r"\b(медленнее|slower)\b", text, re.IGNORECASE):
        return 30
    return None


_STRIP_QUERY_RE = re.compile(
    r"\b(включи|включить|запусти|запустить|активируй|activate|run|start|"
    r"сцену|сцена|правило|скрипт|scene|automation|script)\b",
    re.IGNORECASE,
)


def extract_named_query(text: str, kinds: re.Pattern[str]) -> Optional[str]:
    if not kinds.search(text):
        return None
    rest = kinds.sub(" ", text)
    rest = _STRIP_QUERY_RE.sub(" ", rest)
    rest = re.sub(r"\s+", " ", rest).strip()
    return rest or None


# ─────────────────────────────────────────────
# Bag scoring + intent pick
# ─────────────────────────────────────────────

def score_bags(text: str) -> list[tuple[str, float]]:
    tokens = set(text.split())
    out: list[tuple[str, float]] = []
    for bag in _BAGS:
        hits = 0
        for w in bag.words:
            wn = normalize(w) if any(ord(c) > 127 for c in w) else w.lower()
            if len(wn) <= 2:
                if wn in tokens:
                    hits += 1
                continue
            if wn in text or wn in tokens:
                hits += 1
        if hits <= 0:
            continue
        score = (hits / math.sqrt(len(bag.words))) * bag.weight + hits * 0.15
        out.append((bag.intent, score))
    out.sort(key=lambda x: x[1], reverse=True)
    return out


def pick_intent(
    ranked: list[tuple[str, float]],
    text: str,
    entities: dict[str, Any],
) -> tuple[str, float]:
    # Named home objects — even with weak/empty bag scores
    if entities.get("scene_query"):
        return "activate_scene", 0.86
    if entities.get("automation_query"):
        return "run_automation", 0.84
    if entities.get("script_query"):
        return "run_script", 0.84

    if not ranked:
        if entities.get("color_hex"):
            return "set_color", 0.72
        if entities.get("effect"):
            return "set_effect", 0.72
        return "unknown", 0.0

    top_name, top_score = ranked[0]

    has_off = bool(re.search(r"\b(выключ|погас|off|выруб)\w*", text, re.IGNORECASE))
    has_on = bool(re.search(r"\b(включ|зажг|turn on|switch on)\w*", text, re.IGNORECASE))
    if has_off and not has_on:
        off = next((r for r in ranked if r[0] == "lights_off"), None)
        if off:
            top_name, top_score = off
    elif has_on and not has_off:
        on = next((r for r in ranked if r[0] == "lights_on"), None)
        if on and on[1] >= top_score * 0.7:
            top_name, top_score = on

    if entities.get("color_hex") and (
        top_name in ("lights_on", "unknown") or top_score < 1.2
    ):
        return "set_color", min(0.95, 0.7 + top_score / 10)

    if entities.get("effect") and (top_name == "lights_on" or top_score < 1.3):
        eff = next((r for r in ranked if r[0] == "set_effect"), None)
        score = (eff[1] if eff else top_score)
        return "set_effect", min(0.95, 0.72 + score / 10)

    return top_name, min(0.98, 0.45 + top_score / 4)


# ─────────────────────────────────────────────
# Main parse
# ─────────────────────────────────────────────

def parse(text: str) -> Intent:
    cleaned, had_wake = strip_wake_word(text)
    lang = detect_lang(cleaned or text)
    t = normalize(cleaned or text)

    if not t:
        return Intent(
            name="greeting" if had_wake else "unknown",
            confidence=0.70 if had_wake else 0.0,
            cleaned_text="",
            lang=lang,
            had_wake=had_wake,
        )

    target_info = extract_target(t)
    entities: dict[str, Any] = {**target_info}
    entities.update(extract_brightness(t))
    entities.update(extract_color(t))
    eff = extract_effect(t)
    if eff:
        entities["effect"] = eff
    speed = extract_speed(t)
    if speed is not None:
        entities["speed"] = speed

    entities["scene_query"] = extract_named_query(
        t, re.compile(r"\b(сцен[ауые]?|атмосфер[ауы]?|scene)\b", re.IGNORECASE),
    )
    entities["automation_query"] = extract_named_query(
        t,
        re.compile(r"\b(автоматизаци[яию]|правил[оа]|automation|rule)\b", re.IGNORECASE),
    )
    entities["script_query"] = extract_named_query(
        t, re.compile(r"\b(скрипт|сценари[йя]|script)\b", re.IGNORECASE),
    )

    # "запусти вечер" without kind word → scene candidate (not light fillers)
    _LIGHT_FILLER = re.compile(
        r"^(свет|огни|лент[уыа]|lights?|strips?|all|все|всё|обе|оба|"
        r"лев\w*|прав\w*|left|right)(\s+(лент[уыа]|strip|light|lights))?$",
        re.IGNORECASE,
    )
    if not entities.get("scene_query") and not entities.get("automation_query") and not entities.get("script_query"):
        run = re.search(
            r"\b(?:запусти|активируй|включи|run|activate|start)\s+(.+)$",
            t,
            re.IGNORECASE,
        )
        if run:
            rest = run.group(1).strip()
            if (
                rest
                and not extract_effect(rest)
                and rest not in _COLOR_NORM
                and not _LIGHT_FILLER.match(rest)
            ):
                entities["scene_query"] = rest

    # Drop empty query keys
    for k in ("scene_query", "automation_query", "script_query"):
        if not entities.get(k):
            entities.pop(k, None)

    ranked = score_bags(t)
    name, confidence = pick_intent(ranked, t, entities)

    if name == "set_brightness" and entities.get("brightness") is None and entities.get("relative") is None:
        return Intent(name="unknown", confidence=0.2, entities=entities, cleaned_text=cleaned, lang=lang, had_wake=had_wake)
    if name == "set_color" and not entities.get("color_hex"):
        return Intent(name="unknown", confidence=0.2, entities=entities, cleaned_text=cleaned, lang=lang, had_wake=had_wake)
    if name == "set_effect" and not entities.get("effect"):
        return Intent(name="unknown", confidence=0.2, entities=entities, cleaned_text=cleaned, lang=lang, had_wake=had_wake)
    if name == "set_speed" and entities.get("speed") is None:
        return Intent(name="unknown", confidence=0.2, entities=entities, cleaned_text=cleaned, lang=lang, had_wake=had_wake)

    if had_wake:
        confidence = min(1.0, confidence + 0.03)

    return Intent(
        name=name,
        confidence=confidence,
        entities=entities,
        cleaned_text=cleaned,
        lang=lang,
        had_wake=had_wake,
    )
