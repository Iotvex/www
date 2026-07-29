import type { Mesh } from '../types/nodes'
import { mat4Translate } from '../math'
import { mergeMeshes, transformMesh, computeVertexNormals } from './mesh'

export const buildSphereMesh = (radius: number, segments = 24, rings = 16): Mesh => {
    const positions: number[] = []
    const indices: number[] = []

    for (let y = 0; y <= rings; y++) {
        const v = y / rings
        const phi = v * Math.PI
        for (let x = 0; x <= segments; x++) {
            const u = x / segments
            const theta = u * Math.PI * 2
            const sx = Math.cos(theta) * Math.sin(phi)
            const sy = Math.cos(phi)
            const sz = Math.sin(theta) * Math.sin(phi)
            positions.push(sx * radius, sy * radius, sz * radius)
        }
    }

    for (let y = 0; y < rings; y++) {
        for (let x = 0; x < segments; x++) {
            const a = y * (segments + 1) + x
            const b = a + segments + 1
            indices.push(a, b, a + 1, b, b + 1, a + 1)
        }
    }

    return computeVertexNormals({ positions, indices })
}

export const buildCylinderMesh = (radius: number, height: number, segments = 24): Mesh => {
    const positions: number[] = []
    const indices: number[] = []
    const hy = height / 2

    for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * Math.PI * 2
        const x = Math.cos(t) * radius
        const z = Math.sin(t) * radius
        positions.push(x, -hy, z, x, hy, z)
    }
    for (let i = 0; i < segments; i++) {
        const a = i * 2
        const b = a + 1
        const c = a + 2
        const d = a + 3
        indices.push(a, c, b, b, c, d)
    }

    const bottomCenter = positions.length / 3
    positions.push(0, -hy, 0)
    const topCenter = positions.length / 3
    positions.push(0, hy, 0)

    for (let i = 0; i < segments; i++) {
        const a = i * 2
        const c = a + 2
        indices.push(bottomCenter, c, a)
        const b = a + 1
        const d = a + 3
        indices.push(topCenter, b, d)
    }

    return computeVertexNormals({ positions, indices })
}

export const buildCapsuleMesh = (radius: number, height: number): Mesh => {
    const cylH = Math.max(height - radius * 2, 1e-6)
    const cyl = buildCylinderMesh(radius, cylH)
    const hemi = buildSphereMesh(radius, 16, 8)
    const top = transformMesh(hemi, mat4Translate(0, cylH / 2, 0))
    const bottom = transformMesh(hemi, mat4Translate(0, -cylH / 2, 0))
    return mergeMeshes([cyl, top, bottom])
}
