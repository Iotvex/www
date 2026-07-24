export type ListenMode = "off" | "wake" | "command" | "busy"

export type MicPermission = "unknown" | "granted" | "denied" | "prompt"
export type SpeakerReady = "unknown" | "locked" | "ready"

export type VoiceAssistantState = {
  mode: ListenMode
  supported: boolean
  hint: string
  heard: string
  reply: string
  draft: string
  speaking: boolean
  level: number
  micPermission: MicPermission
  speakerReady: SpeakerReady
  lastAudioAvailable: boolean
}
