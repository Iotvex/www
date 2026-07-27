/**
 * Public integration surface for host applications.
 *
 * Domain logic (devices, automations, networking) stays outside.
 * Attach business data via `setNodeMetadata` / `metadata` on create.
 */

export { SpatialEngine, type SpatialEngineOptions } from "./core/engine"
export { EventBus, type SpatialEventMap, type SpatialEventName } from "./core/events"
export type {
  Vec2,
  Vec3,
  Quat,
  TransformTRS,
  Aabb,
  NodeId,
  LayerId,
  AssetId,
  NodeMetadata,
} from "./core/types"
export { vec3, newId } from "./core/types"
export type { SceneNode, GeometryRef } from "./scene/node"
export type { Layer } from "./scene/layers"
export type { CameraMode, CameraBookmark } from "./camera/camera"
export type { EditorToolId, SnapSettings } from "./editing/tools"
export type { SpatialPlugin, SpatialPluginContext } from "./plugins/plugin"
export type { SpatialDocument, Importer, Exporter } from "./serialize/format"
export { SPATIAL_DOC_VERSION } from "./serialize/format"
export { SpatialViewport } from "./host/react/SpatialViewport"
export { useSpatialEngine } from "./host/react/useSpatialEngine"
export { seedDemoApartment } from "./demo/apartment"
