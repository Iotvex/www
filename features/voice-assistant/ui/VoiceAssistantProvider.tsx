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
  playBase64Mp3Async,
  prepareSpeakerElement,
  speakFallbackAsync,
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

function commandFingerprint(text: string): string {
  const { cleaned } = stripWakeWord(text)
  return cleaned
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
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
  const wantListenRef = useRef(false)
  const recRef = useRef<SpeechRecognition | null>(null)
  const restartTimer = useRef<number | null>(null)
  const commandTimer = useRef<number | null>(null)
  const processingRef = useRef(false)
  const mutedUntilRef = useRef(0)
  const lastFpRef = useRef("")
  const lastFpAtRef = useRef(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastAudioB64 = useRef<string | null>(null)
  const levelDecayRef = useRef<number | null>(null)
  const startRecognitionRef = useRef<() => void>(() => undefined)

  const setListenMode = useCallback((m: ListenMode) => {
    modeRef.current = m
    setMode(m)
  }, [])

  const muteMicUntil = useCallback((ms: number) => {
    mutedUntilRef.current = Math.max(mutedUntilRef.current, Date.now() + ms)
  }, [])

  const clearMicMute = useCallback(() => {
    mutedUntilRef.current = 0
  }, [])

  const pulseLevel = useCallback((strength = 0.55) => {
    setLevel(Math.min(1, strength))
    if (levelDecayRef.current != null) window.clearTimeout(levelDecayRef.current)
    levelDecayRef.current = window.setTimeout(() => setLevel(0), 280)
  }, [])

  const unlockSpeaker = useCallback(() => {
    if (!audioRef.current) audioRef.current = new Audio()
    prepareSpeakerElement(audioRef.current)
    unlockAudio(audioRef.current)
    setSpeakerReady("ready")
  }, [])

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

  const playReply = useCallback(
    async (text: string, lang: string, audioB64?: string | null) => {
      setSpeaking(true)
      setReply(text)
      unlockSpeaker()
      const el = audioRef.current
      try {
        if (audioB64 && el) {
          lastAudioB64.current = audioB64
          setLastAudioAvailable(true)
          await playBase64Mp3Async(el, audioB64)
        } else {
          await speakFallbackAsync(text, lang)
        }
      } catch {
        await speakFallbackAsync(text, lang)
      } finally {
        setSpeaking(false)
      }
    },
    [unlockSpeaker],
  )

  const resumeListening = useCallback(() => {
    if (!wantListenRef.current) return
    // Clear the long busy mute, then apply a short echo gap
    clearMicMute()
    muteMicUntil(700)
    setListenMode("wake")
    setHint("Слушаю. Скажите «Алекса» или «Света» и команду")
    window.setTimeout(() => {
      if (!wantListenRef.current || modeRef.current === "off") return
      startRecognitionRef.current()
    }, 350)
  }, [clearMicMute, muteMicUntil, setListenMode])

  const runCommand = useCallback(
    async (text: string) => {
      const cleaned = text.trim()
      if (!cleaned || processingRef.current) return
      if (modeRef.current === "off") return

      const fp = commandFingerprint(cleaned)
      if (!fp) return
      // Block repeats of the same command (echo / double final)
      if (fp === lastFpRef.current && Date.now() - lastFpAtRef.current < 5000) {
        return
      }

      lastFpRef.current = fp
      lastFpAtRef.current = Date.now()
      processingRef.current = true
      setListenMode("busy")
      setHint("Выполняю…")
      setHeard(cleaned)
      // Stop mic while we work + speak — prevents earpiece mode & self-echo repeats
      stopRecognition()
      muteMicUntil(30_000)
      unlockSpeaker()

      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cleaned, include_audio: true }),
        })
        const data = (await res.json()) as AssistantResponse
        const next =
          data.reply ||
          data.error ||
          (data.lang === "en" ? "Done." : "Готово.")
        setHint(next)
        await playReply(next, data.lang === "en" ? "en" : "ru", data.audio_b64)
      } catch (e) {
        const msg = `Ошибка: ${String(e)}`
        setHint(msg)
        await playReply("Не удалось выполнить команду", "ru", null)
      } finally {
        processingRef.current = false
        lastFpAtRef.current = Date.now()
        resumeListening()
      }
    },
    [
      muteMicUntil,
      playReply,
      resumeListening,
      setListenMode,
      stopRecognition,
      unlockSpeaker,
    ],
  )

  const handleTranscript = useCallback(
    (raw: string, isFinal: boolean) => {
      if (Date.now() < mutedUntilRef.current) return
      if (
        modeRef.current === "busy" ||
        modeRef.current === "off" ||
        processingRef.current
      ) {
        return
      }

      const text = raw.trim()
      if (!text) return
      setHeard(text)
      pulseLevel(isFinal ? 0.75 : 0.45)

      const m = modeRef.current

      if (m === "wake") {
        if (!hasWakeWord(text)) return
        const { cleaned: after } = stripWakeWord(text)
        // Only execute on final results — interim often double-fires the same phrase
        if (after.length >= 2) {
          if (!isFinal) {
            setHint("Слушаю…")
            return
          }
          void runCommand(text)
          return
        }
        if (!isFinal) return
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

  const startRecognition = useCallback(() => {
    const Ctor = SpeechRecognitionCtor()
    if (!Ctor) {
      setSupported(false)
      setHint("Нужен Chrome / Edge с микрофоном")
      return
    }
    if (!wantListenRef.current) return
    if (processingRef.current || modeRef.current === "busy") return

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
        for (let a = 0; a < r.length; a++) {
          const t = r[a]?.transcript || ""
          if (hasWakeWord(t)) {
            if (r.isFinal) altWake = t
            else if (!altWake) altWake = t
          }
        }
      }
      const prefer = altWake && hasWakeWord(altWake) ? altWake : null
      if (finalText) {
        handleTranscript(prefer && hasWakeWord(prefer) ? prefer : finalText, true)
      } else if (interim) {
        handleTranscript(prefer || interim, false)
      }
    }

    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        wantListenRef.current = false
        setListenMode("off")
        setMicPermission("denied")
        setHint("Разрешите микрофон в настройках браузера")
        return
      }
      // aborted is expected when we stop for TTS
      if (ev.error === "aborted") return
      if (wantListenRef.current && modeRef.current !== "off" && modeRef.current !== "busy") {
        restartTimer.current = window.setTimeout(() => {
          if (wantListenRef.current && modeRef.current !== "busy") {
            startRecognitionRef.current()
          }
        }, 400)
      }
    }

    rec.onend = () => {
      if (!wantListenRef.current) return
      if (modeRef.current === "off" || modeRef.current === "busy" || processingRef.current) {
        return
      }
      restartTimer.current = window.setTimeout(() => {
        if (!wantListenRef.current) return
        if (modeRef.current === "off" || modeRef.current === "busy") return
        try {
          rec.start()
        } catch {
          startRecognitionRef.current()
        }
      }, 220)
    }

    recRef.current = rec
    try {
      rec.start()
    } catch {
      /* already started */
    }
  }, [handleTranscript, setListenMode, stopRecognition])

  startRecognitionRef.current = startRecognition

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
    if (perm !== "granted") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        // Release immediately — keeping the stream open forces phone earpiece / call mode
        stream.getTracks().forEach((t) => t.stop())
        setMicPermission("granted")
      } catch {
        setHint("Разрешите микрофон в браузере")
        setMicPermission("denied")
        setListenMode("off")
        wantListenRef.current = false
        return
      }
    }
    window.speechSynthesis?.getVoices()
    wantListenRef.current = true
    setListenMode("wake")
    setHint("Слушаю. Скажите «Алекса» или «Света» и команду")
    startRecognition()
  }, [setListenMode, startRecognition, unlockSpeaker])

  const disable = useCallback(() => {
    wantListenRef.current = false
    setListenMode("off")
    setHint("Микрофон выключен")
    setLevel(0)
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
    unlockSpeaker()
    setDraft("")
    void runCommand(hasWakeWord(t) ? t : `Алекса ${t}`)
  }, [draft, runCommand, unlockSpeaker])

  const replayLast = useCallback(() => {
    if (!lastAudioB64.current) return
    if (!audioRef.current) audioRef.current = new Audio()
    unlockSpeaker()
    void playBase64Mp3Async(audioRef.current, lastAudioB64.current)
  }, [unlockSpeaker])

  useEffect(() => {
    setSupported(Boolean(SpeechRecognitionCtor()))
    audioRef.current = new Audio()
    prepareSpeakerElement(audioRef.current)
    void refreshPermissions()
    return () => {
      wantListenRef.current = false
      stopRecognition()
      if (levelDecayRef.current != null) window.clearTimeout(levelDecayRef.current)
      if (commandTimer.current) window.clearTimeout(commandTimer.current)
    }
  }, [refreshPermissions, stopRecognition])

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
