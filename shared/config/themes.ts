export const COLOR_THEMES = [
  { id: "default", swatch: "#18bcf2" },
  { id: "blue", swatch: "#3b82f6" },
  { id: "green", swatch: "#22c55e" },
  { id: "orange", swatch: "#f97316" },
  { id: "rose", swatch: "#f43f5e" },
  { id: "violet", swatch: "#8b5cf6" },
  { id: "yellow", swatch: "#eab308" },
  { id: "red", swatch: "#ef4444" },
  { id: "zinc", swatch: "#71717a" },
] as const

export type ColorThemeId = (typeof COLOR_THEMES)[number]["id"]

export const MODE_OPTIONS = [
  { id: "light" },
  { id: "dark" },
  { id: "system" },
] as const

export const COLOR_STORAGE_KEY = "iotvex-color-theme"
