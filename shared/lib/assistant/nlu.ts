import {
  stripWakeWord as _stripWake,
  type WakeName,
} from "./wake"

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
  /** all | left | right | strip:0 | strip:1 | free-text device name */
  target?: "all" | "left" | "right" | string
  target_index?: number
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
  wakeName: WakeName
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

function stripWake(text: string): { cleaned: string; hadWake: boolean; wakeName: WakeName } {
  return _stripWake(text)
}

function extractTarget(t: string): {
  target: AssistantEntities["target"]
  target_index?: number
} {
  // Ordinals / numbers: первая лента, 1-я, лента 2, strip 1
  const ordinalFirst =
    /перв(?:ой|ую|ая|ое|ый|ом)?|first|1[\-\s]?[яийе]|(?:лент[аыуеию]|strip|канал)\s*(?:номер\s*|№\s*|number\s*)?1(?:\D|$)|(?:лент[аыуеию]|strip)\s*#?\s*0(?:\D|$)/iu.test(
      t,
    )
  const ordinalSecond =
    /втор(?:ой|ую|ая|ое|ый|ом)?|second|2[\-\s]?[яийе]|(?:лент[аыуеию]|strip|канал)\s*(?:номер\s*|№\s*|number\s*)?2(?:\D|$)|(?:лент[аыуеию]|strip)\s*#?\s*1(?:\D|$)/iu.test(
      t,
    )
  const ordinalThird =
    /трет(?:ьей|ью|ья|ий|ьем)|third|3[\-\s]?[яийе]|(?:лент[аыуеию]|strip|канал)\s*(?:номер\s*|№\s*|number\s*)?3(?:\D|$)/iu.test(
      t,
    )

  if (ordinalFirst) return { target: "strip:0", target_index: 0 }
  if (ordinalSecond) return { target: "strip:1", target_index: 1 }
  if (ordinalThird) return { target: "strip:2", target_index: 2 }

  // Avoid matching "right" inside "brightness"
  if (/(?:^|[^\p{L}])(?:лев(?:ую|ая|ой|ые|ом|ое)?|left)(?=[^\p{L}]|$)/iu.test(t)) {
    return { target: "left", target_index: 0 }
  }
  if (/(?:^|[^\p{L}])(?:прав(?:ую|ая|ой|ые|ом|ое)?|right)(?=[^\p{L}]|$)/iu.test(t)) {
    return { target: "right", target_index: 1 }
  }
  if (/(?:^|[^\p{L}])(?:все|всё|обе|оба|all|both)(?=[^\p{L}]|$)/iu.test(t)) {
    return { target: "all" }
  }

  // Named device hints: "лента кухни", "kitchen strip"
  const named = t.match(
    /(?:лент[аыуеию]|strip|свет|light)\s+([a-zа-яё0-9][\wа-яё\-]{1,24})/iu,
  )
  if (named?.[1] && !/^(на|до|для|the|a|и)$/i.test(named[1])) {
    return { target: named[1].toLowerCase() }
  }

  return { target: "all" }
}

function extractBrightness(t: string): { brightness?: number; relative?: number } {
  if (/яркость|brightness|яркост/i.test(t)) {
    // Prefer explicit percent anywhere in the phrase
    const pct = t.match(/(\d{1,3})\s*%/)
    if (pct) {
      const n = Number(pct[1])
      if (n >= 0 && n <= 100) return { brightness: n }
    }
    // Drop strip ordinals / "лента 1" so their digits are not taken as brightness
    const cleaned = t
      .replace(
        /(?:лент[аыуеию]|strip|канал)\s*(?:номер\s*|№\s*|#\s*|number\s*)?[0-8](?!\d)/giu,
        " ",
      )
      .replace(/(?:перв|втор|трет|first|second|third)\w*/giu, " ")
      .replace(/\b[12][\-\s]?[яийе]\b/giu, " ")
    const after =
      cleaned.split(/яркость|brightness|яркост\w*/i).slice(1).join(" ") || cleaned
    const nums = [...after.matchAll(/(\d{1,3})/g)].map((m) => Number(m[1]))
    const last = nums.filter((n) => n >= 0 && n <= 100).pop()
    if (last != null) return { brightness: last }
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
  if (/скорость|speed/i.test(t)) {
    const after = t.split(/скорость|speed/i).slice(1).join(" ") || t
    const m = after.match(/(\d{1,3})\s*%?/)
    if (m) return Math.max(1, Math.min(100, Number(m[1])))
  }
  if (/быстрее|faster/i.test(t)) return 80
  if (/медленнее|slower/i.test(t)) return 30
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
  const { cleaned, hadWake, wakeName } = stripWake(raw)
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
      wakeName,
    }
  }

  const targetInfo = extractTarget(t)
  const entities: AssistantEntities = {
    target: targetInfo.target,
    ...(targetInfo.target_index != null ? { target_index: targetInfo.target_index } : {}),
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
    return { name: "unknown", confidence: 0.2, entities, cleaned, lang, hadWake, wakeName }
  }
  if (picked.name === "set_color" && !entities.color_hex) {
    return { name: "unknown", confidence: 0.2, entities, cleaned, lang, hadWake, wakeName }
  }
  if (picked.name === "set_effect" && !entities.effect) {
    return { name: "unknown", confidence: 0.2, entities, cleaned, lang, hadWake, wakeName }
  }
  if (picked.name === "set_speed" && entities.speed == null) {
    return { name: "unknown", confidence: 0.2, entities, cleaned, lang, hadWake, wakeName }
  }

  return {
    name: picked.name,
    confidence: picked.confidence + (hadWake ? 0.03 : 0),
    entities,
    cleaned,
    lang,
    hadWake,
    wakeName,
  }
}

const EFFECT_RU: Record<string, string> = {
  rainbow: "радуга",
  pulse: "дыхание",
  chase: "погоня",
  fire: "огонь",
  comet: "комета",
  snow: "снег",
  wave: "волна",
  theater: "театр",
  scanner: "сканер",
  sparkle: "искры",
  twinkle: "мерцание",
  solid: "однотонный",
  gradient: "градиент",
  color_loop: "цикл цвета",
}

/** Spoken confirmation of what was actually done (past tense, feminine). */
export function formatAssistantReply(
  intent: AssistantIntentName,
  entities: AssistantEntities,
  lang: "ru" | "en",
  ok: boolean,
  detail?: string,
  wakeName?: WakeName,
): string {
  const who =
    wakeName === "sveta"
      ? lang === "ru"
        ? "Света"
        : "Sveta"
      : lang === "ru"
        ? "Алекса"
        : "Alexa"

  if (!ok && detail) {
    return lang === "ru"
      ? `Не получилось выполнить: ${detail}.`
      : `Couldn't do that: ${detail}.`
  }

  const tgt =
    entities.target_index === 0 || entities.target === "left" || entities.target === "strip:0"
      ? lang === "ru"
        ? " на первой (левой) ленте"
        : " on the first (left) strip"
      : entities.target_index === 1 || entities.target === "right" || entities.target === "strip:1"
        ? lang === "ru"
          ? " на второй (правой) ленте"
          : " on the second (right) strip"
        : entities.target_index != null
          ? lang === "ru"
            ? ` на ленте ${entities.target_index + 1}`
            : ` on strip ${entities.target_index + 1}`
          : entities.target && entities.target !== "all"
            ? lang === "ru"
              ? ` на «${entities.target}»`
              : ` on ${entities.target}`
            : lang === "ru"
              ? " на обеих лентах"
              : " on both strips"

  const effectLabel =
    lang === "ru"
      ? EFFECT_RU[entities.effect || ""] || entities.effect || "эффект"
      : entities.effect || "effect"

  if (lang === "ru") {
    switch (intent) {
      case "lights_on":
        return `Готово. Включила свет${tgt}.`
      case "lights_off":
        return `Готово. Выключила свет${tgt}.`
      case "toggle":
        return `Готово. Переключила свет${tgt}.`
      case "set_brightness":
        if (entities.brightness != null) {
          return `Готово. Поставила яркость${tgt} на ${entities.brightness} процентов.`
        }
        if (entities.relative != null && entities.relative > 0) {
          return `Готово. Сделала ярче${tgt}.`
        }
        if (entities.relative != null && entities.relative < 0) {
          return `Готово. Сделала тусклее${tgt}.`
        }
        return `Готово. Изменила яркость${tgt}.`
      case "set_color":
        return `Готово. Поставила цвет${tgt}: ${entities.color_name || "выбранный"}.`
      case "set_effect":
        return `Готово. Включила эффект «${effectLabel}»${tgt}.`
      case "set_speed":
        return `Готово. Поставила скорость${tgt} на ${entities.speed} процентов.`
      case "activate_scene":
        return `Готово. Активировала сцену${detail ? ` «${detail}»` : ""}.`
      case "run_automation":
        return `Готово. Запустила автоматизацию${detail ? ` «${detail}»` : ""}.`
      case "run_script":
        return `Готово. Запустила скрипт${detail ? ` «${detail}»` : ""}.`
      case "greeting":
        return `${who} на связи. Чем помочь?`
      case "help":
        return `Я ${who}. Могу включать и выключать свет, менять яркость, цвет и эффекты, запускать сцены и правила. Скажите «Алекса» или «Света» и команду.`
      case "status":
        return "Я на связи, умный дом отвечает."
      default:
        return "Не поняла. Например: «Света, яркость 100» или «Алекса, сделай радугу»."
    }
  }

  switch (intent) {
    case "lights_on":
      return `Done. I turned the lights on${tgt}.`
    case "lights_off":
      return `Done. I turned the lights off${tgt}.`
    case "toggle":
      return `Done. I toggled the lights${tgt}.`
    case "set_brightness":
      return entities.brightness != null
        ? `Done. I set brightness${tgt} to ${entities.brightness} percent.`
        : `Done. I adjusted brightness${tgt}.`
    case "set_color":
      return `Done. I set the color${tgt} to ${entities.color_name || "that"}.`
    case "set_effect":
      return `Done. I set the ${effectLabel} effect${tgt}.`
    case "set_speed":
      return `Done. I set speed${tgt} to ${entities.speed} percent.`
    case "activate_scene":
      return `Done. I activated scene${detail ? ` ${detail}` : ""}.`
    case "run_automation":
      return `Done. I ran automation${detail ? ` ${detail}` : ""}.`
    case "run_script":
      return `Done. I ran script${detail ? ` ${detail}` : ""}.`
    case "greeting":
      return `${who} here. How can I help?`
    case "help":
      return `I'm ${who}. I can control lights, brightness, color, effects, scenes and rules. Say Alexa or Sveta plus a command.`
    case "status":
      return "I'm online and the home is reachable."
    default:
      return "I didn't catch that. Try 'Sveta, brightness 100' or 'Alexa, rainbow'."
  }
}
