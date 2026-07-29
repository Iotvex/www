/**
 * React Three Fiber scene helpers for Plana worlds.
 *
 * @packageDocumentation
 */

export { PlanaCanvas } from './PlanaCanvas'
export type { PlanaCanvasProps } from './PlanaCanvas'
export { PlanaWorldMesh } from './PlanaWorldMesh'
export type { PlanaWorldMeshProps } from './PlanaWorldMesh'
export { PlanaDimensions } from './PlanaDimensions'
export type { DimensionsMode, PlanaDimensionsProps } from './PlanaDimensions'
export { meshToBufferGeometry } from './mesh-utils'
export {
    appendHatchLocal,
    buildHatchGeometry,
    buildWorldHatchGeometry,
    HATCH_EDGE_OPACITY,
    HATCH_ELEVATIONS,
    HATCH_STEP,
} from './hatch-utils'
export type { AppendHatchOptions, HatchSolidInput } from './hatch-utils'
