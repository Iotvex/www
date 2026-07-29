import type { Vec2, Vec3 } from '../types/nodes/math'

/**
 * Create a 2D plan point.
 *
 * @param x - X coordinate.
 * @param z - Z coordinate.
 * @returns A {@link Vec2}.
 */
export const vec2 = (x: number, z: number): Vec2 => ({ x, z })

/**
 * Create a 3D vector.
 *
 * @param x - X component.
 * @param y - Y component.
 * @param z - Z component.
 * @returns A {@link Vec3}.
 */
export const vec3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z })

/**
 * Add two plan vectors.
 *
 * @param a - Left operand.
 * @param b - Right operand.
 * @returns `a + b`.
 */
export const add2 = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, z: a.z + b.z })

/**
 * Subtract two plan vectors.
 *
 * @param a - Left operand.
 * @param b - Right operand.
 * @returns `a - b`.
 */
export const sub2 = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, z: a.z - b.z })

/**
 * Scale a plan vector.
 *
 * @param a - Vector to scale.
 * @param s - Scalar.
 * @returns `a * s`.
 */
export const scale2 = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, z: a.z * s })

/**
 * Euclidean length of a plan vector.
 *
 * @param a - Vector.
 * @returns `‖a‖`.
 */
export const length2 = (a: Vec2) => Math.hypot(a.x, a.z)

/**
 * Normalize a plan vector (returns zero vector when length is tiny).
 *
 * @param a - Vector to normalize.
 * @returns Unit-length vector, or `{ x: 0, z: 0 }`.
 */
export const normalize2 = (a: Vec2): Vec2 => {
    const len = length2(a)
    if (len < 1e-12) return { x: 0, z: 0 }
    return { x: a.x / len, z: a.z / len }
}

/**
 * Perpendicular of a plan vector (rotated 90° CCW in XZ).
 *
 * @param a - Input vector.
 * @returns `(-a.z, a.x)`.
 */
export const perp2 = (a: Vec2): Vec2 => ({ x: -a.z, z: a.x })

/**
 * Add two 3D vectors.
 *
 * @param a - Left operand.
 * @param b - Right operand.
 * @returns `a + b`.
 */
export const add3 = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })

/**
 * Subtract two 3D vectors.
 *
 * @param a - Left operand.
 * @param b - Right operand.
 * @returns `a - b`.
 */
export const sub3 = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })

/**
 * Scale a 3D vector.
 *
 * @param a - Vector to scale.
 * @param s - Scalar.
 * @returns `a * s`.
 */
export const scale3 = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s })

/**
 * Cross product of two 3D vectors.
 *
 * @param a - Left operand.
 * @param b - Right operand.
 * @returns `a × b`.
 */
export const cross3 = (a: Vec3, b: Vec3): Vec3 => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
})

/**
 * Euclidean length of a 3D vector.
 *
 * @param a - Vector.
 * @returns `‖a‖`.
 */
export const length3 = (a: Vec3) => Math.hypot(a.x, a.y, a.z)

/**
 * Normalize a 3D vector (returns zero vector when length is tiny).
 *
 * @param a - Vector to normalize.
 * @returns Unit-length vector, or `{ x: 0, y: 0, z: 0 }`.
 */
export const normalize3 = (a: Vec3): Vec3 => {
    const len = length3(a)
    if (len < 1e-12) return { x: 0, y: 0, z: 0 }
    return { x: a.x / len, y: a.y / len, z: a.z / len }
}
