"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { hasWakeWord, stripWakeWord } from "@/shared/lib/assistant/wake"
import {
  playBase64Mp3,
  speakFallback,
  unlockAudio,
} from "@/shared/lib/assistant/audio"
import type {
  ListenMode,
  MicPermission,
  SpeakerReady,
  VoiceAssistantState,
} from "@/features/voice-assistant/model/types"

type AssistantResponse = {
  reply?: string
  intent?: string
  confidence?: number
  lang?: string
  error?: string
  audio_b64?: string | null
  actions?: Array<{ success?: boolean; detail?: string }>
}

type VoiceAssistantApi = VoiceAssistantState & {
  enable: () => Promise<void>
  disable: () => void
  toggle: () => void
  setDraft: (v: string) => void
  submitDraft: () => void
  replayLast: () => void
  unlockSpeaker: () => void
  refreshPermissions: () => Promise<void>
  requestMicPermission: () => Promise<void>
}

const VoiceCtx = createContext<VoiceAssistantApi | null>(null)

function SpeechRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognition
    webkitSpeechRecognition?: new () => SpeechRecognition
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

async function queryMicPermission(): Promise<MicPermission> {
  try {
    const perms = await navigator.permissions?.query({
      name: "microphone" as PermissionName,
    })
    if (!perms) return "unknown"
    if (perms.state === "granted") return "granted"
    if (perms.state === "denied") return "denied"
    return "prompt"
  } catch {
    return "unknown"
  }
}

export function VoiceAssistantProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ListenMode>("off")
  const [supported, setSupported] = useState(true)
  const [hint, setHint] = useState("Нажмите кнопку и скажите «Алекса» или «Света»")
  const [heard, setHeard] = useState("")
  const [reply, setReply] = useState("")
  const [draft, setDraft] = useState("")
  const [speaking, setSpeaking] = useState(false)
  const [level, setLevel] = useState(0)
  const [micPermission, setMicPermission] = useState<MicPermission>("unknown")
  const [speakerReady, setSpeakerReady] = useState<SpeakerReady>("unknown")
  const [lastAudioAvailable, setLastAudioAvailable] = useState(false)

  const modeRef = useRef<ListenMode>("off")
  const recRef = useRef<SpeechRecognition | null>(null)
  const restartTimer = useRef<number | null>(null)
  const commandTimer = useRef<number | null>(null)
  const processingRef = useRef(false)
  const mutedUntilRef = useRef(0)
  const lastSentRef = useRef("")
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastAudioB64 = useRef<string | null>(null)
  const levelDecayRef = useRef<number | null>(null)
  const meterStreamRef = useRef<MediaStream | null>(null)
  const meterCtxRef = useRef<AudioContext | null>(null)
  const meterRafRef = useRef<number | null>(null)

  const setListenMode = useCallback((m: ListenMode) => {
    modeRef.current = m
    setMode(m)
  }, [])

  const muteMicBriefly = useCallback((ms: number) => {
    mutedUntilRef.current = Date.now() + ms
  }, [])

  const stopMeter = useCallback(() => {
    if (meterRafRef.current != null) {
      cancelAnimationFrame(meterRafRef.current)
      meterRafRef.current = null
    }
    if (levelDecayRef.current != null) {
      window.clearTimeout(levelDecayRef.current)
      levelDecayRef.current = null
    }
    try {
      meterStreamRef.current?.getTracks().forEach((t) => t.stop())
    } catch {
      /* ignore */
    }
    meterStreamRef.current = null
    try {
      void meterCtxRef.current?.close()
    } catch {
      /* ignore */
    }
    meterCtxRef.current = null
    setLevel(0)
  }, [])

  const startMeter = useCallback(async () => {
    stopMeter()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      meterStreamRef.current = stream
      const ctx = new AudioContext()
      meterCtxRef.current = ctx
      if (ctx.state === "suspended") await ctx.resume()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.65
      source.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteFrequencyData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i]
        setLevel(Math.min(1, (sum / data.length / 255) * 2.4))
        meterRafRef.current = requestAnimationFrame(tick)
      }
      meterRafRef.current = requestAnimationFrame(tick)
    } catch {
      /* metering optional — speech pulse still works */
    }
  }, [stopMeter])

  const pulseLevel = useCallback((strength = 0.55) => {
    // Prefer live analyser when available
    if (meterStreamRef.current) return
    setLevel(Math.min(1, strength))
    if (levelDecayRef.current != null) window.clearTimeout(levelDecayRef.current)
    levelDecayRef.current = window.setTimeout(() => setLevel(0), 280)
  }, [])

  const unlockSpeaker = useCallback(() => {
    if (!audioRef.current) audioRef.current = new Audio()
    unlockAudio(audioRef.current)
    setSpeakerReady("ready")
  }, [])

  const playReply = useCallback(
    (text: string, lang: string, audioB64?: string | null) => {
      setSpeaking(true)
      setReply(text)
      const done = () => {
        setSpeaking(false)
        muteMicBriefly(500)
      }
      const el = audioRef.current
      if (audioB64 && el) {
        lastAudioB64.current = audioB64
        setLastAudioAvailable(true)
        muteMicBriefly(12_000)
        el.onended = () => done()
        el.onerror = () => speakFallback(text, lang, done)
        el.src = `data:audio/mpeg;base64,${audioB64}`
        el.volume = 1
        void el.play().catch(() => {
          setSpeakerReady("locked")
          speakFallback(text, lang, done)
        })
        return
      }
      muteMicBriefly(Math.min(12_000, 900 + text.length * 70))
      speakFallback(text, lang, done)
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
      muteMicBriefly(15_000)
      unlockSpeaker()
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cleaned, include_audio: true }),
        })
        const data = (await res.json()) as AssistantResponse
        const next = data.reply || data.error || "Готово."
        setHint(next)
        playReply(next, data.lang === "en" ? "en" : "ru", data.audio_b64)
      } catch (e) {
        const msg = `Ошибка: ${String(e)}`
        setHint(msg)
        playReply("Не удалось выполнить команду", "ru", null)
      } finally {
        processingRef.current = false
        setListenMode("wake")
      }
    },
    [muteMicBriefly, playReply, setListenMode, unlockSpeaker],
  )

  const handleTranscript = useCallback(
    (raw: string, isFinal: boolean) => {
      if (Date.now() < mutedUntilRef.current) return
      if (modeRef.current === "busy" || modeRef.current === "off") return

      const text = raw.trim()
      if (!text) return
      setHeard(text)
      pulseLevel(isFinal ? 0.75 : 0.45)

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
    [pulseLevel, runCommand, setListenMode],
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
    rec.maxAlternatives = 3

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ""
      let finalText = ""
      let altWake: string | null = null
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]
        const primary = r[0]?.transcript || ""
        if (r.isFinal) finalText += primary
        else interim += primary
        // Check alternatives for wake word (ASR often mishears it)
        for (let a = 0; a < r.length; a++) {
          const t = r[a]?.transcript || ""
          if (hasWakeWord(t)) {
            if (r.isFinal) altWake = t
            else if (!altWake) altWake = t
          }
        }
      }
      const prefer = altWake && hasWakeWord(altWake) ? altWake : null
      if (finalText) handleTranscript(prefer && hasWakeWord(prefer) ? prefer : finalText, true)
      else if (interim) handleTranscript(prefer || interim, false)
    }

    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setListenMode("off")
        setMicPermission("denied")
        setHint("Разрешите микрофон в настройках браузера")
        stopMeter()
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
  }, [handleTranscript, setListenMode, stopMeter, stopRecognition])

  const refreshPermissions = useCallback(async () => {
    setMicPermission(await queryMicPermission())
  }, [])

  const requestMicPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      setMicPermission("granted")
      setHint("Микрофон разрешён")
    } catch {
      setMicPermission("denied")
      setHint("Разрешите микрофон в браузере")
    }
  }, [])

  const enable = useCallback(async () => {
    unlockSpeaker()
    const perm = await queryMicPermission()
    setMicPermission(perm)
    // Only prompt getUserMedia when permission is not already granted —
    // avoids re-nagging on hard reload / when user re-enables.
    if (perm !== "granted") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((t) => t.stop())
        setMicPermission("granted")
      } catch {
        setHint("Разрешите микрофон в браузере")
        setMicPermission("denied")
        setListenMode("off")
        return
      }
    }
    window.speechSynthesis?.getVoices()
    setListenMode("wake")
    setHint("Слушаю. Скажите «Алекса» или «Света» и команду")
    void startMeter()
    startRecognition()
  }, [setListenMode, startMeter, startRecognition, unlockSpeaker])

  const disable = useCallback(() => {
    setListenMode("off")
    setHint("Микрофон выключен")
    stopRecognition()
    stopMeter()
    window.speechSynthesis?.cancel()
    try {
      audioRef.current?.pause()
    } catch {
      /* ignore */
    }
  }, [setListenMode, stopMeter, stopRecognition])

  const toggle = useCallback(() => {
    if (mode === "off") void enable()
    else disable()
  }, [mode, enable, disable])

  const submitDraft = useCallback(() => {
    const t = draft.trim()
    if (!t) return
    unlockSpeaker()
    setDraft("")
    void runCommand(hasWakeWord(t) ? t : `Алекса ${t}`)
  }, [draft, runCommand, unlockSpeaker])

  const replayLast = useCallback(() => {
    if (!lastAudioB64.current) return
    if (!audioRef.current) audioRef.current = new Audio()
    unlockSpeaker()
    playBase64Mp3(audioRef.current, lastAudioB64.current)
  }, [unlockSpeaker])

  useEffect(() => {
    setSupported(Boolean(SpeechRecognitionCtor()))
    audioRef.current = new Audio()
    void refreshPermissions()
    return () => {
      stopRecognition()
      stopMeter()
      if (commandTimer.current) window.clearTimeout(commandTimer.current)
    }
  }, [refreshPermissions, stopMeter, stopRecognition])

  // Never auto-start listening on reload — user must tap the FAB or enable on the Assistant page.

  const api = useMemo<VoiceAssistantApi>(
    () => ({
      mode,
      supported,
      hint,
      heard,
      reply,
      draft,
      speaking,
      level,
      micPermission,
      speakerReady,
      lastAudioAvailable,
      enable,
      disable,
      toggle,
      setDraft,
      submitDraft,
      replayLast,
      unlockSpeaker,
      refreshPermissions,
      requestMicPermission,
    }),
    [
      mode,
      supported,
      hint,
      heard,
      reply,
      draft,
      speaking,
      level,
      micPermission,
      speakerReady,
      lastAudioAvailable,
      enable,
      disable,
      toggle,
      submitDraft,
      replayLast,
      unlockSpeaker,
      refreshPermissions,
      requestMicPermission,
    ],
  )

  return <VoiceCtx.Provider value={api}>{children}</VoiceCtx.Provider>
}

export function useVoiceAssistant(): VoiceAssistantApi {
  const ctx = useContext(VoiceCtx)
  if (!ctx) {
    throw new Error("useVoiceAssistant must be used within VoiceAssistantProvider")
  }
  return ctx
}
