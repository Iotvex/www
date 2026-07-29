import type { IndependentObject, Mesh, World } from '../types/nodes'
import { isIndependentObject } from '../types/nodes'
import type { Mat4 } from '../math'
import { walkWorld } from '../math'
import { transformMesh } from './mesh'
import { buildIndependentGeometry, type IndependentGeometry } from './build-independent'

/**
 * Built solid for one independent object in world space.
 */
export type WorldSolid = {
    /** Source independent object. */
    object: IndependentObject
    /** Local geometry (baked cutouts where supported). */
    local: IndependentGeometry
    /** Solid mesh transformed to world. */
    worldSolid: Mesh
    /** Accumulated world matrix used for `worldSolid`. */
    worldMatrix: Mat4
}

/**
 * Build all independent solids in a world with world matrices applied.
 *
 * @param world - Root world to tessellate.
 * @returns One {@link WorldSolid} per independent object, depth-first order.
 *
 * @example
 * ```ts
 * const solids = buildWorldSolids(doc.getWorld())
 * for (const s of solids) {
 *   // upload s.worldSolid to the renderer
 * }
 * ```
 */
export const buildWorldSolids = (world: World): WorldSolid[] => {
    const result: WorldSolid[] = []
    walkWorld(world, ({ node, worldMatrix }) => {
        if (!isIndependentObject(node)) return
        const local = buildIndependentGeometry(node)
        result.push({
            object: node,
            local,
            worldSolid: transformMesh(local.solid, worldMatrix),
            worldMatrix,
        })
    })
    return result
}
