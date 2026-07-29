import type { Contour, FloorPath } from './contour'

/**
 * Triangle mesh buffers in object-local space.
 *
 * Positions are a flat `x,y,z` array. Indices are optional (non-indexed meshes
 * are treated as triangle lists by consumers).
 */
export type Mesh = {
    /** Interleaved vertex positions (`x,y,z` triples). */
    positions: number[]
    /** Optional triangle indices. */
    indices?: number[]
    /** Optional vertex normals (`x,y,z` triples). */
    normals?: number[]
    /** Optional UV coordinates (`u,v` pairs). */
    uvs?: number[]
}

type ShapeKind = 'box' | 'extrude' | 'wall' | 'sphere' | 'capsule' | 'cylinder' | 'mesh' | 'csg' | 'custom'

interface ShapeBase {
    kind: ShapeKind
}

/** Axis-aligned box sized from the host {@link import('../math').Bounds}. */
interface ShapeBox extends ShapeBase {
    kind: 'box'
}

/** Vertical extrusion of a closed {@link Contour}. */
interface ShapeExtrude extends ShapeBase {
    kind: 'extrude'
    contour: Contour
}

/** Thickened wall following a floor {@link FloorPath}. */
interface ShapeWall extends ShapeBase {
    kind: 'wall'
    path: FloorPath
    thickness: number
}

/** Sphere centered at the host origin. */
interface ShapeSphere extends ShapeBase {
    kind: 'sphere'
    radius: number
}

/** Capsule (sphere-capped cylinder) along Y. */
interface ShapeCapsule extends ShapeBase {
    kind: 'capsule'
    radius: number
    height: number
}

/** Cylinder along Y; height defaults to host bounds height when omitted. */
interface ShapeCylinder extends ShapeBase {
    kind: 'cylinder'
    radius: number
    height?: number
}

/** Pre-built mesh payload. */
interface ShapeMesh extends ShapeBase {
    kind: 'mesh'
    mesh: Mesh
}

/**
 * Constructive solid geometry node. Full boolean ops are not yet implemented;
 * `union` merges meshes, other ops currently keep `a`.
 */
interface ShapeCsg extends ShapeBase {
    kind: 'csg'
    op: 'union' | 'subtract' | 'intersect'
    a: Shape
    b: Shape
}

/** Escape hatch for application-specific shapes. */
interface ShapeCustom extends ShapeBase {
    kind: 'custom'
    type: string
    data: unknown
}

/**
 * Discriminated union describing how an {@link import('../nodes').IndependentObject}
 * is tessellated.
 */
export type Shape =
    | ShapeBox
    | ShapeExtrude
    | ShapeWall
    | ShapeSphere
    | ShapeCapsule
    | ShapeCylinder
    | ShapeMesh
    | ShapeCsg
    | ShapeCustom
