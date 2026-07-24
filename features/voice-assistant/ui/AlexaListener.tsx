"use client"

import { hasWakeWord, stripWakeWord } from "@/shared/lib/assistant/wake"
import { useCallback, useEffect, useRef, useState } from "react"
import { Mic, MicOff, Loader2, Send, Volume2 } from "lucide-react"
import { cn } from "@/shared/lib/utils"

type ListenMode = "off" | "wake" | "command" | "busy"

type AssistantResponse = {
  reply?: string
  intent?: string
  confidence?: number
  lang?: string
  error?: string
  audio_b64?: string | null
  actions?: Array<{ success?: boolean; detail?: string }>
}

function SpeechRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition
    webkitSpeechRecognition?: new () => SpeechRecognition
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

/** Silent WAV — unlocks mobile audio playback after a user gesture. */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"

function unlockAudio(audioEl: HTMLAudioElement | null) {
  if (!audioEl) return
  try {
    audioEl.src = SILENT_WAV
    audioEl.volume = 0.01
    void audioEl.play().then(() => {
      audioEl.pause()
      audioEl.currentTime = 0
      audioEl.volume = 1
    })
  } catch {
    /* ignore */
  }
  // Also nudge Web Speech for desktop browsers
  try {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(" ")
      u.volume = 0
      window.speechSynthesis.speak(u)
      window.speechSynthesis.cancel()
    }
  } catch {
    /* ignore */
  }
}

function playBase64Mp3(
  audioEl: HTMLAudioElement,
  b64: string,
  onDone?: () => void,
): void {
  const url = `data:audio/mpeg;base64,${b64}`
  audioEl.onended = () => onDone?.()
  audioEl.onerror = () => onDone?.()
  audioEl.src = url
  audioEl.volume = 1
  void audioEl.play().catch(() => {
    // Fallback: Web Speech (often blocked on phones after async fetch)
    onDone?.()
  })
}

function speakFallback(text: string, lang: string, onDone?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onDone?.()
    return
  }
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang === "en" ? "en-US" : "ru-RU"
    u.rate = 1.02
    const voices = window.speechSynthesis.getVoices()
    const prefer =
      voices.find((v) =>
        lang === "en" ? /en/i.test(v.lang) : /ru/i.test(v.lang),
      ) || null
    if (prefer) u.voice = prefer
    u.onend = () => onDone?.()
    u.onerror = () => onDone?.()
    // Chrome bug: resume while speaking
    const tick = window.setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        window.clearInterval(tick)
        return
      }
      window.speechSynthesis.resume()
    }, 250)
    window.speechSynthesis.speak(u)
    window.speechSynthesis.resume()
  } catch {
    onDone?.()
  }
}

export function AlexaListener() {
  const [mode, setMode] = useState<ListenMode>("off")
  const [supported, setSupported] = useState(true)
  const [hint, setHint] = useState("Нажмите микрофон и скажите «Алекса» или «Света»")
  const [heard, setHeard] = useState("")
  const [draft, setDraft] = useState("")
  const [panelOpen, setPanelOpen] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const modeRef = useRef<ListenMode>("off")
  const recRef = useRef<SpeechRecognition | null>(null)
  const restartTimer = useRef<number | null>(null)
  const commandTimer = useRef<number | null>(null)
  const processingRef = useRef(false)
  const mutedUntilRef = useRef(0)
  const lastSentRef = useRef("")
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastAudioB64 = useRef<string | null>(null)

  const setListenMode = useCallback((m: ListenMode) => {
    modeRef.current = m
    setMode(m)
  }, [])

  const muteMicBriefly = useCallback((ms: number) => {
    mutedUntilRef.current = Date.now() + ms
  }, [])

  const playReply = useCallback(
    (reply: string, lang: string, audioB64?: string | null) => {
      setSpeaking(true)
      const done = () => {
        setSpeaking(false)
        muteMicBriefly(500)
      }
      const el = audioRef.current
      if (audioB64 && el) {
        lastAudioB64.current = audioB64
        muteMicBriefly(12_000)
        const url = `data:audio/mpeg;base64,${audioB64}`
        el.onended = () => done()
        el.onerror = () => speakFallback(reply, lang, done)
        el.src = url
        el.volume = 1
        void el.play().catch(() => speakFallback(reply, lang, done))
        return
      }
      muteMicBriefly(Math.min(12_000, 900 + reply.length * 70))
      speakFallback(reply, lang, done)
    },
    [muteMicBriefly],
  )

  const runCommand = useCallback(
    async (text: string) => {
      const cleaned = text.trim()
      if (!cleaned || processingRef.current) return
      if (cleaned === lastSentRef.current && Date.now() - mutedUntilRef.current < 1500) return
      lastSentRef.current = cleaned
      processingRef.current = true
      setListenMode("busy")
      setHint("Выполняю…")
      setHeard(cleaned)
      setPanelOpen(true)
      muteMicBriefly(15_000)
      // Re-unlock right before async work (helps some mobile browsers)
      unlockAudio(audioRef.current)
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cleaned, include_audio: true }),
        })
        const data = (await res.json()) as AssistantResponse
        const reply = data.reply || data.error || "Готово."
        setHint(reply)
        playReply(reply, data.lang === "en" ? "en" : "ru", data.audio_b64)
      } catch (e) {
        const msg = `Ошибка: ${String(e)}`
        setHint(msg)
        playReply("Не удалось выполнить команду", "ru", null)
      } finally {
        processingRef.current = false
        setListenMode("wake")
      }
    },
    [muteMicBriefly, playReply, setListenMode],
  )

  const handleTranscript = useCallback(
    (raw: string, isFinal: boolean) => {
      if (Date.now() < mutedUntilRef.current) return
      if (modeRef.current === "busy" || modeRef.current === "off") return

      const text = raw.trim()
      if (!text) return
      setHeard(text)

      const m = modeRef.current

      if (m === "wake") {
        if (!hasWakeWord(text)) return
        const { cleaned: after } = stripWakeWord(text)
        if (after.length >= 2 && (isFinal || after.split(/\s+/).length >= 2)) {
          void runCommand(text)
          return
        }
        setListenMode("command")
        setHint("Слушаю команду…")
        setPanelOpen(true)
        if (commandTimer.current) window.clearTimeout(commandTimer.current)
        commandTimer.current = window.setTimeout(() => {
          if (modeRef.current === "command") {
            setListenMode("wake")
            setHint("Скажите «Алекса» или «Света» и команду")
          }
        }, 10_000)
        return
      }

      if (m === "command") {
        if (!isFinal) return
        if (commandTimer.current) window.clearTimeout(commandTimer.current)
        const { cleaned: after } = stripWakeWord(text)
        if (!after) {
          setHint("Слушаю команду…")
          return
        }
        void runCommand(hasWakeWord(text) ? text : after)
      }
    },
    [runCommand, setListenMode],
  )

  const stopRecognition = useCallback(() => {
    if (restartTimer.current) {
      window.clearTimeout(restartTimer.current)
      restartTimer.current = null
    }
    const rec = recRef.current
    recRef.current = null
    if (!rec) return
    try {
      rec.onresult = null
      rec.onerror = null
      rec.onend = null
      rec.abort()
    } catch {
      /* ignore */
    }
  }, [])

  const startRecognition = useCallback(() => {
    const Ctor = SpeechRecognitionCtor()
    if (!Ctor) {
      setSupported(false)
      setHint("Нужен Chrome / Edge с микрофоном")
      return
    }
    stopRecognition()
    const rec = new Ctor()
    rec.lang = "ru-RU"
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ""
      let finalText = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interim += r[0].transcript
      }
      if (finalText) handleTranscript(finalText, true)
      else if (interim) handleTranscript(interim, false)
    }

    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setListenMode("off")
        setHint("Разрешите микрофон в браузере")
        return
      }
      if (modeRef.current !== "off") {
        restartTimer.current = window.setTimeout(() => {
          if (modeRef.current !== "off") startRecognition()
        }, 350)
      }
    }

    rec.onend = () => {
      if (modeRef.current === "off") return
      restartTimer.current = window.setTimeout(() => {
        if (modeRef.current === "off") return
        try {
          rec.start()
        } catch {
          startRecognition()
        }
      }, 200)
    }

    recRef.current = rec
    try {
      rec.start()
    } catch {
      /* already started */
    }
  }, [handleTranscript, setListenMode, stopRecognition])

  const enable = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
    } catch {
      setHint("Разрешите микрофон в браузере")
      setListenMode("off")
      setPanelOpen(true)
      return
    }
    if (!audioRef.current) audioRef.current = new Audio()
    unlockAudio(audioRef.current)
    window.speechSynthesis?.getVoices()
    setListenMode("wake")
    setHint("Слушаю. Скажите «Алекса» или «Света» и команду")
    setPanelOpen(true)
    startRecognition()
  }, [setListenMode, startRecognition])

  const disable = useCallback(() => {
    setListenMode("off")
    setHint("Микрофон выключен")
    stopRecognition()
    window.speechSynthesis?.cancel()
    try {
      audioRef.current?.pause()
    } catch {
      /* ignore */
    }
  }, [setListenMode, stopRecognition])

  const toggle = useCallback(() => {
    if (mode === "off") void enable()
    else disable()
  }, [mode, enable, disable])

  const submitDraft = useCallback(() => {
    const t = draft.trim()
    if (!t) return
    if (!audioRef.current) audioRef.current = new Audio()
    unlockAudio(audioRef.current)
    setDraft("")
    void runCommand(hasWakeWord(t) ? t : `Алекса ${t}`)
  }, [draft, runCommand])

  const replayLast = useCallback(() => {
    if (!lastAudioB64.current || !audioRef.current) return
    unlockAudio(audioRef.current)
    playBase64Mp3(audioRef.current, lastAudioB64.current)
  }, [])

  useEffect(() => {
    setSupported(Boolean(SpeechRecognitionCtor()))
    audioRef.current = new Audio()
    return () => {
      stopRecognition()
      if (commandTimer.current) window.clearTimeout(commandTimer.current)
    }
  }, [stopRecognition])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const perms = await navigator.permissions?.query({
          name: "microphone" as PermissionName,
        })
        if (!cancelled && perms?.state === "granted" && modeRef.current === "off") {
          await enable()
        }
      } catch {
        /* permissions API may be missing */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enable])

  const listening = mode === "wake" || mode === "command"
  const commanding = mode === "command"
  const busy = mode === "busy"

  return (
    <div
      className={cn(
        "pointer-events-none fixed z-[45] flex flex-col items-end gap-2",
        "right-[max(0.75rem,env(safe-area-inset-right))]",
        "bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:bottom-6",
      )}
    >
      {(panelOpen || listening || busy) && (
        <div
          className={cn(
            "pointer-events-auto w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-white/10",
            "bg-background/95 p-3 text-right shadow-lg backdrop-blur-md",
          )}
        >
          <p className="text-[12px] font-medium text-foreground/95">
            {busy
              ? "Ассистент · выполняю"
              : speaking
                ? "Ассистент · говорит…"
                : commanding
                  ? "Слушаю команду…"
                  : "Алекса / Света"}
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-foreground/70">{hint}</p>
          {heard ? (
            <p className="mt-1 truncate text-[11px] text-foreground/45">«{heard}»</p>
          ) : null}
          <form
            className="mt-2 flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              submitDraft()
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="цвет фиолетовый яркость 30 правая"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-left text-[12px] text-foreground outline-none placeholder:text-foreground/35 focus:border-white/25"
            />
            <button
              type="button"
              onClick={replayLast}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-foreground/80 hover:bg-white/15"
              aria-label="Повторить ответ"
              title="Повторить озвучку"
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="submit"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-foreground/80 hover:bg-white/15"
              aria-label="Отправить"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        disabled={!supported}
        title={supported ? "Алекса / Света — постоянное прослушивание" : "Нужен Chrome / Edge"}
        className={cn(
          "pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full",
          "border border-white/15 shadow-lg transition active:scale-95",
          mode === "off" && "bg-zinc-900/90 text-foreground/80 hover:bg-zinc-800",
          listening && !commanding && "bg-emerald-600/90 text-white",
          commanding && "bg-sky-500 text-white",
          busy && "bg-amber-500/90 text-white",
          speaking && "ring-2 ring-emerald-300/60",
          !supported && "opacity-50",
        )}
      >
        {busy ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : mode === "off" ? (
          <MicOff className="h-6 w-6" />
        ) : (
          <Mic className="h-6 w-6" />
        )}
        {listening && (
          <span
            className={cn(
              "absolute inset-0 -z-10 animate-ping rounded-full opacity-30",
              commanding ? "bg-sky-400" : "bg-emerald-400",
            )}
          />
        )}
      </button>
    </div>
  )
}
