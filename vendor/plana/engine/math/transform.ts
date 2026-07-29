import type { Bounds, Node, NodeBase } from '../types/nodes'
import { isApartment, isCompositeObject, isGroup, isIndependentObject, isWorld, isZone } from '../types/nodes'
import type { Mat4 } from './mat4'
import { mat4Identity, mat4Multiply, mat4Translate } from './mat4'

/**
 * Local matrix of a node: translate by its {@link Bounds} center (rotation TBD).
 *
 * @param node - Node providing `x/y/z` center.
 * @returns Translation matrix for the node.
 *
 * @example
 * ```ts
 * const local = nodeLocalMatrix(wall)
 * ```
 */
export const nodeLocalMatrix = (node: NodeBase): Mat4 => mat4Translate(node.x, node.y, node.z)

/**
 * Compose parent world and local matrices (`parent * local`).
 *
 * @param parentWorld - Accumulated parent world matrix.
 * @param local - Node local matrix.
 * @returns Combined world matrix.
 */
export const composeMatrices = (parentWorld: Mat4, local: Mat4): Mat4 => mat4Multiply(parentWorld, local)

/**
 * One visit entry from {@link walkWorld}.
 */
export type WorldNode = {
    /** Visited scene node. */
    node: Node
    /** Accumulated world matrix for `node`. */
    worldMatrix: Mat4
    /** Parent node, or `null` at the walk root. */
    parent: Node | null
}

/**
 * Walk the scene graph accumulating world matrices.
 *
 * Child coordinates are interpreted in parent local space.
 *
 * @param root - Scene node to start from (usually a {@link import('../types/nodes').World}).
 * @param visit - Callback invoked for each visited node.
 * @param parentWorld - Parent world matrix. Defaults to identity.
 * @param parent - Parent node reference, or `null` at the root.
 * @returns Nothing; side-effect via `visit`.
 *
 * @example
 * ```ts
 * walkWorld(world, ({ node, worldMatrix }) => {
 *   if (isIndependentObject(node)) {
 *     // use node.name and worldMatrix
 *   }
 * })
 * ```
 */
export const walkWorld = (
    root: Node,
    visit: (entry: WorldNode) => void,
    parentWorld: Mat4 = mat4Identity(),
    parent: Node | null = null
): void => {
    const worldMatrix = composeMatrices(parentWorld, nodeLocalMatrix(root))
    visit({ node: root, worldMatrix, parent })

    if (isIndependentObject(root)) return

    if (isCompositeObject(root)) {
        for (const child of root.objects) {
            walkWorld(child, visit, worldMatrix, root)
        }
        return
    }

    if (isGroup(root) || isZone(root) || isApartment(root) || isWorld(root)) {
        for (const child of root.children) {
            walkWorld(child, visit, worldMatrix, root)
        }
    }
}

/**
 * Extract size components from bounds.
 *
 * @param b - Bounds to read.
 * @returns `{ width, height, depth }`.
 */
export const boundsSize = (b: Bounds) => ({
    width: b.width,
    height: b.height,
    depth: b.depth,
})
