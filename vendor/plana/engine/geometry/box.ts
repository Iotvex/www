import type { Mesh } from '../types/nodes'
import { computeVertexNormals, pushQuad } from './mesh'

/** Axis-aligned box centered at origin. */
export const buildBoxMesh = (width: number, height: number, depth: number): Mesh => {
    const hx = width / 2
    const hy = height / 2
    const hz = depth / 2
    const positions: number[] = []
    const indices: number[] = []

    // +Z / -Z / +X / -X / +Y / -Y
    pushQuad(
        positions,
        indices,
        { x: -hx, y: -hy, z: hz },
        { x: hx, y: -hy, z: hz },
        { x: hx, y: hy, z: hz },
        { x: -hx, y: hy, z: hz },
    )
    pushQuad(
        positions,
        indices,
        { x: hx, y: -hy, z: -hz },
        { x: -hx, y: -hy, z: -hz },
        { x: -hx, y: hy, z: -hz },
        { x: hx, y: hy, z: -hz },
    )
    pushQuad(
        positions,
        indices,
        { x: hx, y: -hy, z: hz },
        { x: hx, y: -hy, z: -hz },
        { x: hx, y: hy, z: -hz },
        { x: hx, y: hy, z: hz },
    )
    pushQuad(
        positions,
        indices,
        { x: -hx, y: -hy, z: -hz },
        { x: -hx, y: -hy, z: hz },
        { x: -hx, y: hy, z: hz },
        { x: -hx, y: hy, z: -hz },
    )
    pushQuad(
        positions,
        indices,
        { x: -hx, y: hy, z: hz },
        { x: hx, y: hy, z: hz },
        { x: hx, y: hy, z: -hz },
        { x: -hx, y: hy, z: -hz },
    )
    pushQuad(
        positions,
        indices,
        { x: -hx, y: -hy, z: -hz },
        { x: hx, y: -hy, z: -hz },
        { x: hx, y: -hy, z: hz },
        { x: -hx, y: -hy, z: hz },
    )

    return computeVertexNormals({ positions, indices })
}
