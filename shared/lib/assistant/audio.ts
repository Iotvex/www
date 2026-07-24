/** Silent WAV — unlocks mobile audio playback after a user gesture. */
export const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"

export function unlockAudio(audioEl: HTMLAudioElement | null) {
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

export function playBase64Mp3(
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
    onDone?.()
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
    const prefer =
      voices.find((v) =>
        lang === "en" ? /en/i.test(v.lang) : /ru/i.test(v.lang),
      ) || null
    if (prefer) u.voice = prefer
    u.onend = () => onDone?.()
    u.onerror = () => onDone?.()
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
