/**
 * Flexible Alice-like NLU: bag-of-synonyms scoring, not rigid phrases.
 * Understands RU + EN paraphrases for lights, scenes, automations, scripts.
 */

export type AssistantIntentName =
  | "lights_on"
  | "lights_off"
  | "toggle"
  | "set_brightness"
  | "set_color"
  | "set_effect"
  | "set_speed"
  | "activate_scene"
  | "run_automation"
  | "run_script"
  | "status"
  | "help"
  | "greeting"
  | "unknown"

export type AssistantEntities = {
  target?: "all" | "left" | "right" | string
  brightness?: number
  relative?: number
  color_name?: string
  color_hex?: string
  effect?: string
  speed?: number
  scene_query?: string
  automation_query?: string
  script_query?: string
}

export type ParsedIntent = {
  name: AssistantIntentName
  confidence: number
  entities: AssistantEntities
  cleaned: string
  lang: "ru" | "en"
  hadWake: boolean
}

const COLOR_MAP: Record<string, string> = {
  красный: "#FF0000",
  красная: "#FF0000",
  красное: "#FF0000",
  оранжевый: "#FF8C00",
  жёлтый: "#FFE000",
  желтый: "#FFE000",
  зелёный: "#00CC44",
  зеленый: "#00CC44",
  голубой: "#00BFFF",
  синий: "#0033FF",
  фиолетовый: "#8800FF",
  розовый: "#FF69B4",
  белый: "#FFFFFF",
  "тёплый белый": "#FFD580",
  "теплый белый": "#FFD580",
  "холодный белый": "#F0F4FF",
  red: "#FF0000",
  orange: "#FF8C00",
  yellow: "#FFE000",
  green: "#00CC44",
  cyan: "#00BFFF",
  blue: "#0033FF",
  purple: "#8800FF",
  violet: "#8800FF",
  pink: "#FF69B4",
  white: "#FFFFFF",
  "warm white": "#FFD580",
  warm: "#FFD580",
  "cool white": "#F0F4FF",
}

const EFFECT_MAP: Record<string, string> = {
  радуга: "rainbow",
  радугу: "rainbow",
  радугой: "rainbow",
  радужный: "rainbow",
  дыхание: "pulse",
  дышать: "pulse",
  пульс: "pulse",
  пульсация: "pulse",
  бегущий: "chase",
  погоня: "chase",
  огонь: "fire",
  комета: "comet",
  комету: "comet",
  снег: "snow",
  волна: "wave",
  волну: "wave",
  театр: "theater",
  сканер: "scanner",
  искры: "sparkle",
  мигание: "twinkle",
  мерцание: "twinkle",
  статичный: "solid",
  однотонный: "solid",
  сплошной: "solid",
  градиент: "gradient",
  rainbow: "rainbow",
  breathing: "pulse",
  pulse: "pulse",
  chase: "chase",
  fire: "fire",
  comet: "comet",
  snow: "snow",
  wave: "wave",
  theater: "theater",
  scanner: "scanner",
  sparkle: "sparkle",
  twinkle: "twinkle",
  solid: "solid",
  static: "solid",
  gradient: "gradient",
  color_loop: "color_loop",
}

type Bag = { intent: AssistantIntentName; weight: number; words: string[] }

/** Synonym bags — any paraphrase that hits several words scores higher. */
const BAGS: Bag[] = [
  {
    intent: "lights_on",
    weight: 1,
    words: [
      "включи", "включить", "включай", "зажги", "зажги", "свет", "ленту", "ленты", "огни",
      "turn", "on", "switch", "lights", "light", "strip", "enable", "power",
    ],
  },
  {
    intent: "lights_off",
    weight: 1,
    words: [
      "выключи", "выключить", "выключай", "погаси", "выруби", "выключите", "темн",
      "turn", "off", "switch", "lights", "disable", "kill",
    ],
  },
  {
    intent: "toggle",
    weight: 1.1,
    words: ["переключи", "переключить", "toggle", "инверт", "наоборот"],
  },
  {
    intent: "set_brightness",
    weight: 1.2,
    words: [
      "яркость", "яркост", "ярче", "темнее", "тускл", "диммер", "brightness", "bright",
      "dim", "процент", "%",
    ],
  },
  {
    intent: "set_color",
    weight: 1.15,
    words: ["цвет", "окрась", "покрась", "color", "colour", "make", "it", ...Object.keys(COLOR_MAP)],
  },
  {
    intent: "set_effect",
    weight: 1.2,
    words: [
      "эффект", "режим", "анимац", "effect", "mode", "сделай", ...Object.keys(EFFECT_MAP),
    ],
  },
  {
    intent: "set_speed",
    weight: 1.1,
    words: ["скорость", "быстрее", "медленнее", "speed", "faster", "slower"],
  },
  {
    intent: "activate_scene",
    weight: 1.25,
    words: ["сцена", "сцену", "сцены", "атмосфер", "scene", "activate", "включи сцен"],
  },
  {
    intent: "run_automation",
    weight: 1.2,
    words: ["автоматизац", "автоматия", "правило", "automation", "rule", "запусти авто"],
  },
  {
    intent: "run_script",
    weight: 1.2,
    words: ["скрипт", "сценарий", "script", "запусти скрипт"],
  },
  {
    intent: "help",
    weight: 1.3,
    words: ["помощь", "помоги", "умеешь", "команды", "help", "commands", "what can"],
  },
  {
    intent: "status",
    weight: 1.2,
    words: ["статус", "состояние", "как дела", "status", "health", "ping"],
  },
  {
    intent: "greeting",
    weight: 1.3,
    words: ["привет", "здравствуй", "добрый", "hello", "hi", "hey"],
  },
]

function detectLang(text: string): "ru" | "en" {
  const cyr = (text.match(/[а-яё]/gi) || []).length
  return cyr > text.length * 0.12 ? "ru" : "en"
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}%\s#-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function stripWake(text: string): { cleaned: string; hadWake: boolean } {
  // Do not use \\b — broken for Cyrillic in JS.
  const re = /(?:^|[^\p{L}\p{N}])(алекс[аеуыой]?|alexa)(?=[^\p{L}\p{N}]|$)/giu
  if (!re.test(` ${text} `)) {
    return { cleaned: text.trim(), hadWake: false }
  }
  const cleaned = text
    .replace(/(?:^|[^\p{L}\p{N}])(алекс[аеуыой]?|alexa)(?=[^\p{L}\p{N}]|$)/giu, " ")
    .replace(/^[,\s.!:;\-—]+/, "")
    .replace(/\s+/g, " ")
    .trim()
  return { cleaned, hadWake: true }
}

function extractTarget(t: string): AssistantEntities["target"] {
  // Avoid matching "right" inside "brightness"
  if (/(?:^|[^\p{L}])(?:лев(?:ую|ая|ой|ые|ом)?|left)(?=[^\p{L}]|$)/iu.test(t)) return "left"
  if (/(?:^|[^\p{L}])(?:прав(?:ую|ая|ой|ые|ом)?|right)(?=[^\p{L}]|$)/iu.test(t)) return "right"
  if (/(?:^|[^\p{L}])(?:все|всё|обе|оба|all|both)(?=[^\p{L}]|$)/iu.test(t)) return "all"
  return "all"
}

function extractBrightness(t: string): { brightness?: number; relative?: number } {
  const m = t.match(/(?:яркость|brightness)\s*(?:на\s*|до\s*|to\s*|=?\s*)?(\d{1,3})\s*%?/)
  if (m) {
    const n = Number(m[1])
    if (n >= 0 && n <= 100) return { brightness: n }
  }
  const lone = t.match(/(?:^|\s)(\d{1,3})\s*%(?:\s|$)/)
  if (lone) {
    const n = Number(lone[1])
    if (n >= 0 && n <= 100) return { brightness: n }
  }
  if (/ярче|bright(?:er)?|повыше|увелич/i.test(t)) return { relative: 20 }
  if (/темнее|dim(?:mer)?|тусклее|пониже|уменьш/i.test(t)) return { relative: -20 }
  return {}
}

function extractColor(t: string): { color_name?: string; color_hex?: string } {
  const keys = Object.keys(COLOR_MAP).sort((a, b) => b.length - a.length)
  for (const k of keys) {
    if (t.includes(k)) return { color_name: k, color_hex: COLOR_MAP[k] }
  }
  return {}
}

function extractEffect(t: string): string | undefined {
  const keys = Object.keys(EFFECT_MAP).sort((a, b) => b.length - a.length)
  for (const k of keys) {
    if (t.includes(k)) return EFFECT_MAP[k]
  }
  return undefined
}

function extractSpeed(t: string): number | undefined {
  const m = t.match(/(?:скорость|speed)\s*(?:на\s*|до\s*|to\s*)?(\d{1,3})/i)
  if (m) return Math.max(1, Math.min(100, Number(m[1])))
  if (/\b(быстрее|faster)\b/i.test(t)) return 80
  if (/\b(медленнее|slower)\b/i.test(t)) return 30
  return undefined
}

function extractNamedQuery(t: string, kinds: RegExp): string | undefined {
  const m = t.match(kinds)
  if (!m) return undefined
  const rest = t
    .replace(kinds, " ")
    .replace(/\b(включи|включить|запусти|запустить|активируй|activate|run|start|сцену|сцена|правило|скрипт|scene|automation|script)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
  return rest || undefined
}

function scoreBags(t: string): { intent: AssistantIntentName; score: number }[] {
  const tokens = new Set(t.split(" ").filter(Boolean))
  const out: { intent: AssistantIntentName; score: number }[] = []
  for (const bag of BAGS) {
    let hits = 0
    for (const w of bag.words) {
      if (w.length <= 2) {
        if (tokens.has(w)) hits += 1
        continue
      }
      if (t.includes(w) || tokens.has(w)) hits += 1
    }
    if (hits <= 0) continue
    // Prefer denser matches; off/on need disambiguation
    const score = (hits / Math.sqrt(bag.words.length)) * bag.weight + hits * 0.15
    out.push({ intent: bag.intent, score })
  }
  out.sort((a, b) => b.score - a.score)
  return out
}

/** Resolve conflicts: "выключи" beats generic "свет"; color name alone → set_color, etc. */
function pickIntent(
  ranked: { intent: AssistantIntentName; score: number }[],
  t: string,
  entities: AssistantEntities,
): { name: AssistantIntentName; confidence: number } {
  if (!ranked.length) {
    if (entities.color_hex) return { name: "set_color", confidence: 0.72 }
    if (entities.effect) return { name: "set_effect", confidence: 0.72 }
    return { name: "unknown", confidence: 0 }
  }

  let top = ranked[0]

  const hasOff = /выключ|погас|выруб|\boff\b/i.test(t)
  const hasOn = /включ|зажг|\bturn on\b|\bswitch on\b/i.test(t)
  if (hasOff && !hasOn) {
    const off = ranked.find((r) => r.intent === "lights_off")
    if (off) top = off
  } else if (hasOn && !hasOff) {
    const on = ranked.find((r) => r.intent === "lights_on")
    if (on && on.score >= top.score * 0.7) top = on
  }

  // Bare color / effect utterances
  if (entities.color_hex && (top.intent === "lights_on" || top.intent === "unknown" || top.score < 1.2)) {
    return { name: "set_color", confidence: Math.min(0.95, 0.7 + top.score / 10) }
  }
  if (entities.effect && (top.intent === "lights_on" || top.score < 1.3)) {
    const eff = ranked.find((r) => r.intent === "set_effect")
    return {
      name: "set_effect",
      confidence: Math.min(0.95, 0.72 + (eff?.score || top.score) / 10),
    }
  }

  // Scene/automation/script if query present
  if (entities.scene_query) {
    return { name: "activate_scene", confidence: 0.86 }
  }
  if (entities.automation_query) {
    return { name: "run_automation", confidence: 0.84 }
  }
  if (entities.script_query) {
    return { name: "run_script", confidence: 0.84 }
  }

  const conf = Math.min(0.98, 0.45 + top.score / 4)
  return { name: top.intent, confidence: conf }
}

export function parseAssistantText(raw: string): ParsedIntent {
  const { cleaned, hadWake } = stripWake(raw)
  const lang = detectLang(cleaned || raw)
  const t = normalize(cleaned || raw)

  if (!t) {
    return {
      name: hadWake ? "greeting" : "unknown",
      confidence: hadWake ? 0.7 : 0,
      entities: {},
      cleaned: "",
      lang,
      hadWake,
    }
  }

  const entities: AssistantEntities = {
    target: extractTarget(t),
    ...extractBrightness(t),
    ...extractColor(t),
    effect: extractEffect(t),
  }
  const speed = extractSpeed(t)
  if (speed != null) entities.speed = speed

  entities.scene_query = extractNamedQuery(
    t,
    /\b(сцен[ауые]?|атмосфер[ауы]?|scene)\b/i,
  )
  entities.automation_query = extractNamedQuery(
    t,
    /\b(автоматизаци[яию]|правил[оа]|automation|rule)\b/i,
  )
  entities.script_query = extractNamedQuery(t, /\b(скрипт|сценари[йя]|script)\b/i)

  // "запусти вечер" without kind word → treat as scene query candidate
  if (!entities.scene_query && !entities.automation_query && !entities.script_query) {
    const run = t.match(/\b(?:запусти|активируй|включи|run|activate|start)\s+(.+)$/i)
    if (run && !extractEffect(run[1]) && !COLOR_MAP[run[1].trim()]) {
      entities.scene_query = run[1].trim()
    }
  }

  const ranked = scoreBags(t)
  const picked = pickIntent(ranked, t, entities)

  // Brightness without number and without relative → unknown unless "ярче/темнее"
  if (picked.name === "set_brightness" && entities.brightness == null && entities.relative == null) {
    return { name: "unknown", confidence: 0.2, entities, cleaned, lang, hadWake }
  }
  if (picked.name === "set_color" && !entities.color_hex) {
    return { name: "unknown", confidence: 0.2, entities, cleaned, lang, hadWake }
  }
  if (picked.name === "set_effect" && !entities.effect) {
    return { name: "unknown", confidence: 0.2, entities, cleaned, lang, hadWake }
  }
  if (picked.name === "set_speed" && entities.speed == null) {
    return { name: "unknown", confidence: 0.2, entities, cleaned, lang, hadWake }
  }

  return {
    name: picked.name,
    confidence: picked.confidence + (hadWake ? 0.03 : 0),
    entities,
    cleaned,
    lang,
    hadWake,
  }
}

export function formatAssistantReply(
  intent: AssistantIntentName,
  entities: AssistantEntities,
  lang: "ru" | "en",
  ok: boolean,
  detail?: string,
): string {
  if (!ok && detail) {
    return lang === "ru" ? `Не получилось: ${detail}` : `Failed: ${detail}`
  }
  const tgt =
    entities.target === "left"
      ? lang === "ru"
        ? " на левой ленте"
        : " on the left strip"
      : entities.target === "right"
        ? lang === "ru"
          ? " на правой ленте"
          : " on the right strip"
        : ""

  const ru: Record<string, string> = {
    lights_on: `Хорошо, включаю свет${tgt}.`,
    lights_off: `Выключаю свет${tgt}.`,
    toggle: `Переключаю свет${tgt}.`,
    set_brightness:
      entities.brightness != null
        ? `Ставлю яркость${tgt} на ${entities.brightness}%.`
        : `Меняю яркость${tgt}.`,
    set_color: `Меняю цвет${tgt} на ${entities.color_name || "выбранный"}.`,
    set_effect: `Включаю эффект «${entities.effect}»${tgt}.`,
    set_speed: `Скорость${tgt}: ${entities.speed}%.`,
    activate_scene: `Активирую сцену${detail ? ` «${detail}»` : ""}.`,
    run_automation: `Запускаю автоматизацию${detail ? ` «${detail}»` : ""}.`,
    run_script: `Запускаю скрипт${detail ? ` «${detail}»` : ""}.`,
    greeting: "Слушаю. Чем помочь?",
    help: "Могу включать и выключать свет, менять яркость, цвет и эффекты, запускать сцены, правила и скрипты. Скажите «Алекса» и команду своими словами.",
    status: "Я на связи, умный дом отвечает.",
    unknown: "Не поняла. Попробуйте иначе — например «Алекса, сделай радугу» или «Алекса, яркость 40».",
  }
  const en: Record<string, string> = {
    lights_on: `Turning the lights on${tgt}.`,
    lights_off: `Turning the lights off${tgt}.`,
    toggle: `Toggling the lights${tgt}.`,
    set_brightness:
      entities.brightness != null
        ? `Setting brightness${tgt} to ${entities.brightness}%.`
        : `Adjusting brightness${tgt}.`,
    set_color: `Setting color${tgt} to ${entities.color_name || "that"}.`,
    set_effect: `Setting effect to ${entities.effect}${tgt}.`,
    set_speed: `Speed${tgt}: ${entities.speed}%.`,
    activate_scene: `Activating scene${detail ? ` ${detail}` : ""}.`,
    run_automation: `Running automation${detail ? ` ${detail}` : ""}.`,
    run_script: `Running script${detail ? ` ${detail}` : ""}.`,
    greeting: "Listening. How can I help?",
    help: "I can control lights, brightness, color, effects, scenes, automations and scripts. Say Alexa plus a command in your own words.",
    status: "I'm online and the home is reachable.",
    unknown: "I didn't catch that. Try rephrasing — e.g. 'Alexa, make it rainbow' or 'Alexa, brightness 40'.",
  }
  return (lang === "ru" ? ru : en)[intent] || (lang === "ru" ? ru.unknown : en.unknown)
}
