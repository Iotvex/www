import type { AssetId } from "../core/types"
import { newId } from "../core/types"
import type { GeometryRef } from "../scene/node"
import type { TransformTRS } from "../core/types"
import { createDefaultTransform } from "../core/types"

/** Reusable prototype — spawn instances into the scene graph later. */
export type SpatialAsset = {
  id: AssetId
  name: string
  geometry: GeometryRef
  defaultTransform: TransformTRS
  metadata?: Record<string, unknown>
}

export class AssetRegistry {
  private assets = new Map<AssetId, SpatialAsset>()

  register(partial: Omit<SpatialAsset, "id" | "defaultTransform"> & { id?: AssetId; defaultTransform?: TransformTRS }): SpatialAsset {
    const asset: SpatialAsset = {
      id: partial.id ?? newId("asset"),
      name: partial.name,
      geometry: partial.geometry,
      defaultTransform: partial.defaultTransform ?? createDefaultTransform(),
      metadata: partial.metadata,
    }
    this.assets.set(asset.id, asset)
    return asset
  }

  get(id: AssetId): SpatialAsset | undefined {
    return this.assets.get(id)
  }

  list(): SpatialAsset[] {
    return [...this.assets.values()]
  }
}
