import type { AppLocale } from "./config"

export type Messages = typeof import("../messages/en.json")

const loaders: Record<AppLocale, () => Promise<{ default: Messages }>> = {
  en: () => import("../messages/en.json"),
  ru: () => import("../messages/ru.json"),
  ja: () => import("../messages/ja.json"),
  zh: () => import("../messages/zh.json"),
  es: () => import("../messages/es.json"),
  hi: () => import("../messages/hi.json"),
  ar: () => import("../messages/ar.json"),
  fr: () => import("../messages/fr.json"),
  pt: () => import("../messages/pt.json"),
  id: () => import("../messages/id.json"),
}

export async function loadMessages(locale: AppLocale): Promise<Messages> {
  const mod = await loaders[locale]()
  return mod.default
}
