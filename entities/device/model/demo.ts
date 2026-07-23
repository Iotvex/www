import { inferCapabilities, domainFromEntityId } from "./capabilities"
import { DEMO_SENSORS } from "@/shared/config/catalog"
import type { EntityState } from "./types"

export function demoEntitiesFromCatalog(): EntityState[] {
  return DEMO_SENSORS.map((s) => {
    const domain = domainFromEntityId(s.entity_id)
    const attributes: Record<string, unknown> = {
      friendly_name: s.name,
      unit_of_measurement: "unit" in s ? (s as { unit?: string }).unit : undefined,
      platform: "demo",
    }
    return {
      entity_id: s.entity_id,
      domain,
      name: s.name,
      state: s.state,
      area: s.area,
      available: true,
      attributes,
      capabilities: inferCapabilities(domain, attributes),
    }
  })
}

/** @deprecated use demoEntitiesFromCatalog */
export const catalogToEntities = demoEntitiesFromCatalog
