import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST() {
  const cookieStore = await cookies()
  const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const response = NextResponse.json({ ok: true })
  const supabase = createServerClient(supabaseUrl, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options)
          response.cookies.set(name, value, options)
        })
      },
    },
  })
  await supabase.auth.signOut()
  return response
}
