/** Media playback helpers — keep loudspeaker path (no call/earpiece mode). */

/** Silent WAV — unlocks mobile audio playback after a user gesture. */
export const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"

export function prepareSpeakerElement(audioEl: HTMLAudioElement | null) {
  if (!audioEl) return
  try {
    audioEl.setAttribute("playsinline", "true")
    audioEl.setAttribute("webkit-playsinline", "true")
    audioEl.preload = "auto"
    // Prefer media / default route (loudspeaker), not communication/earpiece.
    const el = audioEl as HTMLAudioElement & {
      setSinkId?: (id: string) => Promise<void>
    }
    if (typeof el.setSinkId === "function") {
      void el.setSinkId("default").catch(() => undefined)
    }
  } catch {
    /* ignore */
  }
}

export function unlockAudio(audioEl: HTMLAudioElement | null) {
  if (!audioEl) return
  prepareSpeakerElement(audioEl)
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
  try {
    if (typeof window !== "undefined" && window.speechSynthesis) {
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

/** Play MP3 via HTMLAudioElement (media session → loudspeaker when mic is free). */
export function playBase64Mp3(
  audioEl: HTMLAudioElement,
  b64: string,
  onDone?: () => void,
): void {
  prepareSpeakerElement(audioEl)
  const url = `data:audio/mpeg;base64,${b64}`
  let settled = false
  const finish = () => {
    if (settled) return
    settled = true
    onDone?.()
  }
  audioEl.onended = () => finish()
  audioEl.onerror = () => finish()
  audioEl.src = url
  audioEl.volume = 1
  void audioEl.play().catch(() => finish())
}

export function playBase64Mp3Async(
  audioEl: HTMLAudioElement,
  b64: string,
): Promise<void> {
  return new Promise((resolve) => {
    playBase64Mp3(audioEl, b64, () => resolve())
  })
}

export function speakFallback(text: string, lang: string, onDone?: () => void) {
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
    // Prefer a named female neural-ish voice when the browser exposes it
    const prefer =
      voices.find((v) =>
        lang === "en"
          ? /en/i.test(v.lang) && /aria|jenny|emma|female/i.test(v.name)
          : /ru/i.test(v.lang) && /dariya|daria|milena|irene|female/i.test(v.name),
      ) ||
      voices.find((v) => (lang === "en" ? /en/i.test(v.lang) : /ru/i.test(v.lang))) ||
      null
    if (prefer) u.voice = prefer
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      onDone?.()
    }
    u.onend = () => finish()
    u.onerror = () => finish()
    const tick = window.setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        window.clearInterval(tick)
        return
      }
      window.speechSynthesis.resume()
    }, 250)
    window.speechSynthesis.speak(u)
    window.speechSynthesis.resume()
    // Safety: never hang forever
    window.setTimeout(finish, Math.min(20_000, 1200 + text.length * 90))
  } catch {
    onDone?.()
  }
}

export function speakFallbackAsync(text: string, lang: string): Promise<void> {
  return new Promise((resolve) => speakFallback(text, lang, () => resolve()))
}
