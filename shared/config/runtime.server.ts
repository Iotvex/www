/**
 * Local-only runtime for the home panel.
 * Supabase + agent always on the LAN / docker host — no cloud / tunnels / publish.
 */
import fs from "node:fs"
import path from "node:path"
import { isLocalOrPrivateUrl } from "@/shared/config/runtime"

export type ResolvedRuntime = {
  devicePlane: "local"
  wwwMode: "local"
  dbMode: "local"
  mdnsName: string
  timezone: string
  agentUrl: string
  agentIsLocal: boolean
  automationsScheduler: "home-systemd"
  supabaseUrl: string
  supabaseAnonKey: string
  supabaseServiceRoleKey: string
  supabaseBrowserUrl: string
  httpPort: number
  configPath: string
}

type RuntimeFile = {
  version: number
  mdnsName?: string
  timezone?: string
  httpPort?: number
  db?: {
    local?: { url?: string; browserUrl?: string }
  }
}

type SecretsFile = {
  version?: number
  db?: {
    local?: { serviceRoleKey?: string; anonKey?: string }
  }
}

function configDir() {
  if (process.env.IOTVEX_CONFIG_DIR) return process.env.IOTVEX_CONFIG_DIR
  return path.join(process.cwd(), "config")
}

export function runtimePaths() {
  const dir = configDir()
  return {
    dir,
    configPath: path.join(dir, "runtime.json"),
    secretsPath: path.join(dir, "runtime.secrets.json"),
  }
}

function readJsonFile<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback
    const raw = fs.readFileSync(file, "utf8")
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function readRuntimeFile(): RuntimeFile {
  const { configPath } = runtimePaths()
  return readJsonFile<RuntimeFile>(configPath, { version: 2 })
}

function readSecretsFile(): SecretsFile {
  const { secretsPath } = runtimePaths()
  return readJsonFile<SecretsFile>(secretsPath, { version: 1 })
}

function env(name: string, fallback = ""): string {
  return (process.env[name] || "").trim() || fallback
}

export function getRuntimeConfig(): ResolvedRuntime {
  const file = readRuntimeFile()
  const secrets = readSecretsFile()
  const { configPath } = runtimePaths()

  const mdnsRaw = file.mdnsName || env("IOTVEX_MDNS_NAME", "iotvex.local")
  const mdnsName = mdnsRaw.endsWith(".local") ? mdnsRaw : `${mdnsRaw}.local`

  const supabaseUrl =
    env("SUPABASE_URL") ||
    file.db?.local?.url ||
    "http://host.docker.internal:54321"

  const supabaseBrowserUrl =
    env("NEXT_PUBLIC_SUPABASE_BROWSER_URL") ||
    file.db?.local?.browserUrl ||
    "/supabase"

  const supabaseAnonKey =
    env("SUPABASE_ANON_KEY") ||
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    secrets.db?.local?.anonKey ||
    ""

  const supabaseServiceRoleKey =
    env("SUPABASE_SERVICE_ROLE_KEY") || secrets.db?.local?.serviceRoleKey || ""

  const agentUrl = env("IOTVEX_AGENT_URL", "http://127.0.0.1:7421")
  const httpPort = Number(file.httpPort || env("IOTVEX_HTTP_PORT", "80")) || 80

  return {
    devicePlane: "local",
    wwwMode: "local",
    dbMode: "local",
    mdnsName,
    timezone: file.timezone || env("IOTVEX_TZ") || env("TZ") || "UTC",
    agentUrl,
    agentIsLocal: isLocalOrPrivateUrl(agentUrl),
    automationsScheduler: "home-systemd",
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    supabaseBrowserUrl,
    httpPort,
    configPath,
  }
}

/** Non-secret snapshot for Settings /api/runtime */
export function publicRuntimeView(runtime = getRuntimeConfig()) {
  let supabaseUrlHost = "(unset)"
  try {
    const u = new URL(runtime.supabaseUrl)
    supabaseUrlHost = `${u.protocol}//${u.host}`
  } catch {
    /* ignore */
  }
  return {
    devicePlane: runtime.devicePlane,
    wwwMode: runtime.wwwMode,
    dbMode: runtime.dbMode,
    mdnsName: runtime.mdnsName,
    timezone: runtime.timezone,
    agentUrl: runtime.agentUrl,
    agentIsLocal: runtime.agentIsLocal,
    automationsScheduler: runtime.automationsScheduler,
    supabaseUrlHost,
    supabaseBrowserUrl: runtime.supabaseBrowserUrl,
    httpPort: runtime.httpPort,
  }
}
