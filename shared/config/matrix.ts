/**
 * Every WWW mode × every DB mode is supported.
 * Some combos need a home bridge (tunnel) so cloud/remote UI can reach local services.
 */

import type { DbMode, WwwMode } from "@/shared/config/runtime"

export type MatrixCell = {
  www: WwwMode
  db: DbMode
  supported: true
  needsWwwPublish: boolean
  needsLocalDbBridge: boolean
  needsAgentBridge: boolean
  summary: string
}

export function matrixCell(www: WwwMode, db: DbMode): MatrixCell {
  const cloudWww = www === "cloud"
  const localDb = db === "local"
  const published = www === "local_published"

  return {
    www,
    db,
    supported: true,
    needsWwwPublish: published,
    needsLocalDbBridge: cloudWww && localDb,
    needsAgentBridge: cloudWww,
    summary: cloudWww
      ? localDb
        ? "Cloud UI + local DB: tunnel Supabase + agent from home."
        : "Cloud UI + cloud DB: tunnel agent from home; DB is remote."
      : published
        ? "Self-hosted UI with public HTTPS; DB may be local or cloud."
        : "Self-hosted LAN/mDNS UI; DB may be local or cloud.",
  }
}

export const ALL_WWW: WwwMode[] = ["local", "local_published", "cloud"]
export const ALL_DB: DbMode[] = ["local", "cloud_public", "cloud_private"]

export function fullMatrix(): MatrixCell[] {
  const out: MatrixCell[] = []
  for (const www of ALL_WWW) {
    for (const db of ALL_DB) out.push(matrixCell(www, db))
  }
  return out
}
