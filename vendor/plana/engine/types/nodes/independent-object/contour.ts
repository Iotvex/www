import type { Vec2 } from '../math'

/**
 * Straight segment on the floor plan ending at `to`.
 */
export type FloorLine = {
    kind: 'line'
    /** End point of the segment. */
    to: Vec2
}

/**
 * Circular-arc segment approximated via bulge factor.
 *
 * `bulge` is `tan(theta/4)` style offset relative to the chord (positive =
 * left of directed chord when looking along the path).
 */
export type FloorArc = {
    kind: 'arc'
    /** End point of the arc. */
    to: Vec2
    /** Bulge factor controlling curvature. */
    bulge: number
}

/**
 * One segment of a {@link FloorPath}.
 */
export type FloorSegment = FloorLine | FloorArc

/**
 * Open or closed path on the floor plan (used by wall shapes).
 */
export type FloorPath = {
    /** Path start point. */
    start: Vec2
    /** Segments following `start`. */
    segments: FloorSegment[]
    /** When `true`, the path is closed back to `start`. */
    closed?: boolean
}

/**
 * Closed 2D outline on the plan (zone footprints, extrusions, holes).
 */
export type Contour =
    | {
          kind: 'polygon'
          /** Ring vertices in order (first ≠ last; closure is implied). */
          points: Vec2[]
      }
    | {
          kind: 'ellipse'
          center: Vec2
          radiusX: number
          radiusZ: number
          /** Rotation around Y in radians. */
          rotation?: number
      }
    | {
          kind: 'path'
          start: Vec2
          segments: FloorSegment[]
          /** Path contours used as outlines are always closed. */
          closed: true
      }
