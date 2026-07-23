import type { Metadata, Viewport } from "next"
import { Manrope, JetBrains_Mono } from "next/font/google"
import Script from "next/script"
import { getLocale } from "next-intl/server"
import { cookies } from "next/headers"
import { FC, PropsWithChildren } from "react"
import { getDirection, localeCookieName, type AppLocale } from "@/i18n/config"
import { getRuntimeConfig } from "@/shared/config/runtime.server"
import { COLOR_STORAGE_KEY } from "@/shared/config/themes"
import { isColorThemeId } from "@/shared/lib/user-preferences"
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
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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
  const cookieStore = await cookies()
  const colorCookie = cookieStore.get(COLOR_STORAGE_KEY)?.value
  const bootColor = colorCookie && isColorThemeId(colorCookie) ? colorCookie : "default"
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
    <html lang={locale} dir={dir} suppressHydrationWarning data-color={bootColor}>
      <body
        className={`${manrope.variable} ${mono.variable} min-h-dvh overscroll-none bg-background font-sans antialiased`}
      >
        <Script id="iotvex-runtime" strategy="beforeInteractive">{runtimeBoot}</Script>
        <Script id="iotvex-boot" strategy="beforeInteractive">{`(function(){try{var d=document.documentElement;function cookie(n){var p=n+"=";var parts=document.cookie.split("; ");for(var i=0;i<parts.length;i++){if(parts[i].indexOf(p)===0)return decodeURIComponent(parts[i].slice(p.length));}return null}var c=localStorage.getItem("iotvex-color-theme")||cookie("iotvex-color-theme");if(c)d.setAttribute("data-color",c);var t=localStorage.getItem("theme")||cookie("iotvex-theme");var dark=t==="dark"||(t!=="light"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);d.classList.toggle("dark",!!dark);d.style.colorScheme=dark?"dark":"light";var l=localStorage.getItem("${localeCookieName}")||cookie("${localeCookieName}");if(l){document.cookie="${localeCookieName}="+l+"; path=/; max-age=31536000; samesite=lax";d.lang=l;d.dir=l==="ar"?"rtl":"ltr";}d.setAttribute("data-boot","1");}catch(e){}})();`}</Script>
        {children}
      </body>
    </html>
  )
}

RootLayout.displayName = "RootLayout"

export default RootLayout
