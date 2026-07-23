"use client"

import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { useTranslations } from "next-intl"
import { FormEvent, useState } from "react"

export function LoginForm() {
  const t = useTranslations("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({} as { error?: string }))
      if (!res.ok) {
        setError(data.error || t("invalidCredentialsError"))
        return
      }
      window.location.href = "/"
    } catch (err) {
      setError(err instanceof Error ? err.message : t("connectionError"))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">{t("emailLabel")}</label>
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
          autoComplete="username"
          className="h-10"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">{t("passwordLabel")}</label>
        <Input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
          autoComplete="current-password"
          className="h-10"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending ? t("pending") : t("submit")}
      </Button>
    </form>
  )
}
