"use client"

import { callEntityFx, setStripFx } from "@/entities/device/model/store"
import { useTranslations } from "next-intl"
import { useEffect } from "react"
import { toast } from "sonner"

/** Surface strip/entity command failures (previously silent). */
export function CommandFeedback() {
  const t = useTranslations("entity")

  useEffect(() => {
    const unsubCall = callEntityFx.fail.watch(({ error }) => {
      const detail = String(error?.message || error || "").trim()
      toast.error(t("controlFailed"), {
        description: detail ? detail.slice(0, 180) : undefined,
      })
    })
    const unsubSet = setStripFx.fail.watch(({ error }) => {
      const detail = String(error?.message || error || "").trim()
      toast.error(t("controlFailed"), {
        description: detail ? detail.slice(0, 180) : undefined,
      })
    })
    return () => {
      unsubCall()
      unsubSet()
    }
  }, [t])

  return null
}
