import type { IndependentObject, Mesh } from '../types/nodes'
import { buildExtrudeMesh } from './extrude'
import { buildShapeMesh, buildCutoutMesh, cutoutToHoleRings, cutoutsToWallGaps } from './build-shape'
import { buildWallMesh } from './wall'

/**
 * Tessellation result for one independent object in local space.
 */
export type IndependentGeometry = {
    /** Host solid in object local space (cutouts baked where supported). */
    solid: Mesh
    /** Cutout volumes in object local space (for fills / future CSG). */
    cutouts: Mesh[]
}

/**
 * Tessellate an {@link IndependentObject} in its local space (origin = Bounds center).
 *
 * - `wall`: `pathOffset` cutouts become elevation holes in one extruded prism
 * - `extrude`: cutouts become holes in the plan
 * - other shapes: solid only; cutout meshes are still listed separately
 *
 * @param object - Independent object to tessellate.
 * @returns Solid mesh plus per-cutout meshes in object local space.
 *
 * @example
 * ```ts
 * const { solid, cutouts } = buildIndependentGeometry(wall)
 * ```
 */
export const buildIndependentGeometry = (object: IndependentObject): IndependentGeometry => {
    const shape = object.shape ?? { kind: 'box' }
    const cutoutMeshes = (object.cutouts ?? []).map(buildCutoutMesh)

    if (shape.kind === 'wall') {
        const gaps = cutoutsToWallGaps(object.cutouts)
        const solid = buildWallMesh(shape.path, shape.thickness, -object.height / 2, object.height / 2, gaps)
        return { solid, cutouts: cutoutMeshes }
    }

    if (shape.kind === 'extrude') {
        const holes = (object.cutouts ?? []).flatMap(cutoutToHoleRings)
        const solid = buildExtrudeMesh(shape.contour, -object.height / 2, object.height / 2, holes)
        return { solid, cutouts: cutoutMeshes }
    }

    return {
        solid: buildShapeMesh(shape, object),
        cutouts: cutoutMeshes,
    }
}
