"use client"

import { type ColorThemeId } from "@/shared/config/themes"
import { isColorThemeId, persistPreferences, readLocalPreferences } from "@/shared/lib/user-preferences"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FC,
  type PropsWithChildren,
} from "react"

type ColorThemeContextValue = {
  color: ColorThemeId
  setColor: (id: ColorThemeId) => void
}

const ColorThemeContext = createContext<ColorThemeContextValue | null>(null)

function applyColor(id: ColorThemeId) {
  if (typeof document === "undefined") return
  document.documentElement.setAttribute("data-color", id)
}

function readInitialColor(): ColorThemeId {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.getAttribute("data-color")
    if (attr && isColorThemeId(attr)) return attr
  }
  if (typeof window !== "undefined") {
    const stored = readLocalPreferences().color_theme
    if (stored && isColorThemeId(stored)) return stored
  }
  return "default"
}

const ColorThemeProvider: FC<PropsWithChildren> = ({ children }) => {
  const [color, setColorState] = useState<ColorThemeId>(readInitialColor)

  useEffect(() => {
    const stored = readLocalPreferences().color_theme
    const initial = stored && isColorThemeId(stored) ? stored : readInitialColor()
    setColorState(initial)
    applyColor(initial)
  }, [])

  const setColor = useCallback((id: ColorThemeId) => {
    setColorState(id)
    applyColor(id)
    persistPreferences({ color_theme: id })
  }, [])

  const value = useMemo(() => ({ color, setColor }), [color, setColor])

  return (
    <ColorThemeContext.Provider value={value}>{children}</ColorThemeContext.Provider>
  )
}

function useColorTheme() {
  const ctx = useContext(ColorThemeContext)
  if (!ctx) throw new Error("useColorTheme must be used within ColorThemeProvider")
  return ctx
}

export { ColorThemeProvider, useColorTheme }
