"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Mic, MicOff, Loader2 } from "lucide-react"
import { cn } from "@/shared/lib/utils"

type ListenMode = "off" | "wake" | "command" | "busy"

type AssistantResponse = {
  reply?: string
  intent?: string
  confidence?: number
  lang?: string
  error?: string
  actions?: Array<{ success?: boolean; detail?: string }>
}

const WAKE_RE = /\b(алекс[аеуойы]?|alexa)\b/i

function SpeechRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition
    webkitSpeechRecognition?: new () => SpeechRecognition
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang === "en" ? "en-US" : "ru-RU"
  u.rate = 1.05
  const voices = window.speechSynthesis.getVoices()
  const prefer = voices.find((v) =>
    lang === "en"
      ? /en(-|_)US/i.test(v.lang) && /female|zira|jenny|samantha/i.test(v.name)
      : /ru/i.test(v.lang) && /female|milena|irina|elena|tatyana|svetlana/i.test(v.name),
  ) || voices.find((v) => (lang === "en" ? /en/i.test(v.lang) : /ru/i.test(v.lang)))
  if (prefer) u.voice = prefer
  window.speechSynthesis.speak(u)
}

export function AlexaListener() {
  const [mode, setMode] = useState<ListenMode>("off")
  const [supported, setSupported] = useState(true)
  const [hint, setHint] = useState("Скажите «Алекса»")
  const [lastReply, setLastReply] = useState("")
  const modeRef = useRef<ListenMode>("off")
  const recRef = useRef<SpeechRecognition | null>(null)
  const restartTimer = useRef<number | null>(null)
  const commandTimer = useRef<number | null>(null)
  const processingRef = useRef(false)

  const setListenMode = useCallback((m: ListenMode) => {
    modeRef.current = m
    setMode(m)
  }, [])

  const runCommand = useCallback(async (text: string) => {
    if (processingRef.current) return
    processingRef.current = true
    setListenMode("busy")
    setHint("Выполняю…")
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, include_audio: false }),
      })
      const data = (await res.json()) as AssistantResponse
      const reply = data.reply || data.error || "Готово."
      setLastReply(reply)
      setHint(reply)
      speak(reply, data.lang === "en" ? "en" : "ru")
    } catch (e) {
      const msg = `Ошибка: ${String(e)}`
      setLastReply(msg)
      setHint(msg)
      speak("Не удалось выполнить команду", "ru")
    } finally {
      processingRef.current = false
      setListenMode("wake")
      setHint("Слушаю. Скажите «Алекса»")
    }
  }, [setListenMode])

  const handleTranscript = useCallback(
    (raw: string, isFinal: boolean) => {
      const text = raw.trim()
      if (!text) return
      const m = modeRef.current

      if (m === "wake") {
        if (!WAKE_RE.test(text)) return
        const after = text.replace(WAKE_RE, " ").replace(/^[,\s.!:;-]+/, "").trim()
        // Same utterance already has a command
        if (after.length >= 2 && (isFinal || after.split(/\s+/).length >= 2)) {
          void runCommand(text)
          return
        }
        setListenMode("command")
        setHint("Слушаю команду…")
        speak("Слушаю", "ru")
        if (commandTimer.current) window.clearTimeout(commandTimer.current)
        commandTimer.current = window.setTimeout(() => {
          if (modeRef.current === "command") {
            setListenMode("wake")
            setHint("Скажите «Алекса»")
          }
        }, 8000)
        return
      }

      if (m === "command" && isFinal) {
        if (commandTimer.current) window.clearTimeout(commandTimer.current)
        // Ignore bare wake word repeats
        if (WAKE_RE.test(text) && text.replace(WAKE_RE, "").trim().length < 2) {
          setHint("Слушаю команду…")
          return
        }
        void runCommand(text)
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
    try {
      rec?.stop()
    } catch {
      /* ignore */
    }
  }, [])

  const startRecognition = useCallback(() => {
    const Ctor = SpeechRecognitionCtor()
    if (!Ctor) {
      setSupported(false)
      setHint("Голосовой ввод не поддерживается в этом браузере (нужен Chrome)")
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
      // not-allowed / service-not-allowed → stop; no-speech/aborted → restart
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setListenMode("off")
        setHint("Нужен доступ к микрофону")
        return
      }
      if (modeRef.current !== "off") {
        restartTimer.current = window.setTimeout(() => {
          if (modeRef.current !== "off") startRecognition()
        }, 400)
      }
    }

    rec.onend = () => {
      if (modeRef.current === "off" || modeRef.current === "busy") return
      restartTimer.current = window.setTimeout(() => {
        if (modeRef.current === "wake" || modeRef.current === "command") {
          try {
            rec.start()
          } catch {
            startRecognition()
          }
        }
      }, 250)
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
      return
    }
    // Warm voices list
    window.speechSynthesis?.getVoices()
    setListenMode("wake")
    setHint("Слушаю. Скажите «Алекса»")
    startRecognition()
  }, [setListenMode, startRecognition])

  const disable = useCallback(() => {
    setListenMode("off")
    setHint("Микрофон выключен")
    stopRecognition()
    window.speechSynthesis?.cancel()
  }, [setListenMode, stopRecognition])

  const toggle = useCallback(() => {
    if (mode === "off") void enable()
    else disable()
  }, [mode, enable, disable])

  useEffect(() => {
    setSupported(Boolean(SpeechRecognitionCtor()))
    return () => {
      stopRecognition()
      if (commandTimer.current) window.clearTimeout(commandTimer.current)
    }
  }, [stopRecognition])

  // Auto-start once per session after first visit (user gesture still needed on many browsers —
  // we start on first click; also try resume if permission already granted)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const perms = await navigator.permissions?.query({ name: "microphone" as PermissionName })
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
      {(listening || busy || lastReply) && (
        <div
          className={cn(
            "pointer-events-none max-w-[min(18rem,70vw)] rounded-2xl border border-white/10",
            "bg-background/90 px-3 py-2 text-right text-[12px] leading-snug text-foreground/85 shadow-lg backdrop-blur-md",
          )}
        >
          <p className="font-medium text-foreground/95">
            {commanding ? "Алекса слушает…" : busy ? "Алекса" : "Алекса"}
          </p>
          <p className="mt-0.5 text-foreground/65">{hint}</p>
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        disabled={!supported}
        title={supported ? "Алекса — постоянное прослушивание" : "Нужен Chrome / Edge"}
        className={cn(
          "pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full",
          "border border-white/15 shadow-lg transition active:scale-95",
          mode === "off" && "bg-zinc-900/90 text-foreground/80 hover:bg-zinc-800",
          listening && !commanding && "bg-emerald-600/90 text-white",
          commanding && "bg-sky-500 text-white",
          busy && "bg-amber-500/90 text-white",
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
