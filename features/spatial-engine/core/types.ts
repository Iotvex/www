/** Shared math & identity types — renderer-agnostic. */

export type Vec2 = { x: number; y: number }
export type Vec3 = { x: number; y: number; z: number }
export type Quat = { x: number; y: number; z: number; w: number }

export type TransformTRS = {
  position: Vec3
  rotation: Quat
  scale: Vec3
}

export type Aabb = {
  min: Vec3
  max: Vec3
}

export type NodeId = string
export type LayerId = string
export type AssetId = string
export type CameraBookmarkId = string

/** Opaque bag owned by the host application. */
export type NodeMetadata = Record<string, unknown>

export const IDENTITY_QUAT: Quat = { x: 0, y: 0, z: 0, w: 1 }
export const ONE_VEC3: Vec3 = { x: 1, y: 1, z: 1 }
export const ZERO_VEC3: Vec3 = { x: 0, y: 0, z: 0 }

export function createDefaultTransform(): TransformTRS {
  return {
    position: { ...ZERO_VEC3 },
    rotation: { ...IDENTITY_QUAT },
    scale: { ...ONE_VEC3 },
  }
}

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z }
}

export function newId(prefix = "n"): NodeId {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}
