import { createClient } from "@/shared/lib/supabase/server"
import { RootProvider } from "@/app/providers/provider"
import { DashboardApp } from "@/widgets/shell/ui/DashboardApp"
import { PwaRegister } from "@/features/pwa/ui/PwaRegister"
import { getLocale, getMessages } from "next-intl/server"
import { redirect } from "next/navigation"
import type { AppLocale } from "@/i18n/config"
import type { Messages } from "@/i18n/messages"
import type { ReactNode } from "react"

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) redirect("/login")

  const locale = (await getLocale()) as AppLocale
  const messages = (await getMessages()) as Messages

  return (
    <RootProvider
      user={{ id: user.id, email: user.email }}
      locale={locale}
      messages={messages}
    >
      <PwaRegister />
      <DashboardApp />
      <div className="hidden" aria-hidden>
        {children}
      </div>
    </RootProvider>
  )
}
