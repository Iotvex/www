import type { Bounds } from '../math'
import type { Shape } from './shape'

/**
 * Opening or void relative to a host {@link import('../nodes').IndependentObject}.
 *
 * Positioned by {@link Bounds} in host local space. Optional `pathOffset` places
 * the cutout along a wall path; optional `shape` overrides the default box.
 */
export type Cutout = Bounds & {
    /** Optional cutout id. */
    id?: string
    /** Optional label. */
    name?: string
    /**
     * Distance along a wall path where this cutout begins (wall baking).
     * Combined with `width` to form a gap interval.
     */
    pathOffset?: number
    /** Cutout solid shape; defaults to a box sized by bounds. */
    shape?: Shape
}
