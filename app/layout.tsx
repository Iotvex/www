import type { Metadata, Viewport } from "next"
import { Manrope, JetBrains_Mono } from "next/font/google"
import Script from "next/script"
import { getLocale } from "next-intl/server"
import { FC, PropsWithChildren } from "react"
import { getDirection, localeCookieName, type AppLocale } from "@/i18n/config"
import { getRuntimeConfig } from "@/shared/config/runtime.server"
import "./globals.css"

const manrope = Manrope({ subsets: ["latin", "cyrillic", "cyrillic-ext", "latin-ext"], variable: "--font-sans" })
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: "Iotvex",
  description: "Iotvex control panel",
  applicationName: "Iotvex",
  appleWebApp: {
    capable: true,
    // Opaque black status bar: iOS places the webview BELOW the system chrome.
    // Do NOT also apply env(safe-area-inset-top) on Topbar/body — with
    // viewport-fit=cover that inset is still non-zero and becomes a second
    // empty black band between the status bar and the header (PWA-only).
    // Standalone also pins body (globals.css) so the initial viewport offset
    // matches the post–Sheet-close layout (RemoveScroll reflow).
    statusBarStyle: "black",
    title: "Iotvex",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icon-192.png", sizes: "180x180", type: "image/png" }],
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
}

const RootLayout: FC<PropsWithChildren> = async ({ children }) => {
  const locale = (await getLocale()) as AppLocale
  const dir = getDirection(locale)
  const runtime = getRuntimeConfig()
  const browserRuntime = {
    supabaseBrowserUrl: runtime.supabaseBrowserUrl,
    supabaseAnonKey: runtime.supabaseAnonKey,
    dbMode: runtime.dbMode,
    wwwMode: runtime.wwwMode,
    mdnsName: runtime.mdnsName,
  }
  const runtimeBoot = `window.__IOTVEX_RUNTIME__=${JSON.stringify(browserRuntime)};`

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning data-color="default">
      <body
        className={`${manrope.variable} ${mono.variable} min-h-dvh overscroll-none bg-background font-sans antialiased`}
      >
        <Script id="iotvex-runtime" strategy="beforeInteractive">{runtimeBoot}</Script>
        <Script id="iotvex-boot" strategy="beforeInteractive">{`(function(){try{var c=localStorage.getItem("iotvex-color-theme");if(c)document.documentElement.setAttribute("data-color",c);var l=localStorage.getItem("${localeCookieName}");if(l){document.cookie="${localeCookieName}="+l+"; path=/; max-age=31536000; samesite=lax";document.documentElement.lang=l;document.documentElement.dir=l==="ar"?"rtl":"ltr";}}catch(e){}})();`}</Script>
        {children}
      </body>
    </html>
  )
}

RootLayout.displayName = "RootLayout"

export default RootLayout
