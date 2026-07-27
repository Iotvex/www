import type { Aabb, LayerId, NodeId, NodeMetadata, TransformTRS } from "../core/types"
import { createDefaultTransform, newId, ZERO_VEC3 } from "../core/types"

export type GeometryRef =
  | { kind: "primitive"; primitive: "box" | "plane" | "cylinder" | "sphere" | "grid" }
  | { kind: "mesh"; meshId: string }
  | { kind: "none" }

export type SceneNode = {
  id: NodeId
  name: string
  parentId: NodeId | null
  childIds: NodeId[]
  transform: TransformTRS
  /** Local AABB in object space (optional). */
  localBounds: Aabb | null
  visible: boolean
  locked: boolean
  layerId: LayerId
  geometry: GeometryRef
  /** Host-owned opaque data. */
  metadata: NodeMetadata
}

export function createSceneNode(partial?: Partial<SceneNode> & { name?: string }): SceneNode {
  return {
    id: partial?.id ?? newId("node"),
    name: partial?.name ?? "Object",
    parentId: partial?.parentId ?? null,
    childIds: partial?.childIds ? [...partial.childIds] : [],
    transform: partial?.transform ? structuredClone(partial.transform) : createDefaultTransform(),
    localBounds: partial?.localBounds ?? {
      min: { x: -0.5, y: -0.5, z: -0.5 },
      max: { x: 0.5, y: 0.5, z: 0.5 },
    },
    visible: partial?.visible ?? true,
    locked: partial?.locked ?? false,
    layerId: partial?.layerId ?? "default",
    geometry: partial?.geometry ?? { kind: "primitive", primitive: "box" },
    metadata: partial?.metadata ? { ...partial.metadata } : {},
  }
}

export function emptyAabb(): Aabb {
  return { min: { ...ZERO_VEC3 }, max: { ...ZERO_VEC3 } }
}
