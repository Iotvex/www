"use client"

import type { AuthUser } from "@/entities/auth/model/store"
import type { AppLocale } from "@/i18n/config"
import type { Messages } from "@/i18n/messages"
import { FC, PropsWithChildren } from "react"
import { AuthProvider } from "./auth-provider"
import { LocaleProvider } from "./locale-provider"
import { ThemeProvider } from "./theme-provider"

const RootProvider: FC<
  PropsWithChildren<{
    user?: AuthUser | null
    locale: AppLocale
    messages: Messages
  }>
> = ({ children, user = null, locale, messages }) => {
  return (
    <LocaleProvider initialLocale={locale} initialMessages={messages}>
      <ThemeProvider>
        <AuthProvider user={user}>{children}</AuthProvider>
      </ThemeProvider>
    </LocaleProvider>
  )
}

RootProvider.displayName = "RootProvider"

export { RootProvider }
