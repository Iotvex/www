import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { loadHomeCatalog } from "@/shared/lib/home/catalog"
import { normalizeDbMode, type DbMode } from "@/shared/config/runtime"
import {
  loadRuntimeFile,
  loadSecretsFile,
  saveRuntimeFile,
  saveSecretsFile,
  getRuntimeConfig,
} from "@/shared/config/runtime.server"

export type DbEndpoint = {
  mode: DbMode
  url: string
  anonKey?: string
  serviceRoleKey: string
}

const CATALOG_TABLES = [
  "areas",
  "devices",
  "entities",
  "automations",
  "scripts",
  "scenes",
  "dashboard_widgets",
  "modules",
  "user_preferences",
] as const

export function adminFromEndpoint(ep: DbEndpoint): SupabaseClient {
  if (!ep.url) throw new Error("target supabase url is empty")
  if (!ep.serviceRoleKey) throw new Error("target service role key is empty")
  return createClient(ep.url, ep.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Probe connectivity + basic schema presence. */
export async function probeDatabase(ep: DbEndpoint) {
  const sb = adminFromEndpoint(ep)
  const checks: Record<string, { ok: boolean; count?: number; error?: string }> = {}
  for (const table of ["areas", "automations", "devices"] as const) {
    const { error, count } = await sb.from(table).select("*", { count: "exact", head: true })
    checks[table] = error
      ? { ok: false, error: error.message }
      : { ok: true, count: count ?? 0 }
  }
  const ok = Object.values(checks).every((c) => c.ok)
  return { ok, urlHost: safeHost(ep.url), mode: ep.mode, checks }
}

function safeHost(url: string) {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.host}`
  } catch {
    return "(invalid)"
  }
}

type CatalogDump = {
  version: number
  exported_at: string
  areas: unknown[]
  devices: unknown[]
  entities: unknown[]
  automations: unknown[]
  scripts: unknown[]
  scenes: unknown[]
  widgets: unknown[]
  modules: unknown[]
  preferences?: unknown[]
}

async function exportCatalogFrom(sb: SupabaseClient): Promise<CatalogDump> {
  // Prefer existing helper when talking to current runtime DB.
  // For arbitrary endpoints, read tables directly.
  const dump: CatalogDump = {
    version: 1,
    exported_at: new Date().toISOString(),
    areas: [],
    devices: [],
    entities: [],
    automations: [],
    scripts: [],
    scenes: [],
    widgets: [],
    modules: [],
    preferences: [],
  }

  async function all(table: string) {
    const { data, error } = await sb.from(table).select("*")
    if (error) throw new Error(`${table}: ${error.message}`)
    return data || []
  }

  dump.areas = await all("areas")
  dump.devices = await all("devices")
  dump.entities = await all("entities")
  dump.automations = await all("automations")
  dump.scripts = await all("scripts")
  dump.scenes = await all("scenes")
  dump.widgets = await all("dashboard_widgets")
  dump.modules = await all("modules")
  try {
    dump.preferences = await all("user_preferences")
  } catch {
    dump.preferences = []
  }
  return dump
}

/** Merge/upsert catalog into target. Source rows win by primary id. */
export async function mergeCatalogInto(
  target: SupabaseClient,
  dump: CatalogDump,
): Promise<{ imported: number; tables: Record<string, number> }> {
  const tables: Record<string, number> = {}
  let imported = 0

  async function upsert(table: string, rows: unknown[]) {
    if (!rows?.length) {
      tables[table] = 0
      return
    }
    const { error } = await target.from(table).upsert(rows as never[])
    if (error) throw new Error(`${table}: ${error.message}`)
    tables[table] = rows.length
    imported += rows.length
  }

  await upsert("areas", dump.areas)
  await upsert("devices", dump.devices)
  await upsert("entities", dump.entities)
  await upsert("automations", dump.automations)
  await upsert("scripts", dump.scripts)
  await upsert("scenes", dump.scenes)
  await upsert("dashboard_widgets", dump.widgets)
  await upsert("modules", dump.modules)
  if (dump.preferences?.length) {
    await upsert("user_preferences", dump.preferences)
  }
  return { imported, tables }
}

export async function exportCurrentCatalog(): Promise<CatalogDump> {
  // Use table reader against current admin endpoint for consistency
  const runtime = getRuntimeConfig()
  const sb = adminFromEndpoint({
    mode: runtime.dbMode,
    url: runtime.supabaseUrl,
    serviceRoleKey: runtime.supabaseServiceRoleKey,
    anonKey: runtime.supabaseAnonKey,
  })
  return exportCatalogFrom(sb)
}

/**
 * Connect to target → merge current catalog into target → swap active DB mode.
 * Hot-reloads via runtime.json / runtime.secrets.json (no container rebuild).
 */
export async function switchDatabase(opts: {
  mode: DbMode
  url?: string
  anonKey?: string
  serviceRoleKey?: string
  merge?: boolean
}) {
  const mode = normalizeDbMode(opts.mode)
  const file = loadRuntimeFile()
  const secrets = loadSecretsFile()

  let endpoint: DbEndpoint
  if (mode === "local") {
    endpoint = {
      mode,
      url: opts.url || file.db.local.url,
      anonKey: opts.anonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      serviceRoleKey:
        opts.serviceRoleKey ||
        secrets.db.local.serviceRoleKey ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        "",
    }
  } else if (mode === "cloud_public") {
    endpoint = {
      mode,
      url: opts.url || file.db.cloudPublic.url,
      anonKey: opts.anonKey || file.db.cloudPublic.anonKey,
      serviceRoleKey:
        opts.serviceRoleKey || secrets.db.cloudPublic.serviceRoleKey || "",
    }
  } else {
    endpoint = {
      mode,
      url: opts.url || file.db.cloudPrivate.url,
      anonKey: opts.anonKey || file.db.cloudPrivate.anonKey,
      serviceRoleKey:
        opts.serviceRoleKey || secrets.db.cloudPrivate.serviceRoleKey || "",
    }
  }

  if (!endpoint.url) throw new Error(`DB ${mode}: url is required`)
  if (!endpoint.serviceRoleKey) {
    throw new Error(`DB ${mode}: service role key is required to probe/merge`)
  }

  const probe = await probeDatabase(endpoint)
  if (!probe.ok) {
    throw new Error(
      `target DB probe failed: ${JSON.stringify(probe.checks)}`,
    )
  }

  let mergeResult: { imported: number; tables: Record<string, number> } | null =
    null
  if (opts.merge !== false) {
    const current = getRuntimeConfig()
    const same =
      safeHost(current.supabaseUrl) === safeHost(endpoint.url) &&
      current.dbMode === mode
    if (!same) {
      const dump = await exportCurrentCatalog()
      const target = adminFromEndpoint(endpoint)
      mergeResult = await mergeCatalogInto(target, dump)
    } else {
      mergeResult = { imported: 0, tables: {}, } as {
        imported: number
        tables: Record<string, number>
      }
    }
  }

  // Persist connection then flip active mode
  if (mode === "local") {
    saveRuntimeFile({
      db: {
        ...file.db,
        mode,
        local: {
          url: endpoint.url,
          browserUrl: file.db.local.browserUrl || "/supabase",
        },
      },
    })
    if (opts.serviceRoleKey) {
      saveSecretsFile({
        db: { ...secrets.db, local: { serviceRoleKey: endpoint.serviceRoleKey } },
      })
    }
  } else if (mode === "cloud_public") {
    saveRuntimeFile({
      db: {
        ...file.db,
        mode,
        cloudPublic: {
          url: endpoint.url,
          anonKey: endpoint.anonKey || "",
        },
      },
    })
    saveSecretsFile({
      db: {
        ...secrets.db,
        cloudPublic: { serviceRoleKey: endpoint.serviceRoleKey },
      },
    })
  } else {
    saveRuntimeFile({
      db: {
        ...file.db,
        mode,
        cloudPrivate: {
          url: endpoint.url,
          anonKey: endpoint.anonKey || "",
        },
      },
    })
    saveSecretsFile({
      db: {
        ...secrets.db,
        cloudPrivate: { serviceRoleKey: endpoint.serviceRoleKey },
      },
    })
  }

  return {
    ok: true,
    mode,
    probe,
    merge: mergeResult,
    runtime: getRuntimeConfig(),
    reloadRequired: true,
  }
}

// silence unused in some builds
void CATALOG_TABLES
void loadHomeCatalog
