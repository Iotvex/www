import { LoginForm } from "@/features/auth/ui/LoginForm"
import { RootProvider } from "@/app/providers/provider"
import { ThemeSwitcher } from "@/features/theme/ui/ThemeSwitcher"
import { LanguageSwitcher } from "@/features/locale/ui/LanguageSwitcher"
import { getLocale, getMessages, getTranslations } from "next-intl/server"
import type { AppLocale } from "@/i18n/config"
import type { Messages } from "@/i18n/messages"
import { FC } from "react"

const LoginPage: FC = async () => {
  const locale = (await getLocale()) as AppLocale
  const messages = (await getMessages()) as Messages
  const t = await getTranslations("login")

  return (
    <RootProvider locale={locale} messages={messages}>
      <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]">
        <div className="iotvex-atmosphere" aria-hidden>
          <span className="iotvex-orb iotvex-orb-a" />
          <span className="iotvex-orb iotvex-orb-b" />
          <span className="iotvex-orb iotvex-orb-c" />
        </div>
        <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="absolute right-[max(0.75rem,env(safe-area-inset-right,0px))] top-3 z-10 flex items-center gap-2 sm:right-[max(1.5rem,env(safe-area-inset-right,0px))] sm:top-6">
          <ThemeSwitcher />
        </div>
        <div className="relative w-full max-w-md animate-[iotvex-card-in_480ms_cubic-bezier(0.22,1,0.36,1)_both] rounded-xl border border-border/60 bg-card/70 p-6 shadow-2xl backdrop-blur-2xl dark:border-white/[0.08] dark:bg-card/50 sm:p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current">
                <path d="M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3l9-8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Iotvex</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t("tagline")}</p>
          </div>
          <LoginForm />
          <div className="mt-6 border-t border-border/50 pt-5">
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </RootProvider>
  )
}

LoginPage.displayName = "LoginPage"

export default LoginPage
