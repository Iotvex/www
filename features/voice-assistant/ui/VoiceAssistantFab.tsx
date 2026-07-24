"use client"

import { useVoiceAssistant } from "@/features/voice-assistant/ui/VoiceAssistantProvider"
import { setView } from "@/entities/nav/model/store"
import { Mic, MicOff, Loader2 } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { useRef } from "react"

export function VoiceAssistantFab() {
  const { mode, supported, speaking, toggle, unlockSpeaker } = useVoiceAssistant()
  const listening = mode === "wake" || mode === "command"
  const commanding = mode === "command"
  const busy = mode === "busy"
  const longPressRef = useRef<number | null>(null)
  const longPressedRef = useRef(false)

  const clearLongPress = () => {
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current)
      longPressRef.current = null
    }
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed z-[45]",
        "right-[max(0.85rem,env(safe-area-inset-right))]",
        "bottom-[calc(4.35rem+env(safe-area-inset-bottom,0px))] md:bottom-7",
      )}
    >
      <button
        type="button"
        disabled={!supported}
        title={
          supported
            ? "Ассистент — нажмите, чтобы слушать. Удерживайте — открыть вкладку."
            : "Нужен Chrome / Edge"
        }
        aria-label="Голосовой ассистент"
        onPointerDown={(e) => {
          if (e.button !== 0) return
          unlockSpeaker()
          longPressedRef.current = false
          clearLongPress()
          longPressRef.current = window.setTimeout(() => {
            longPressedRef.current = true
            setView("assistant")
          }, 550)
        }}
        onPointerUp={clearLongPress}
        onPointerLeave={clearLongPress}
        onPointerCancel={clearLongPress}
        onClick={() => {
          if (longPressedRef.current) {
            longPressedRef.current = false
            return
          }
          unlockSpeaker()
          toggle()
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          setView("assistant")
        }}
        className={cn(
          "pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full",
          "border border-white/25 text-foreground/90 shadow-[0_8px_32px_rgba(0,0,0,0.28)]",
          "backdrop-blur-xl transition active:scale-95",
          "bg-white/18 supports-[backdrop-filter]:bg-white/12",
          "dark:bg-white/14 dark:supports-[backdrop-filter]:bg-white/10",
          mode === "off" && "opacity-80",
          listening && !commanding && "ring-2 ring-emerald-400/50",
          commanding && "ring-2 ring-sky-400/55",
          busy && "ring-2 ring-amber-400/55",
          speaking && "ring-2 ring-emerald-300/70",
          !supported && "opacity-40",
        )}
      >
        {busy ? (
          <Loader2 className="h-6 w-6 animate-spin text-amber-100" />
        ) : mode === "off" ? (
          <MicOff className="h-6 w-6 opacity-80" />
        ) : (
          <Mic className={cn("h-6 w-6", commanding ? "text-sky-100" : "text-emerald-50")} />
        )}
        {listening && (
          <span
            className={cn(
              "pointer-events-none absolute inset-0 -z-10 animate-ping rounded-full opacity-25",
              commanding ? "bg-sky-300" : "bg-emerald-300",
            )}
          />
        )}
      </button>
    </div>
  )
}
