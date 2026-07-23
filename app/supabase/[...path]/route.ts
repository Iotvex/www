import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UPSTREAM = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'

async function proxy(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const target = new URL(path.join('/'), UPSTREAM.endsWith('/') ? UPSTREAM : UPSTREAM + '/')
  target.search = request.nextUrl.search

  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.set('host', new URL(UPSTREAM).host)

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer()
  }

  const res = await fetch(target, init)
  const outHeaders = new Headers(res.headers)
  outHeaders.delete('content-encoding')
  outHeaders.delete('transfer-encoding')
  // same-origin: loosen CORS leftovers from Kong
  outHeaders.delete('access-control-allow-origin')

  return new NextResponse(res.body, { status: res.status, headers: outHeaders })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
export const OPTIONS = async () =>
  new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  })
