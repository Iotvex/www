"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import { FC, PropsWithChildren } from "react"
import { ColorThemeProvider } from "./color-theme-provider"
import { THEME_STORAGE_KEY } from "@/shared/lib/user-preferences"

const ThemeProvider: FC<PropsWithChildren> = ({ children }) => {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange
    >
      <ColorThemeProvider>{children}</ColorThemeProvider>
    </NextThemesProvider>
  )
}

ThemeProvider.displayName = "ThemeProvider"

export { ThemeProvider }
