import type { Vec3 } from '../types/nodes/math'

/**
 * Column-major 4×4 transformation matrix (compatible with Three.js / WebGL).
 */
export type Mat4 = [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
]

/**
 * Create a 4×4 identity matrix.
 *
 * @returns A new identity {@link Mat4}.
 *
 * @example
 * ```ts
 * const m = mat4Identity()
 * ```
 */
export const mat4Identity = (): Mat4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

/**
 * Create a translation matrix.
 *
 * @param x - Translation along X.
 * @param y - Translation along Y.
 * @param z - Translation along Z.
 * @returns A new translation {@link Mat4}.
 *
 * @example
 * ```ts
 * const t = mat4Translate(1, 0, 2)
 * ```
 */
export const mat4Translate = (x: number, y: number, z: number): Mat4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]

/**
 * Multiply two matrices (`out = a * b`, column-major).
 *
 * @param a - Left matrix.
 * @param b - Right matrix.
 * @returns The product as a new {@link Mat4}.
 */
export const mat4Multiply = (a: Mat4, b: Mat4): Mat4 => {
    const out = new Array(16) as number[]
    for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
            out[col * 4 + row] =
                a[row] * b[col * 4] +
                a[4 + row] * b[col * 4 + 1] +
                a[8 + row] * b[col * 4 + 2] +
                a[12 + row] * b[col * 4 + 3]
        }
    }
    return out as Mat4
}

/**
 * Transform a point by a matrix (applies translation).
 *
 * @param m - Transformation matrix.
 * @param p - Point in the matrix's input space.
 * @returns Transformed point.
 */
export const mat4TransformPoint = (m: Mat4, p: Vec3): Vec3 => ({
    x: m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12],
    y: m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13],
    z: m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14],
})

/**
 * Transform a direction by a matrix (ignores translation).
 *
 * @param m - Transformation matrix.
 * @param d - Direction vector.
 * @returns Transformed direction (not re-normalized).
 */
export const mat4TransformDirection = (m: Mat4, d: Vec3): Vec3 => ({
    x: m[0] * d.x + m[4] * d.y + m[8] * d.z,
    y: m[1] * d.x + m[5] * d.y + m[9] * d.z,
    z: m[2] * d.x + m[6] * d.y + m[10] * d.z,
})
