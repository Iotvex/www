/**
 * Core math value types used by the scene graph and geometry builders.
 *
 * @packageDocumentation
 */

/**
 * Point on the plan (horizontal XZ plane; Y is up in 3D).
 */
export type Vec2 = {
    /** World / local X. */
    x: number
    /** World / local Z (depth on plan). */
    z: number
}

/**
 * Three-dimensional point or vector (Y is up).
 */
export type Vec3 = {
    x: number
    y: number
    z: number
}

/**
 * Axis-aligned bounding box in parent local space (center + size).
 *
 * Used for culling, gizmos, and default box solids — not the only shape of a space.
 */
export type Bounds = {
    /** Center X in parent local space. */
    x: number
    /** Center Y in parent local space. */
    y: number
    /** Center Z in parent local space. */
    z: number
    /** Full extent along X. */
    width: number
    /** Full extent along Y. */
    height: number
    /** Full extent along Z. */
    depth: number
}
