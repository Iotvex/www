export const locales = [
  "en",
  "ru",
  "ja",
  "zh",
  "es",
  "hi",
  "ar",
  "fr",
  "pt",
  "id",
] as const

export type AppLocale = (typeof locales)[number]

export const defaultLocale: AppLocale = "en"

export const localeCookieName = "iotvex-locale"

export const rtlLocales: readonly AppLocale[] = ["ar"]

export function isAppLocale(value: string): value is AppLocale {
  return (locales as readonly string[]).includes(value)
}

export function getDirection(locale: AppLocale): "ltr" | "rtl" {
  return rtlLocales.includes(locale) ? "rtl" : "ltr"
}

/** BCP 47 tags for Intl / toLocaleString */
export const localeTags: Record<AppLocale, string> = {
  en: "en",
  ru: "ru",
  ja: "ja",
  zh: "zh-CN",
  es: "es",
  hi: "hi",
  ar: "ar",
  fr: "fr",
  pt: "pt-BR",
  id: "id",
}
