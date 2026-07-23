"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import { FC, PropsWithChildren } from "react"
import { ColorThemeProvider } from "./color-theme-provider"

const ThemeProvider: FC<PropsWithChildren> = ({ children }) => {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <ColorThemeProvider>{children}</ColorThemeProvider>
    </NextThemesProvider>
  )
}

ThemeProvider.displayName = "ThemeProvider"

export { ThemeProvider }
