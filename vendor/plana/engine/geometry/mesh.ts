import type { Mesh } from '../types/nodes'
import type { Mat4 } from '../math'
import { mat4TransformDirection, mat4TransformPoint } from '../math'
import type { Vec3 } from '../types/nodes/math'

/**
 * Create an empty mesh with positions, indices, and normals arrays.
 *
 * @returns A new empty {@link Mesh}.
 */
export const emptyMesh = (): Mesh => ({
    positions: [],
    indices: [],
    normals: [],
})

/**
 * Concatenate meshes into one indexed mesh (re-indexing as needed).
 *
 * @param meshes - Meshes to merge in order.
 * @returns A single combined {@link Mesh}.
 */
export const mergeMeshes = (meshes: Mesh[]): Mesh => {
    const positions: number[] = []
    const normals: number[] = []
    const indices: number[] = []
    let vertexOffset = 0

    for (const mesh of meshes) {
        positions.push(...mesh.positions)
        if (mesh.normals?.length) {
            normals.push(...mesh.normals)
        } else {
            const count = mesh.positions.length / 3
            for (let i = 0; i < count; i++) normals.push(0, 1, 0)
        }
        const src = mesh.indices
        if (src?.length) {
            for (const i of src) indices.push(i + vertexOffset)
        } else {
            const count = mesh.positions.length / 3
            for (let i = 0; i < count; i++) indices.push(vertexOffset + i)
        }
        vertexOffset += mesh.positions.length / 3
    }

    return { positions, indices, normals }
}

/**
 * Transform mesh positions (and normals) by a matrix.
 *
 * @param mesh - Source mesh.
 * @param matrix - World or local transform.
 * @returns A new transformed mesh (indices/uvs copied).
 */
export const transformMesh = (mesh: Mesh, matrix: Mat4): Mesh => {
    const positions: number[] = []
    const normals: number[] = []
    const vcount = mesh.positions.length / 3

    for (let i = 0; i < vcount; i++) {
        const p = mat4TransformPoint(matrix, {
            x: mesh.positions[i * 3],
            y: mesh.positions[i * 3 + 1],
            z: mesh.positions[i * 3 + 2],
        })
        positions.push(p.x, p.y, p.z)

        if (mesh.normals?.length) {
            const n = mat4TransformDirection(matrix, {
                x: mesh.normals[i * 3],
                y: mesh.normals[i * 3 + 1],
                z: mesh.normals[i * 3 + 2],
            })
            const len = Math.hypot(n.x, n.y, n.z) || 1
            normals.push(n.x / len, n.y / len, n.z / len)
        }
    }

    return {
        positions,
        indices: mesh.indices ? [...mesh.indices] : undefined,
        normals: normals.length ? normals : undefined,
        uvs: mesh.uvs ? [...mesh.uvs] : undefined,
    }
}

/**
 * Recompute flat-averaged vertex normals from triangles.
 *
 * @param mesh - Mesh with positions (and optional indices).
 * @returns A new mesh with `normals` filled.
 */
export const computeVertexNormals = (mesh: Mesh): Mesh => {
    const indices = mesh.indices ?? [...Array(mesh.positions.length / 3).keys()]
    const normals = new Array(mesh.positions.length).fill(0)

    const get = (i: number): Vec3 => ({
        x: mesh.positions[i * 3],
        y: mesh.positions[i * 3 + 1],
        z: mesh.positions[i * 3 + 2],
    })

    for (let t = 0; t < indices.length; t += 3) {
        const ia = indices[t]
        const ib = indices[t + 1]
        const ic = indices[t + 2]
        const a = get(ia)
        const b = get(ib)
        const c = get(ic)
        const abx = b.x - a.x
        const aby = b.y - a.y
        const abz = b.z - a.z
        const acx = c.x - a.x
        const acy = c.y - a.y
        const acz = c.z - a.z
        const nx = aby * acz - abz * acy
        const ny = abz * acx - abx * acz
        const nz = abx * acy - aby * acx
        for (const i of [ia, ib, ic]) {
            normals[i * 3] += nx
            normals[i * 3 + 1] += ny
            normals[i * 3 + 2] += nz
        }
    }

    for (let i = 0; i < normals.length; i += 3) {
        const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1
        normals[i] /= len
        normals[i + 1] /= len
        normals[i + 2] /= len
    }

    return { ...mesh, normals, indices: [...indices] }
}

/**
 * Append a quad (two triangles) to position/index buffers.
 *
 * @param positions - Mutable position buffer (`x,y,z` triples).
 * @param indices - Mutable index buffer.
 * @param a - First corner.
 * @param b - Second corner.
 * @param c - Third corner.
 * @param d - Fourth corner.
 * @returns Nothing; mutates `positions` and `indices`.
 */
export const pushQuad = (positions: number[], indices: number[], a: Vec3, b: Vec3, c: Vec3, d: Vec3): void => {
    const base = positions.length / 3
    for (const p of [a, b, c, d]) positions.push(p.x, p.y, p.z)
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
}
