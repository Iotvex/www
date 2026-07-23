"use client"

import {
  getDirection,
  isAppLocale,
  type AppLocale,
} from "@/i18n/config"
import { loadMessages, type Messages } from "@/i18n/messages"
import { persistPreferences } from "@/shared/lib/user-preferences"
import { NextIntlClientProvider } from "next-intl"
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react"

type LocaleContextValue = {
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
  pending: boolean
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function applyLocaleDom(locale: AppLocale) {
  document.documentElement.lang = locale
  document.documentElement.dir = getDirection(locale)
}

export function LocaleProvider({
  children,
  initialLocale,
  initialMessages,
}: {
  children: ReactNode
  initialLocale: AppLocale
  initialMessages: Messages
}) {
  const [locale, setLocaleState] = useState(initialLocale)
  const [messages, setMessages] = useState(initialMessages)
  const [pending, startTransition] = useTransition()

  const setLocale = useCallback(
    (next: AppLocale) => {
      if (!isAppLocale(next) || next === locale) return
      startTransition(() => {
        void (async () => {
          const nextMessages = await loadMessages(next)
          applyLocaleDom(next)
          persistPreferences({ locale: next })
          setMessages(nextMessages)
          setLocaleState(next)
        })()
      })
    },
    [locale],
  )

  const value = useMemo(
    () => ({ locale, setLocale, pending }),
    [locale, setLocale, pending],
  )

  return (
    <LocaleContext.Provider value={value}>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  )
}

export function useLocaleSwitch() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error("useLocaleSwitch must be used within LocaleProvider")
  return ctx
}
