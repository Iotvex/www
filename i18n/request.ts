import { getRequestConfig } from "next-intl/server"
import { cookies, headers } from "next/headers"
import { match } from "@formatjs/intl-localematcher"
import Negotiator from "negotiator"
import {
  defaultLocale,
  isAppLocale,
  localeCookieName,
  locales,
  type AppLocale,
} from "./config"
import { loadMessages } from "./messages"

function negotiateLocale(acceptLanguage: string | null): AppLocale {
  try {
    const headersObj = { "accept-language": acceptLanguage || defaultLocale }
    const languages = new Negotiator({ headers: headersObj }).languages()
    const matched = match(languages, [...locales], defaultLocale)
    return isAppLocale(matched) ? matched : defaultLocale
  } catch {
    return defaultLocale
  }
}

export default getRequestConfig(async () => {
  const store = await cookies()
  const raw = store.get(localeCookieName)?.value
  let locale: AppLocale
  if (raw && isAppLocale(raw)) {
    locale = raw
  } else {
    const h = await headers()
    locale = negotiateLocale(h.get("accept-language"))
  }
  const messages = await loadMessages(locale)
  return { locale, messages }
})
