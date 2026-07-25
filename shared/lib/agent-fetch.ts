/**
 * Authenticated fetch to the local hub agent.
 * Sends IOTVEX_AGENT_TOKEN when configured.
 */
const AGENT = process.env.IOTVEX_AGENT_URL || "http://127.0.0.1:7421"

export function agentBaseUrl(): string {
  return AGENT.replace(/\/$/, "")
}

export function agentHeaders(extra?: HeadersInit): Headers {
  const h = new Headers(extra)
  if (!h.has("Content-Type")) h.set("Content-Type", "application/json")
  const token = (process.env.IOTVEX_AGENT_TOKEN || "").trim()
  if (token) {
    h.set("Authorization", `Bearer ${token}`)
    h.set("X-Iotvex-Agent-Token", token)
  }
  return h
}

function defaultSignal(init?: RequestInit): AbortSignal | undefined {
  if (init?.signal) return init.signal
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(2500)
  }
  return undefined
}

export async function agentFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${agentBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`
  const headers = agentHeaders(init?.headers)
  return fetch(url, {
    ...init,
    headers,
    cache: "no-store",
    signal: defaultSignal(init),
  })
}
