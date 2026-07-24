"use client"

import { useVoiceAssistant } from "@/features/voice-assistant/ui/VoiceAssistantProvider"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { PageToolbar } from "@/shared/ui/page-toolbar"
import { cn } from "@/shared/lib/utils"
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  RefreshCw,
  Loader2,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect } from "react"

function LevelBar({ level }: { level: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, level)) * 100)
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-emerald-400/80 transition-[width] duration-75"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function StatusPill({
  ok,
  label,
}: {
  ok: boolean | null
  label: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
        ok === true && "bg-emerald-500/15 text-emerald-300",
        ok === false && "bg-rose-500/15 text-rose-300",
        ok === null && "bg-white/10 text-foreground/60",
      )}
    >
      {label}
    </span>
  )
}

export function AssistantPage() {
  const t = useTranslations("assistant")
  const v = useVoiceAssistant()

  useEffect(() => {
    void v.refreshPermissions()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh once on mount
  }, [])

  const listening = v.mode === "wake" || v.mode === "command"
  const micOk =
    v.micPermission === "granted" ? true : v.micPermission === "denied" ? false : null
  const speakerOk =
    v.speakerReady === "ready" ? true : v.speakerReady === "locked" ? false : null

  return (
    <div className="iotvex-page space-y-4">
      <PageToolbar
        actions={
          <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={v.mode === "off" ? "default" : "secondary"}
              disabled={!v.supported}
              onClick={() => {
                v.unlockSpeaker()
                v.toggle()
              }}
            >
              {v.mode === "busy" ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : v.mode === "off" ? (
                <Mic className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <MicOff className="mr-1.5 h-3.5 w-3.5" />
              )}
              {v.mode === "off" ? t("enable") : t("disable")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void v.refreshPermissions()}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              {t("refresh")}
            </Button>
          </div>
        }
      />

      {!v.supported ? (
        <p className="text-sm text-foreground/60">{t("unsupported")}</p>
      ) : null}

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="text-sm font-medium text-foreground/90">{t("permissionsTitle")}</h2>
        <div className="flex flex-wrap gap-2">
          <StatusPill
            ok={micOk}
            label={
              v.micPermission === "granted"
                ? t("micGranted")
                : v.micPermission === "denied"
                  ? t("micDenied")
                  : v.micPermission === "prompt"
                    ? t("micPrompt")
                    : t("micUnknown")
            }
          />
          <StatusPill
            ok={speakerOk}
            label={
              v.speakerReady === "ready"
                ? t("speakerReady")
                : v.speakerReady === "locked"
                  ? t("speakerLocked")
                  : t("speakerUnknown")
            }
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void v.requestMicPermission()}
          >
            <Mic className="mr-1.5 h-3.5 w-3.5" />
            {t("requestMic")}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={v.unlockSpeaker}>
            {v.speakerReady === "ready" ? (
              <Volume2 className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <VolumeX className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t("unlockSpeaker")}
          </Button>
        </div>
        <p className="text-[12px] leading-relaxed text-foreground/50">{t("permissionsHint")}</p>
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-foreground/90">{t("levelTitle")}</h2>
          <span className="text-[11px] text-foreground/45">
            {listening
              ? v.mode === "command"
                ? t("stateCommand")
                : t("stateWake")
              : v.mode === "busy"
                ? t("stateBusy")
                : v.speaking
                  ? t("stateSpeaking")
                  : t("stateOff")}
          </span>
        </div>
        <LevelBar level={listening || v.speaking ? Math.max(v.level, v.speaking ? 0.35 : 0) : 0} />
        <p className="text-[12px] text-foreground/55">{v.hint}</p>
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="text-sm font-medium text-foreground/90">{t("transcriptTitle")}</h2>
        <div className="space-y-2">
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-foreground/40">
              {t("heardLabel")}
            </p>
            <p className="min-h-[2.5rem] rounded-lg bg-black/20 px-3 py-2 text-sm text-foreground/85">
              {v.heard || "—"}
            </p>
          </div>
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-foreground/40">
              {t("replyLabel")}
            </p>
            <p className="min-h-[2.5rem] rounded-lg bg-black/20 px-3 py-2 text-sm text-foreground/85">
              {v.reply || "—"}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!v.lastAudioAvailable}
            onClick={v.replayLast}
          >
            <Volume2 className="mr-1.5 h-3.5 w-3.5" />
            {t("replay")}
          </Button>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="text-sm font-medium text-foreground/90">{t("commandTitle")}</h2>
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            v.submitDraft()
          }}
        >
          <Input
            value={v.draft}
            onChange={(e) => v.setDraft(e.target.value)}
            placeholder={t("commandPlaceholder")}
            className="min-w-0 flex-1"
          />
          <Button type="submit" size="icon" variant="secondary" aria-label={t("send")}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="text-[12px] leading-relaxed text-foreground/50">{t("wakeHint")}</p>
      </section>
    </div>
  )
}
