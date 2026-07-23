
export type DbArea = {
  id: string
  name: string
  icon: string | null
  sort_order: number
}

export type DbDevice = {
  id: string
  name: string
  manufacturer: string | null
  model: string | null
  area_id: string | null
  platform: string
  external_id: string | null
  meta: Record<string, unknown>
}

export type DbEntity = {
  id: string
  device_id: string | null
  domain: string
  name: string
  area_id: string | null
  capabilities: string[]
  attributes: Record<string, unknown>
  enabled: boolean
}

export type DbEntityState = {
  entity_id: string
  state: string
  attributes: Record<string, unknown>
  available: boolean
  last_changed: string
}

export type DbAutomation = {
  id: string
  name: string
  description: string
  enabled: boolean
  trigger: Record<string, unknown>
  conditions: unknown[]
  actions: unknown[]
  mode: string
  ha_entity_id: string | null
  last_triggered: string | null
}

export type DbScript = {
  id: string
  name: string
  description: string
  sequence: unknown[]
  mode: string
  last_triggered: string | null
}

export type DbScene = {
  id: string
  name: string
  description: string
  entities: Record<string, Record<string, unknown>>
  area_id: string | null
}

export type HomeCatalog = {
  areas: DbArea[]
  devices: DbDevice[]
  entities: DbEntity[]
  states: DbEntityState[]
  automations: DbAutomation[]
  scripts: DbScript[]
  scenes: DbScene[]
}
