import {
  Home,
  Layout,
  Cpu,
  Lightbulb,
  House,
  Workflow,
  Clapperboard,
  ListOrdered,
  Activity,
  Puzzle,
  UserRound,
  Palette,
  Server,
  Users,
  Archive,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import type { AppViewId, AppViewGroup } from "@/entities/nav/model/store"

export type NavItem = {
  id: AppViewId
  icon: LucideIcon
}

export type NavSection = {
  id: string
  sectionKey: "home" | "automation" | "system" | "settings" | null
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "overview",
    sectionKey: null,
    items: [{ id: "dashboard", icon: Layout }],
  },
  {
    id: "home",
    sectionKey: "home",
    items: [
      { id: "home-devices", icon: Cpu },
      { id: "home-entities", icon: Lightbulb },
      { id: "home-areas", icon: House },
    ],
  },
  {
    id: "automation",
    sectionKey: "automation",
    items: [
      { id: "auto-scenarios", icon: Workflow },
      { id: "auto-scenes", icon: Clapperboard },
      { id: "auto-scripts", icon: ListOrdered },
    ],
  },
  {
    id: "system",
    sectionKey: "system",
    items: [
      { id: "activity", icon: Activity },
      { id: "modules", icon: Puzzle },
    ],
  },
  {
    id: "settings",
    sectionKey: "settings",
    items: [
      { id: "settings-account", icon: UserRound },
      { id: "settings-appearance", icon: Palette },
      { id: "settings-services", icon: Server },
      { id: "settings-users", icon: Users },
      { id: "settings-backup", icon: Archive },
      { id: "settings-tools", icon: Wrench },
    ],
  },
]

export const NAV: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items)

export function navItemById(id: AppViewId): NavItem | undefined {
  return NAV.find((n) => n.id === id)
}

export type MobileTab = {
  group: AppViewGroup
  labelKey: "overview" | "home" | "auto" | "more"
  icon: LucideIcon
}

export const MOBILE_TABS: MobileTab[] = [
  { group: "overview", labelKey: "overview", icon: Layout },
  { group: "home", labelKey: "home", icon: House },
  { group: "automation", labelKey: "auto", icon: Workflow },
  { group: "settings", labelKey: "more", icon: UserRound },
]
