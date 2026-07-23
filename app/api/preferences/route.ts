import { NextResponse } from "next/server"
import { createAdminClient } from "@/shared/lib/supabase/admin"
import { createClient } from "@/shared/lib/supabase/server"
import {
  isColorThemeId,
  isThemeMode,
  normalizePreferencesRow,
} from "@/shared/lib/user-preferences"
import { isAppLocale } from "@/i18n/config"

export const dynamic = "force-dynamic"

async function requireUserId() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return null
  return user.id
}

export async function GET() {
  try {
    const userId = await requireUserId()
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const sb = createAdminClient()
    const { data, error } = await sb
      .from("user_preferences")
      .select("theme, color_theme, locale, updated_at")
      .eq("user_id", userId)
      .maybeSingle()
    if (error) throw new Error(error.message)

    return NextResponse.json({
      preferences: normalizePreferencesRow(data),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await requireUserId()
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const patch: {
      theme?: string
      color_theme?: string
      locale?: string
    } = {}

    if (body.theme != null) {
      const theme = String(body.theme)
      if (!isThemeMode(theme)) {
        return NextResponse.json({ error: "invalid theme" }, { status: 400 })
      }
      patch.theme = theme
    }
    if (body.color_theme != null) {
      const color = String(body.color_theme)
      if (!isColorThemeId(color)) {
        return NextResponse.json({ error: "invalid color_theme" }, { status: 400 })
      }
      patch.color_theme = color
    }
    if (body.locale != null) {
      const locale = String(body.locale)
      if (!isAppLocale(locale)) {
        return NextResponse.json({ error: "invalid locale" }, { status: 400 })
      }
      patch.locale = locale
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "no fields" }, { status: 400 })
    }

    const sb = createAdminClient()
    const { data, error } = await sb
      .from("user_preferences")
      .upsert(
        {
          user_id: userId,
          ...patch,
        },
        { onConflict: "user_id" },
      )
      .select("theme, color_theme, locale, updated_at")
      .single()
    if (error) throw new Error(error.message)

    return NextResponse.json({ preferences: normalizePreferencesRow(data) })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
