import "server-only"
/**
 * Iotvex WWW runtime contract.
 *
 * WWW modes:
 * - local            — self-hosted UI on the home machine (HTTP + mDNS)
 * - local_published  — same, plus public HTTPS reachability (port-forward / tunnels / domain)
 * - cloud            — UI hosted in Iotvex cloud; home keeps agent/OTBR only
 *
 * DB modes:
 * - local          — bundled Supabase on the home machine
 * - cloud_public   — shared Iotvex-hosted Supabase (multi-tenant)
 * - cloud_private  — user's own Supabase project
 *
 * Non-secret settings live in config/runtime.json (hot-reloadable).
 * Secrets live in config/runtime.secrets.json (file + optional env fallback).
 *
 * Device plane (OTBR + agent) is ALWAYS local. Automations tick on home systemd.
 */

import fs from "fs"
import path from "path"
import { matrixCell } from "@/shared/config/matrix"

export type WwwMode = "local" | "local_published" | "cloud"
export type DbMode = "local" | "cloud_public" | "cloud_private"

export type PublishProviderId =
  | "caddy_local"
  | "pinggy"
  | "cloudflare_tunnel"
  | "ngrok"
  | "tailscale_funnel"

export type PublishProvider = {
  enabled: boolean
  note?: string
  authtoken?: string
  subdomain?: string
  region?: string
  tunnelToken?: string
  hostname?: string
  domain?: string
}

export type RuntimeFile = {
  version: number
  wwwMode: WwwMode
  mdnsName: string
  timezone?: string
  publish: {
    httpPort: number
    httpsPort: number
    customDomain: string
    providers: Record<string, PublishProvider>
  }
  cloudWww: {
    baseUrl: string
    note?: string
  }
  bridge: {
    /** When true (or autoFromMatrix), derive expose* from WWW×DB matrix. */
    autoFromMatrix: boolean
    exposeLocalDb: boolean
    exposeAgent: boolean
    localDbPublicUrl: string
    agentPublicUrl: string
    wwwPublicUrl: string
    preferredProvider: string
  }
  db: {
    mode: DbMode
    local: { url: string; browserUrl: string; publicUrl?: string }
    cloudPublic: { url: string; anonKey: string }
    cloudPrivate: { url: string; anonKey: string }
  }
}

export type RuntimeSecretsFile = {
  version: number
  db: {
    local: { serviceRoleKey: string }
    cloudPublic: { serviceRoleKey: string }
    cloudPrivate: { serviceRoleKey: string }
  }
  publish?: Record<string, { authtoken?: string; tunnelToken?: string }>
}

export type ResolvedRuntime = {
  devicePlane: "local"
  wwwMode: WwwMode
  dbMode: DbMode
  mdnsName: string
  timezone: string
  agentUrl: string
  agentIsLocal: boolean
  automationsScheduler: "home-systemd"
  supabaseUrl: string
  supabaseAnonKey: string
  supabaseServiceRoleKey: string
  supabaseBrowserUrl: string
  publish: RuntimeFile["publish"]
  cloudWww: RuntimeFile["cloudWww"]
  httpPort: number
  httpsPort: number
  /** Effective access hints for UI */
  access: {
    lanHttp: string
    lanHttps: string
    mdnsHttp: string
    mdnsHttps: string
    customDomain: string | null
    published: boolean
  }
  bridge: RuntimeFile["bridge"]
  matrix: {
    needsWwwPublish: boolean
    needsLocalDbBridge: boolean
    needsAgentBridge: boolean
    summary: string
  }
  /** URL cloud/remote WWW should use for catalog when DB is local (tunneled). */
  supabasePublicUrl: string | null
  /** URL cloud/remote WWW should use for agent commands. */
  agentPublicUrl: string | null
  configPath: string
  secretsPath: string
}

const WWW_MODES = ["local", "local_published", "cloud"] as const
const DB_MODES = ["local", "cloud_public", "cloud_private"] as const

function configDir() {
  if (process.env.IOTVEX_CONFIG_DIR) return process.env.IOTVEX_CONFIG_DIR
  // Docker runner WORKDIR=/app; local dev uses cwd/config
  try {
    return path.join(process.cwd(), "config")
  } catch {
    return "/app/config"
  }
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
    return { ...fallback, ...JSON.parse(raw) } as T
  } catch {
    return fallback
  }
}

function writeJsonFile(file: string, data: unknown, mode = 0o644) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", { mode })
  fs.renameSync(tmp, file)
}

/** Migrate legacy env mode names. */
export function normalizeWwwMode(raw?: string | null): WwwMode {
  const v = (raw || "").trim().toLowerCase().replace(/-/g, "_")
  if (v === "lan") return "local"
  if (v === "published") return "local_published"
  if ((WWW_MODES as readonly string[]).includes(v)) return v as WwwMode
  return "local"
}

export function normalizeDbMode(raw?: string | null): DbMode {
  const v = (raw || "").trim().toLowerCase().replace(/-/g, "_")
  if (v === "remote") return "cloud_private"
  if ((DB_MODES as readonly string[]).includes(v)) return v as DbMode
  return "local"
}

export function defaultRuntimeFile(): RuntimeFile {
  return {
    version: 1,
    wwwMode: normalizeWwwMode(process.env.IOTVEX_WWW_MODE) || "local",
    mdnsName: process.env.IOTVEX_MDNS_NAME || "iotvex.local",
    timezone: process.env.IOTVEX_TZ || process.env.TZ || "UTC",
    publish: {
      httpPort: Number(process.env.IOTVEX_HTTP_PORT || 3100),
      httpsPort: Number(process.env.IOTVEX_HTTPS_PORT || 8443),
      customDomain: process.env.IOTVEX_CUSTOM_DOMAIN || "",
      providers: {
        caddy_local: { enabled: true },
        pinggy: { enabled: false, subdomain: "", region: "" },
        cloudflare_tunnel: { enabled: false, hostname: "" },
        ngrok: { enabled: false, domain: "" },
        tailscale_funnel: { enabled: false, hostname: "" },
      },
    },
    cloudWww: { baseUrl: process.env.IOTVEX_CLOUD_WWW_URL || "" },
    bridge: {
      autoFromMatrix: true,
      exposeLocalDb: false,
      exposeAgent: false,
      localDbPublicUrl: "",
      agentPublicUrl: "",
      wwwPublicUrl: "",
      preferredProvider: process.env.IOTVEX_PUBLISH_PROVIDER || "cloudflare_tunnel",
    },
    db: {
      mode: normalizeDbMode(process.env.IOTVEX_DB_MODE),
      local: {
        url:
          process.env.IOTVEX_LOCAL_SUPABASE_URL ||
          "http://host.docker.internal:54321",
        browserUrl: "/supabase",
        publicUrl: "",
      },
      cloudPublic: {
        url: process.env.IOTVEX_CLOUD_PUBLIC_SUPABASE_URL || "",
        anonKey: process.env.IOTVEX_CLOUD_PUBLIC_ANON_KEY || "",
      },
      cloudPrivate: {
        url: process.env.IOTVEX_CLOUD_PRIVATE_SUPABASE_URL || "",
        anonKey: process.env.IOTVEX_CLOUD_PRIVATE_ANON_KEY || "",
      },
    },
  }
}

export function defaultSecretsFile(): RuntimeSecretsFile {
  return {
    version: 1,
    db: {
      local: { serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "" },
      cloudPublic: {
        serviceRoleKey: process.env.IOTVEX_CLOUD_PUBLIC_SERVICE_ROLE_KEY || "",
      },
      cloudPrivate: {
        serviceRoleKey: process.env.IOTVEX_CLOUD_PRIVATE_SERVICE_ROLE_KEY || "",
      },
    },
    publish: {
      pinggy: { authtoken: "" },
      cloudflare_tunnel: { tunnelToken: "" },
      ngrok: { authtoken: "" },
    },
  }
}

export function loadRuntimeFile(): RuntimeFile {
  const { configPath } = runtimePaths()
  const base = defaultRuntimeFile()
  const file = readJsonFile<RuntimeFile>(configPath, base)
  file.wwwMode = normalizeWwwMode(file.wwwMode)
  file.db.mode = normalizeDbMode(file.db.mode)
  file.mdnsName = (file.mdnsName || "iotvex.local").trim() || "iotvex.local"
  file.publish = {
    ...base.publish,
    ...file.publish,
    providers: { ...base.publish.providers, ...(file.publish?.providers || {}) },
  }
  file.db = {
    ...base.db,
    ...file.db,
    local: { ...base.db.local, ...(file.db?.local || {}) },
    cloudPublic: { ...base.db.cloudPublic, ...(file.db?.cloudPublic || {}) },
    cloudPrivate: { ...base.db.cloudPrivate, ...(file.db?.cloudPrivate || {}) },
  }
  // ---- ENV overrides (important for Vercel/cloud deployments) ----
  // runtime.json is shipped with repo; env must be able to override it.
  const envWww = process.env.IOTVEX_WWW_MODE
  if (envWww) file.wwwMode = normalizeWwwMode(envWww)

  const envDb = process.env.IOTVEX_DB_MODE
  if (envDb) file.db.mode = normalizeDbMode(envDb)

  const envMdns = process.env.IOTVEX_MDNS_NAME
  if (envMdns) file.mdnsName = String(envMdns).trim() || file.mdnsName

  const envTz = process.env.IOTVEX_TZ || process.env.TZ
  if (envTz) file.timezone = String(envTz)

  const envLocalUrl = process.env.IOTVEX_LOCAL_SUPABASE_URL
  if (envLocalUrl) file.db.local.url = String(envLocalUrl)

  // For local DB proxy: keep using same-origin /supabase unless explicitly overridden.
  const envBrowser = process.env.NEXT_PUBLIC_SUPABASE_BROWSER_URL
  if (envBrowser) file.db.local.browserUrl = String(envBrowser)

  const envCloudPublicUrl = process.env.IOTVEX_CLOUD_PUBLIC_SUPABASE_URL
  if (envCloudPublicUrl) file.db.cloudPublic.url = String(envCloudPublicUrl)

  const envCloudPrivateUrl = process.env.IOTVEX_CLOUD_PRIVATE_SUPABASE_URL
  if (envCloudPrivateUrl) file.db.cloudPrivate.url = String(envCloudPrivateUrl)

  file.cloudWww = { ...base.cloudWww, ...(file.cloudWww || {}) }
  file.bridge = { ...base.bridge, ...(file.bridge || {}) }
  return file
}

export function loadSecretsFile(): RuntimeSecretsFile {
  const { secretsPath } = runtimePaths()
  const base = defaultSecretsFile()
  const file = readJsonFile<RuntimeSecretsFile>(secretsPath, base)
  file.db = {
    local: { ...base.db.local, ...(file.db?.local || {}) },
    cloudPublic: { ...base.db.cloudPublic, ...(file.db?.cloudPublic || {}) },
    cloudPrivate: { ...base.db.cloudPrivate, ...(file.db?.cloudPrivate || {}) },
  }
  return file
}

export function saveRuntimeFile(patch: Partial<RuntimeFile> & Record<string, unknown>) {
  const current = loadRuntimeFile()
  const next: RuntimeFile = {
    ...current,
    ...patch,
    version: 1,
    publish: {
      ...current.publish,
      ...(patch.publish || {}),
      providers: {
        ...current.publish.providers,
        ...((patch.publish as RuntimeFile["publish"] | undefined)?.providers || {}),
      },
    },
    cloudWww: { ...current.cloudWww, ...(patch.cloudWww || {}) },
    bridge: { ...current.bridge, ...(patch.bridge || {}) },
    db: {
      ...current.db,
      ...(patch.db || {}),
      local: { ...current.db.local, ...((patch.db as RuntimeFile["db"] | undefined)?.local || {}) },
      cloudPublic: {
        ...current.db.cloudPublic,
        ...((patch.db as RuntimeFile["db"] | undefined)?.cloudPublic || {}),
      },
      cloudPrivate: {
        ...current.db.cloudPrivate,
        ...((patch.db as RuntimeFile["db"] | undefined)?.cloudPrivate || {}),
      },
      mode: normalizeDbMode(
        (patch.db as RuntimeFile["db"] | undefined)?.mode ?? current.db.mode,
      ),
    },
    wwwMode: normalizeWwwMode(
      (patch.wwwMode as string | undefined) ?? current.wwwMode,
    ),
    mdnsName:
      String(patch.mdnsName ?? current.mdnsName).trim() || "iotvex.local",
  }
  writeJsonFile(runtimePaths().configPath, next)
  return next
}

export function saveSecretsFile(patch: Partial<RuntimeSecretsFile>) {
  const current = loadSecretsFile()
  const next: RuntimeSecretsFile = {
    version: 1,
    db: {
      local: { ...current.db.local, ...(patch.db?.local || {}) },
      cloudPublic: { ...current.db.cloudPublic, ...(patch.db?.cloudPublic || {}) },
      cloudPrivate: {
        ...current.db.cloudPrivate,
        ...(patch.db?.cloudPrivate || {}),
      },
    },
    publish: { ...(current.publish || {}), ...(patch.publish || {}) },
  }
  writeJsonFile(runtimePaths().secretsPath, next, 0o600)
  return next
}

export function isLocalOrPrivateUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase()
    if (host === "127.0.0.1" || host === "localhost" || host === "::1") return true
    if (host === "host.docker.internal") return true
    if (host.endsWith(".local")) return true
    if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true
    if (/^192\.168\.\d+\.\d+$/.test(host)) return true
    const m = host.match(/^172\.(\d+)\./)
    if (m) {
      const n = Number(m[1])
      if (n >= 16 && n <= 31) return true
    }
    return false
  } catch {
    return false
  }
}

function activeDbBundle(file: RuntimeFile, secrets: RuntimeSecretsFile) {
  const mode = file.db.mode
  if (mode === "cloud_public") {
    return {
      mode,
      url: file.db.cloudPublic.url,
      anonKey: file.db.cloudPublic.anonKey,
      serviceRoleKey: secrets.db.cloudPublic.serviceRoleKey,
      browserUrl: file.db.cloudPublic.url,
    }
  }
  if (mode === "cloud_private") {
    return {
      mode,
      url: file.db.cloudPrivate.url,
      anonKey: file.db.cloudPrivate.anonKey,
      serviceRoleKey: secrets.db.cloudPrivate.serviceRoleKey,
      browserUrl: file.db.cloudPrivate.url,
    }
  }
  // local — prefer env service role if secrets empty (bootstrap)
  return {
    mode: "local" as const,
    url: file.db.local.url || "http://host.docker.internal:54321",
    anonKey:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      "",
    serviceRoleKey:
      secrets.db.local.serviceRoleKey ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      "",
    browserUrl: file.db.local.browserUrl || "/supabase",
  }
}

export function getRuntimeConfig(): ResolvedRuntime {
  const file = loadRuntimeFile()
  const secrets = loadSecretsFile()
  const db = activeDbBundle(file, secrets)
  const agentUrl =
    process.env.IOTVEX_AGENT_URL || "http://127.0.0.1:7421"
  const { configPath, secretsPath } = runtimePaths()
  const mdns = file.mdnsName.endsWith(".local")
    ? file.mdnsName
    : `${file.mdnsName}.local`

  return {
    devicePlane: "local",
    wwwMode: file.wwwMode,
    dbMode: db.mode,
    mdnsName: mdns,
    timezone: file.timezone || process.env.IOTVEX_TZ || process.env.TZ || "UTC",
    agentUrl,
    agentIsLocal: isLocalOrPrivateUrl(agentUrl),
    automationsScheduler: "home-systemd",
    supabaseUrl: db.url,
    supabaseAnonKey: db.anonKey,
    supabaseServiceRoleKey: db.serviceRoleKey,
    supabaseBrowserUrl: db.browserUrl,
    publish: file.publish,
    cloudWww: file.cloudWww,
    httpPort: file.publish.httpPort,
    httpsPort: file.publish.httpsPort,
    access: {
      lanHttp: `http://<lan-ip>:${file.publish.httpPort}`,
      lanHttps: `https://<lan-ip>:${file.publish.httpsPort}`,
      mdnsHttp: `http://${mdns}:${file.publish.httpPort}`,
      mdnsHttps: `https://${mdns}:${file.publish.httpsPort}`,
      customDomain: file.publish.customDomain || null,
      published: file.wwwMode === "local_published",
    },
    bridge: effectiveBridge(file),
    matrix: (() => {
      const m = matrixCell(file.wwwMode, db.mode)
      return {
        needsWwwPublish: m.needsWwwPublish,
        needsLocalDbBridge: m.needsLocalDbBridge,
        needsAgentBridge: m.needsAgentBridge,
        summary: m.summary,
      }
    })(),
    supabasePublicUrl:
      db.mode === "local"
        ? file.bridge.localDbPublicUrl ||
          file.db.local.publicUrl ||
          null
        : db.url || null,
    agentPublicUrl: file.bridge.agentPublicUrl || null,
    configPath,
    secretsPath,
  }
}

/** Resolve expose flags from matrix unless user disabled auto. */
export function effectiveBridge(file: RuntimeFile = loadRuntimeFile()) {
  const m = matrixCell(file.wwwMode, file.db.mode)
  const auto = file.bridge?.autoFromMatrix !== false
  return {
    autoFromMatrix: auto,
    exposeLocalDb: auto ? m.needsLocalDbBridge || file.bridge.exposeLocalDb : file.bridge.exposeLocalDb,
    exposeAgent: auto ? m.needsAgentBridge || file.bridge.exposeAgent : file.bridge.exposeAgent,
    localDbPublicUrl: file.bridge.localDbPublicUrl || file.db.local.publicUrl || "",
    agentPublicUrl: file.bridge.agentPublicUrl || "",
    wwwPublicUrl: file.bridge.wwwPublicUrl || "",
    preferredProvider: file.bridge.preferredProvider || "cloudflare_tunnel",
  }
}

/** Public (non-secret) snapshot for Settings /api/runtime */
export function publicRuntimeView(runtime = getRuntimeConfig()) {
  return {
    devicePlane: runtime.devicePlane,
    wwwMode: runtime.wwwMode,
    dbMode: runtime.dbMode,
    mdnsName: runtime.mdnsName,
    timezone: runtime.timezone,
    agentUrl: runtime.agentUrl,
    agentIsLocal: runtime.agentIsLocal,
    automationsScheduler: runtime.automationsScheduler,
    supabaseUrlHost: safeHost(runtime.supabaseUrl),
    supabaseBrowserUrl: runtime.supabaseBrowserUrl,
    httpPort: runtime.httpPort,
    httpsPort: runtime.httpsPort,
    access: runtime.access,
    publish: {
      customDomain: runtime.publish.customDomain,
      httpPort: runtime.publish.httpPort,
      httpsPort: runtime.publish.httpsPort,
      providers: Object.fromEntries(
        Object.entries(runtime.publish.providers || {}).map(([id, p]) => [
          id,
          {
            enabled: Boolean(p?.enabled),
            subdomain: p?.subdomain || "",
            region: p?.region || "",
            hostname: p?.hostname || "",
            domain: p?.domain || "",
            hasSecret: Boolean(
              p?.authtoken ||
                p?.tunnelToken ||
                // secrets file may hold tokens
                false,
            ),
          },
        ]),
      ),
    },
    cloudWww: {
      baseUrl: runtime.cloudWww.baseUrl || "",
    },
    dbTargets: {
      local: { configured: true },
      cloud_public: {
        configured: Boolean(loadRuntimeFile().db.cloudPublic.url),
      },
      cloud_private: {
        configured: Boolean(loadRuntimeFile().db.cloudPrivate.url),
      },
    },
    bridge: runtime.bridge,
    matrix: runtime.matrix,
    supabasePublicUrl: runtime.supabasePublicUrl,
    agentPublicUrl: runtime.agentPublicUrl,
  }
}

function safeHost(url: string): string {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.host}`
  } catch {
    return "(invalid)"
  }
}

// Legacy aliases used during migration
export function inferDbMode(supabaseUrl: string): DbMode {
  try {
    const u = new URL(supabaseUrl)
    const host = u.hostname.toLowerCase()
    if (
      host === "127.0.0.1" ||
      host === "localhost" ||
      host === "::1" ||
      host === "host.docker.internal" ||
      host.endsWith(".local")
    ) {
      return "local"
    }
    return "cloud_private"
  } catch {
    return "local"
  }
}
