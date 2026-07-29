import * as React from 'react';
import { ReactNode } from 'react';
import { CanvasProps } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Core math value types used by the scene graph and geometry builders.
 *
 * @packageDocumentation
 */
/**
 * Point on the plan (horizontal XZ plane; Y is up in 3D).
 */
type Vec2 = {
    /** World / local X. */
    x: number;
    /** World / local Z (depth on plan). */
    z: number;
};
/**
 * Three-dimensional point or vector (Y is up).
 */
type Vec3 = {
    x: number;
    y: number;
    z: number;
};
/**
 * Axis-aligned bounding box in parent local space (center + size).
 *
 * Used for culling, gizmos, and default box solids — not the only shape of a space.
 */
type Bounds = {
    /** Center X in parent local space. */
    x: number;
    /** Center Y in parent local space. */
    y: number;
    /** Center Z in parent local space. */
    z: number;
    /** Full extent along X. */
    width: number;
    /** Full extent along Y. */
    height: number;
    /** Full extent along Z. */
    depth: number;
};

/**
 * Straight segment on the floor plan ending at `to`.
 */
type FloorLine = {
    kind: 'line';
    /** End point of the segment. */
    to: Vec2;
};
/**
 * Circular-arc segment approximated via bulge factor.
 *
 * `bulge` is `tan(theta/4)` style offset relative to the chord (positive =
 * left of directed chord when looking along the path).
 */
type FloorArc = {
    kind: 'arc';
    /** End point of the arc. */
    to: Vec2;
    /** Bulge factor controlling curvature. */
    bulge: number;
};
/**
 * One segment of a {@link FloorPath}.
 */
type FloorSegment = FloorLine | FloorArc;
/**
 * Open or closed path on the floor plan (used by wall shapes).
 */
type FloorPath = {
    /** Path start point. */
    start: Vec2;
    /** Segments following `start`. */
    segments: FloorSegment[];
    /** When `true`, the path is closed back to `start`. */
    closed?: boolean;
};
/**
 * Closed 2D outline on the plan (zone footprints, extrusions, holes).
 */
type Contour = {
    kind: 'polygon';
    /** Ring vertices in order (first ≠ last; closure is implied). */
    points: Vec2[];
} | {
    kind: 'ellipse';
    center: Vec2;
    radiusX: number;
    radiusZ: number;
    /** Rotation around Y in radians. */
    rotation?: number;
} | {
    kind: 'path';
    start: Vec2;
    segments: FloorSegment[];
    /** Path contours used as outlines are always closed. */
    closed: true;
};

/**
 * Triangle mesh buffers in object-local space.
 *
 * Positions are a flat `x,y,z` array. Indices are optional (non-indexed meshes
 * are treated as triangle lists by consumers).
 */
type Mesh = {
    /** Interleaved vertex positions (`x,y,z` triples). */
    positions: number[];
    /** Optional triangle indices. */
    indices?: number[];
    /** Optional vertex normals (`x,y,z` triples). */
    normals?: number[];
    /** Optional UV coordinates (`u,v` pairs). */
    uvs?: number[];
};
type ShapeKind = 'box' | 'extrude' | 'wall' | 'sphere' | 'capsule' | 'cylinder' | 'mesh' | 'csg' | 'custom';
interface ShapeBase {
    kind: ShapeKind;
}
/** Axis-aligned box sized from the host {@link import('../math').Bounds}. */
interface ShapeBox extends ShapeBase {
    kind: 'box';
}
/** Vertical extrusion of a closed {@link Contour}. */
interface ShapeExtrude extends ShapeBase {
    kind: 'extrude';
    contour: Contour;
}
/** Thickened wall following a floor {@link FloorPath}. */
interface ShapeWall extends ShapeBase {
    kind: 'wall';
    path: FloorPath;
    thickness: number;
}
/** Sphere centered at the host origin. */
interface ShapeSphere extends ShapeBase {
    kind: 'sphere';
    radius: number;
}
/** Capsule (sphere-capped cylinder) along Y. */
interface ShapeCapsule extends ShapeBase {
    kind: 'capsule';
    radius: number;
    height: number;
}
/** Cylinder along Y; height defaults to host bounds height when omitted. */
interface ShapeCylinder extends ShapeBase {
    kind: 'cylinder';
    radius: number;
    height?: number;
}
/** Pre-built mesh payload. */
interface ShapeMesh extends ShapeBase {
    kind: 'mesh';
    mesh: Mesh;
}
/**
 * Constructive solid geometry node. Full boolean ops are not yet implemented;
 * `union` merges meshes, other ops currently keep `a`.
 */
interface ShapeCsg extends ShapeBase {
    kind: 'csg';
    op: 'union' | 'subtract' | 'intersect';
    a: Shape;
    b: Shape;
}
/** Escape hatch for application-specific shapes. */
interface ShapeCustom extends ShapeBase {
    kind: 'custom';
    type: string;
    data: unknown;
}
/**
 * Discriminated union describing how an {@link import('../nodes').IndependentObject}
 * is tessellated.
 */
type Shape = ShapeBox | ShapeExtrude | ShapeWall | ShapeSphere | ShapeCapsule | ShapeCylinder | ShapeMesh | ShapeCsg | ShapeCustom;

/**
 * Opening or void relative to a host {@link import('../nodes').IndependentObject}.
 *
 * Positioned by {@link Bounds} in host local space. Optional `pathOffset` places
 * the cutout along a wall path; optional `shape` overrides the default box.
 */
type Cutout = Bounds & {
    /** Optional cutout id. */
    id?: string;
    /** Optional label. */
    name?: string;
    /**
     * Distance along a wall path where this cutout begins (wall baking).
     * Combined with `width` to form a gap interval.
     */
    pathOffset?: number;
    /** Cutout solid shape; defaults to a box sized by bounds. */
    shape?: Shape;
};

/**
 * Visual and interaction style attached to scene nodes.
 *
 * @packageDocumentation
 */
/**
 * Optional appearance and interaction hints for a node.
 *
 * Viewers and editors may interpret these as PBR material parameters,
 * plan-view outline styling, or selection/visibility flags.
 */
type NodeStyle = {
    /** CSS/hex color for fill/material, e.g. `#c4a574`. */
    color?: string;
    /** Optional emissive / accent color. */
    accentColor?: string;
    /** Opacity 0–1. */
    opacity?: number;
    /** Metalness 0–1 (PBR hint for viewers). */
    metalness?: number;
    /** Roughness 0–1. */
    roughness?: number;
    /** Whether the node is visible in the editor/viewer. */
    visible?: boolean;
    /** Whether the node can be selected. */
    selectable?: boolean;
    /** Optional CSS-like border/outline color for plan view. */
    outlineColor?: string;
    /**
     * Outline width in meters for 3D viewers
     * (2D overlays may interpret the same value in pixels).
     */
    outlineWidth?: number;
    /** Free-form app metadata. */
    extras?: Record<string, unknown>;
};

/**
 * Scene-graph node types for Plana worlds.
 *
 * Node kinds: `world` → `apartment` / `group` → `zone` / nested groups →
 * `composite` / `independent` solids.
 *
 * @packageDocumentation
 */

/**
 * Free-form tag string attached to a node (filtering, styling, editor metadata).
 */
type Tag = string;
/**
 * Shared fields for every scene node: optional identity plus {@link Bounds}.
 */
type NodeBase = Bounds & {
    /** Stable identifier used by selection, commands, and lookups. */
    id?: string;
    /** Human-readable label for editors and debugging. */
    name?: string;
    /** Optional classification tag. */
    tag?: Tag;
    /** Optional visual / interaction style. */
    style?: NodeStyle;
};
/**
 * Leaf solid: a single geometric object with optional cutouts.
 */
type IndependentObject = NodeBase & {
    kind: 'independent';
    /** Tessellatable shape; defaults to a box when omitted. */
    shape?: Shape;
    /** Openings / voids relative to the host solid. */
    cutouts?: Cutout[];
};
/**
 * Aggregate of independent objects that move/transform as one unit.
 */
type CompositeObject = NodeBase & {
    kind: 'composite';
    /** Member solids in composite local space. */
    objects: IndependentObject[];
};
/**
 * Hierarchical grouping node (furniture sets, layers, etc.).
 */
type Group = NodeBase & {
    kind: 'group';
    /** Nested objects, zones, or further groups. */
    children: Array<IndependentObject | CompositeObject | Zone | Group>;
};
/**
 * Named spatial region inside an apartment (room, corridor, balcony).
 */
type Zone = NodeBase & {
    kind: 'zone';
    /** Optional plan outline of the zone. */
    footprint?: Contour;
    /** Contents of the zone. */
    children: Array<IndependentObject | CompositeObject | Group>;
};
/**
 * Single dwelling unit containing zones and groups.
 */
type Apartment = NodeBase & {
    kind: 'apartment';
    /** Optional plan outline of the apartment. */
    footprint?: Contour;
    /** Top-level spaces inside the apartment. */
    children: Array<Zone | Group>;
};
/**
 * Root of the scene graph for a document.
 */
type World = NodeBase & {
    kind: 'world';
    /** Apartments and top-level groups. */
    children: Array<Apartment | Group>;
};
/**
 * Any node in the Plana scene graph.
 */
type Node = World | Apartment | Zone | Group | CompositeObject | IndependentObject;
/**
 * Discriminant string for {@link Node}.
 */
type NodeKind = Node['kind'];
/**
 * Type guard for {@link World}.
 *
 * @param n - Node to test.
 * @returns `true` when `n.kind === 'world'`.
 */
declare const isWorld: (n: Node) => n is World;
/**
 * Type guard for {@link Apartment}.
 *
 * @param n - Node to test.
 * @returns `true` when `n.kind === 'apartment'`.
 */
declare const isApartment: (n: Node) => n is Apartment;
/**
 * Type guard for {@link Zone}.
 *
 * @param n - Node to test.
 * @returns `true` when `n.kind === 'zone'`.
 */
declare const isZone: (n: Node) => n is Zone;
/**
 * Type guard for {@link Group}.
 *
 * @param n - Node to test.
 * @returns `true` when `n.kind === 'group'`.
 */
declare const isGroup: (n: Node) => n is Group;
/**
 * Type guard for {@link CompositeObject}.
 *
 * @param n - Node to test.
 * @returns `true` when `n.kind === 'composite'`.
 */
declare const isCompositeObject: (n: Node) => n is CompositeObject;
/**
 * Type guard for {@link IndependentObject}.
 *
 * @param n - Node to test.
 * @returns `true` when `n.kind === 'independent'`.
 */
declare const isIndependentObject: (n: Node) => n is IndependentObject;

/**
 * Column-major 4×4 transformation matrix (compatible with Three.js / WebGL).
 */
type Mat4 = [
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
    number
];
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
declare const mat4Identity: () => Mat4;
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
declare const mat4Translate: (x: number, y: number, z: number) => Mat4;
/**
 * Multiply two matrices (`out = a * b`, column-major).
 *
 * @param a - Left matrix.
 * @param b - Right matrix.
 * @returns The product as a new {@link Mat4}.
 */
declare const mat4Multiply: (a: Mat4, b: Mat4) => Mat4;
/**
 * Transform a point by a matrix (applies translation).
 *
 * @param m - Transformation matrix.
 * @param p - Point in the matrix's input space.
 * @returns Transformed point.
 */
declare const mat4TransformPoint: (m: Mat4, p: Vec3) => Vec3;
/**
 * Transform a direction by a matrix (ignores translation).
 *
 * @param m - Transformation matrix.
 * @param d - Direction vector.
 * @returns Transformed direction (not re-normalized).
 */
declare const mat4TransformDirection: (m: Mat4, d: Vec3) => Vec3;

/**
 * Create a 2D plan point.
 *
 * @param x - X coordinate.
 * @param z - Z coordinate.
 * @returns A {@link Vec2}.
 */
declare const vec2: (x: number, z: number) => Vec2;
/**
 * Create a 3D vector.
 *
 * @param x - X component.
 * @param y - Y component.
 * @param z - Z component.
 * @returns A {@link Vec3}.
 */
declare const vec3: (x: number, y: number, z: number) => Vec3;
/**
 * Add two plan vectors.
 *
 * @param a - Left operand.
 * @param b - Right operand.
 * @returns `a + b`.
 */
declare const add2: (a: Vec2, b: Vec2) => Vec2;
/**
 * Subtract two plan vectors.
 *
 * @param a - Left operand.
 * @param b - Right operand.
 * @returns `a - b`.
 */
declare const sub2: (a: Vec2, b: Vec2) => Vec2;
/**
 * Scale a plan vector.
 *
 * @param a - Vector to scale.
 * @param s - Scalar.
 * @returns `a * s`.
 */
declare const scale2: (a: Vec2, s: number) => Vec2;
/**
 * Euclidean length of a plan vector.
 *
 * @param a - Vector.
 * @returns `‖a‖`.
 */
declare const length2: (a: Vec2) => number;
/**
 * Normalize a plan vector (returns zero vector when length is tiny).
 *
 * @param a - Vector to normalize.
 * @returns Unit-length vector, or `{ x: 0, z: 0 }`.
 */
declare const normalize2: (a: Vec2) => Vec2;
/**
 * Perpendicular of a plan vector (rotated 90° CCW in XZ).
 *
 * @param a - Input vector.
 * @returns `(-a.z, a.x)`.
 */
declare const perp2: (a: Vec2) => Vec2;
/**
 * Add two 3D vectors.
 *
 * @param a - Left operand.
 * @param b - Right operand.
 * @returns `a + b`.
 */
declare const add3: (a: Vec3, b: Vec3) => Vec3;
/**
 * Subtract two 3D vectors.
 *
 * @param a - Left operand.
 * @param b - Right operand.
 * @returns `a - b`.
 */
declare const sub3: (a: Vec3, b: Vec3) => Vec3;
/**
 * Scale a 3D vector.
 *
 * @param a - Vector to scale.
 * @param s - Scalar.
 * @returns `a * s`.
 */
declare const scale3: (a: Vec3, s: number) => Vec3;
/**
 * Cross product of two 3D vectors.
 *
 * @param a - Left operand.
 * @param b - Right operand.
 * @returns `a × b`.
 */
declare const cross3: (a: Vec3, b: Vec3) => Vec3;
/**
 * Euclidean length of a 3D vector.
 *
 * @param a - Vector.
 * @returns `‖a‖`.
 */
declare const length3: (a: Vec3) => number;
/**
 * Normalize a 3D vector (returns zero vector when length is tiny).
 *
 * @param a - Vector to normalize.
 * @returns Unit-length vector, or `{ x: 0, y: 0, z: 0 }`.
 */
declare const normalize3: (a: Vec3) => Vec3;

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
declare const nodeLocalMatrix: (node: NodeBase) => Mat4;
/**
 * Compose parent world and local matrices (`parent * local`).
 *
 * @param parentWorld - Accumulated parent world matrix.
 * @param local - Node local matrix.
 * @returns Combined world matrix.
 */
declare const composeMatrices: (parentWorld: Mat4, local: Mat4) => Mat4;
/**
 * One visit entry from {@link walkWorld}.
 */
type WorldNode = {
    /** Visited scene node. */
    node: Node;
    /** Accumulated world matrix for `node`. */
    worldMatrix: Mat4;
    /** Parent node, or `null` at the walk root. */
    parent: Node | null;
};
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
declare const walkWorld: (root: Node, visit: (entry: WorldNode) => void, parentWorld?: Mat4, parent?: Node | null) => void;
/**
 * Extract size components from bounds.
 *
 * @param b - Bounds to read.
 * @returns `{ width, height, depth }`.
 */
declare const boundsSize: (b: Bounds) => {
    width: number;
    height: number;
    depth: number;
};

/** Axis-aligned box centered at origin. */
declare const buildBoxMesh: (width: number, height: number, depth: number) => Mesh;

/** Contour → closed ring in XZ (local). Arc bulge approximated. */
declare const contourToRing: (contour: Contour, arcSegments?: number) => Vec2[];
/**
 * Vertical extrusion of a contour (+ optional holes) from yMin to yMax.
 * Holes are rings in the same local XZ.
 */
declare const buildExtrudeMesh: (contour: Contour, yMin: number, yMax: number, holes?: Vec2[][]) => Mesh;

type Polyline = {
    points: Vec2[];
    cum: number[];
    total: number;
};
declare const flattenPath: (path: FloorPath, arcSegments?: number) => Polyline;
type WallGap = {
    /** Along path from start. */
    from: number;
    to: number;
    /** Opening vertical span in local Y (absolute). */
    yMin: number;
    yMax: number;
};
/**
 * Wall strip along path × thickness × [yMin,yMax] as one extruded prism.
 *
 * Elevation contour (path × height) is extruded by thickness; openings are
 * holes or floor notches — continuous solid like plana.d ExtrudeGeometry.
 * No pier/sill/lintel box seams for EdgesGeometry.
 */
declare const buildWallMesh: (path: FloorPath, thickness: number, yMin: number, yMax: number, gaps?: WallGap[]) => Mesh;

declare const buildSphereMesh: (radius: number, segments?: number, rings?: number) => Mesh;
declare const buildCylinderMesh: (radius: number, height: number, segments?: number) => Mesh;
declare const buildCapsuleMesh: (radius: number, height: number) => Mesh;

/**
 * Build mesh for a Shape in local space (origin = host center).
 */
declare const buildShapeMesh: (shape: Shape, host: Pick<Bounds, "width" | "height" | "depth">) => Mesh;
declare const buildCutoutMesh: (cutout: Cutout) => Mesh;
declare const cutoutsToWallGaps: (cutouts: Cutout[] | undefined) => WallGap[];
/** Hole rings in host XZ for extrude baking. */
declare const cutoutToHoleRings: (cutout: Cutout) => Vec2[][];

/**
 * Tessellation result for one independent object in local space.
 */
type IndependentGeometry = {
    /** Host solid in object local space (cutouts baked where supported). */
    solid: Mesh;
    /** Cutout volumes in object local space (for fills / future CSG). */
    cutouts: Mesh[];
};
/**
 * Tessellate an {@link IndependentObject} in its local space (origin = Bounds center).
 *
 * - `wall`: `pathOffset` cutouts become elevation holes in one extruded prism
 * - `extrude`: cutouts become holes in the plan
 * - other shapes: solid only; cutout meshes are still listed separately
 *
 * @param object - Independent object to tessellate.
 * @returns Solid mesh plus per-cutout meshes in object local space.
 *
 * @example
 * ```ts
 * const { solid, cutouts } = buildIndependentGeometry(wall)
 * ```
 */
declare const buildIndependentGeometry: (object: IndependentObject) => IndependentGeometry;

/**
 * Built solid for one independent object in world space.
 */
type WorldSolid = {
    /** Source independent object. */
    object: IndependentObject;
    /** Local geometry (baked cutouts where supported). */
    local: IndependentGeometry;
    /** Solid mesh transformed to world. */
    worldSolid: Mesh;
    /** Accumulated world matrix used for `worldSolid`. */
    worldMatrix: Mat4;
};
/**
 * Build all independent solids in a world with world matrices applied.
 *
 * @param world - Root world to tessellate.
 * @returns One {@link WorldSolid} per independent object, depth-first order.
 *
 * @example
 * ```ts
 * const solids = buildWorldSolids(doc.getWorld())
 * for (const s of solids) {
 *   // upload s.worldSolid to the renderer
 * }
 * ```
 */
declare const buildWorldSolids: (world: World) => WorldSolid[];

/**
 * Create an empty mesh with positions, indices, and normals arrays.
 *
 * @returns A new empty {@link Mesh}.
 */
declare const emptyMesh: () => Mesh;
/**
 * Concatenate meshes into one indexed mesh (re-indexing as needed).
 *
 * @param meshes - Meshes to merge in order.
 * @returns A single combined {@link Mesh}.
 */
declare const mergeMeshes: (meshes: Mesh[]) => Mesh;
/**
 * Transform mesh positions (and normals) by a matrix.
 *
 * @param mesh - Source mesh.
 * @param matrix - World or local transform.
 * @returns A new transformed mesh (indices/uvs copied).
 */
declare const transformMesh: (mesh: Mesh, matrix: Mat4) => Mesh;
/**
 * Recompute flat-averaged vertex normals from triangles.
 *
 * @param mesh - Mesh with positions (and optional indices).
 * @returns A new mesh with `normals` filled.
 */
declare const computeVertexNormals: (mesh: Mesh) => Mesh;
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
declare const pushQuad: (positions: number[], indices: number[], a: Vec3, b: Vec3, c: Vec3, d: Vec3) => void;

/**
 * Base error for all Plana engine failures.
 *
 * Prefer throwing a more specific subclass ({@link ValidationError},
 * {@link NotFoundError}, {@link CommandError}, {@link GeometryError}) so
 * callers can discriminate with `instanceof`.
 *
 * @example
 * ```ts
 * throw new PlanaError('Unexpected engine failure')
 * ```
 */
declare class PlanaError extends Error {
    /**
     * @param message - Human-readable description of the failure.
     * @param options - Standard `Error` options (e.g. `cause`).
     */
    constructor(message: string, options?: ErrorOptions);
}

/**
 * Thrown when input data violates engine invariants (missing id, wrong node kind, etc.).
 *
 * @example
 * ```ts
 * throw new ValidationError('Node is missing a required id')
 * ```
 */
declare class ValidationError extends PlanaError {
    /**
     * @param message - Description of the validation failure.
     * @param options - Standard `Error` options (e.g. `cause`).
     */
    constructor(message: string, options?: ErrorOptions);
}

/**
 * Thrown when a requested node or resource cannot be found in the document tree.
 *
 * @example
 * ```ts
 * throw new NotFoundError(`Node not found: ${id}`)
 * ```
 */
declare class NotFoundError extends PlanaError {
    /**
     * Identifier that could not be resolved, when applicable.
     */
    readonly id?: string;
    /**
     * @param message - Description of what was missing.
     * @param id - Optional resource id that was looked up.
     * @param options - Standard `Error` options (e.g. `cause`).
     */
    constructor(message: string, id?: string, options?: ErrorOptions);
}

/**
 * Thrown when a document command cannot be applied (illegal parent, unsupported kind, etc.).
 *
 * @example
 * ```ts
 * throw new CommandError('Cannot add an apartment under a zone')
 * ```
 */
declare class CommandError extends PlanaError {
    /**
     * @param message - Description of why the command failed.
     * @param options - Standard `Error` options (e.g. `cause`).
     */
    constructor(message: string, options?: ErrorOptions);
}

/**
 * Thrown when mesh or solid construction fails (degenerate contour, unsupported shape, etc.).
 *
 * @example
 * ```ts
 * throw new GeometryError('Contour must contain at least 3 points')
 * ```
 */
declare class GeometryError extends PlanaError {
    /**
     * @param message - Description of the geometry failure.
     * @param options - Standard `Error` options (e.g. `cause`).
     */
    constructor(message: string, options?: ErrorOptions);
}

/**
 * Editor selection: a list of selected node ids.
 *
 * Selection is document-level state (not stored on the {@link World} tree).
 */
type Selection = Readonly<{
    /** Selected node identifiers (order is preserved for multi-select UX). */
    ids: readonly string[];
}>;
/**
 * Create an empty selection.
 *
 * @returns A selection with no ids.
 *
 * @example
 * ```ts
 * const sel = emptySelection()
 * // sel.ids → []
 * ```
 */
declare const emptySelection: () => Selection;
/**
 * Create a selection from the given ids (duplicates removed, order kept).
 *
 * @param ids - Node identifiers to select.
 * @returns A frozen selection snapshot.
 *
 * @example
 * ```ts
 * const sel = createSelection(['wall-1', 'door-2'])
 * ```
 */
declare const createSelection: (ids?: readonly string[]) => Selection;
/**
 * Compare two selections for equality (same ids in the same order).
 *
 * @param a - First selection.
 * @param b - Second selection.
 * @returns `true` when both selections list the same ids in order.
 */
declare const selectionEquals: (a: Selection, b: Selection) => boolean;
/**
 * Return whether the selection contains the given id.
 *
 * @param selection - Selection to query.
 * @param id - Node id to look for.
 * @returns `true` if `id` is selected.
 */
declare const isSelected: (selection: Selection, id: string) => boolean;

/**
 * Immutable snapshot of document state stored on the undo/redo stacks.
 */
type HistorySnapshot = Readonly<{
    /** Scene graph at the time of the snapshot. */
    world: World;
    /** Selection at the time of the snapshot. */
    selection: Selection;
}>;
/**
 * Create a frozen history snapshot.
 *
 * @param world - World to capture.
 * @param selection - Selection to capture.
 * @returns A frozen {@link HistorySnapshot}.
 *
 * @example
 * ```ts
 * const snap = createHistorySnapshot(world, createSelection(['a']))
 * ```
 */
declare const createHistorySnapshot: (world: World, selection: Selection) => HistorySnapshot;
/**
 * Undo/redo stack for document world + selection snapshots.
 *
 * Call {@link History.push} with the *previous* state before applying a change,
 * then {@link History.undo} / {@link History.redo} to navigate.
 *
 * @example
 * ```ts
 * const history = new History()
 * history.push(createHistorySnapshot(prevWorld, prevSelection))
 * // …apply command…
 * const restored = history.undo(createHistorySnapshot(currentWorld, currentSelection))
 * ```
 */
declare class History {
    private readonly undoStack;
    private readonly redoStack;
    private readonly limit;
    /**
     * @param limit - Maximum number of undo entries retained (oldest dropped). Defaults to `100`.
     */
    constructor(limit?: number);
    /**
     * Whether an undo operation is available.
     */
    get canUndo(): boolean;
    /**
     * Whether a redo operation is available.
     */
    get canRedo(): boolean;
    /**
     * Number of entries on the undo stack.
     */
    get undoDepth(): number;
    /**
     * Number of entries on the redo stack.
     */
    get redoDepth(): number;
    /**
     * Record a snapshot taken *before* a mutating change. Clears the redo stack.
     *
     * @param snapshot - Previous world + selection.
     */
    push(snapshot: HistorySnapshot): void;
    /**
     * Pop the previous snapshot and push `current` onto the redo stack.
     *
     * @param current - Document state at the moment of undo (pushed to redo).
     * @returns The restored snapshot, or `null` if the undo stack is empty.
     */
    undo(current: HistorySnapshot): HistorySnapshot | null;
    /**
     * Pop the next redo snapshot and push `current` onto the undo stack.
     *
     * @param current - Document state at the moment of redo (pushed to undo).
     * @returns The restored snapshot, or `null` if the redo stack is empty.
     */
    redo(current: HistorySnapshot): HistorySnapshot | null;
    /**
     * Remove the most recent undo entry without affecting the redo stack.
     *
     * Useful when a command was pushed optimistically but then failed to apply.
     *
     * @returns The dropped snapshot, or `null` if the undo stack was empty.
     */
    dropLastUndo(): HistorySnapshot | null;
    /**
     * Clear both undo and redo stacks.
     */
    clear(): void;
}

/**
 * Replace the entire world tree.
 */
type ReplaceWorldCommand = {
    type: 'replaceWorld';
    /** New world to install. */
    world: World;
};
/**
 * Set the document selection to the given node ids.
 */
type SetSelectionCommand = {
    type: 'setSelection';
    /** Selected node ids (duplicates ignored by the document). */
    ids: readonly string[];
};
/**
 * Insert a node under a parent container.
 */
type AddNodeCommand = {
    type: 'addNode';
    /**
     * Parent node id. Use `null` (or omit matching the world id) to attach
     * under the world root.
     */
    parentId: string | null;
    /** Node to insert. Must have a unique `id`. */
    node: Node;
};
/**
 * Remove a node (and its subtree) by id.
 */
type RemoveNodeCommand = {
    type: 'removeNode';
    /** Id of the node to remove. */
    id: string;
};
/**
 * Patch fields on an independent object.
 */
type UpdateIndependentCommand = {
    type: 'updateIndependent';
    /** Target independent object id. */
    id: string;
    /**
     * Partial fields to merge. `kind` and `id` cannot be changed.
     */
    patch: Partial<Omit<IndependentObject, 'kind' | 'id'>>;
};
/**
 * Patch axis-aligned bounds (center + size) on any node.
 */
type UpdateBoundsCommand = {
    type: 'updateBounds';
    /** Target node id. */
    id: string;
    /** Partial bounds fields to merge. */
    bounds: Partial<Bounds>;
};
/**
 * Merge a style patch into `node.style` for any node.
 */
type UpdateStyleCommand = {
    type: 'updateStyle';
    /** Target node id. */
    id: string;
    /** Partial style fields to merge into the existing style. */
    style: Partial<NodeStyle>;
};
/**
 * Shallow-patch top-level fields on any node.
 *
 * `kind` and `id` cannot be changed. Nested collections such as `children`
 * are replaced only when explicitly provided in the patch (no deep merge).
 */
type UpdateNodeCommand = {
    type: 'updateNode';
    /** Target node id. */
    id: string;
    /** Partial fields to merge. `kind` and `id` cannot be changed. */
    patch: Partial<Omit<Node, 'kind' | 'id'>>;
};
/**
 * Discriminated union of all document commands.
 *
 * Commands are plain data; apply them with {@link applyCommand} or
 * {@link Document.dispatch}.
 */
type Command = ReplaceWorldCommand | SetSelectionCommand | AddNodeCommand | RemoveNodeCommand | UpdateIndependentCommand | UpdateBoundsCommand | UpdateStyleCommand | UpdateNodeCommand;
/**
 * Result of applying a command to world (+ optional selection override).
 */
type ApplyCommandResult = {
    /** Updated world (may be the same reference when the command only touches selection). */
    world: World;
    /**
     * When set, the document should replace its selection with this value.
     * When `undefined`, selection is left unchanged.
     */
    selectionIds?: readonly string[];
};

/**
 * Apply a command to a world, returning a new world (immutable update).
 *
 * Selection-only commands (`setSelection`) leave the world unchanged and
 * return `selectionIds` for the document layer to apply.
 *
 * @param world - Current world.
 * @param command - Command to apply.
 * @returns Updated world and optional selection override.
 * @throws {@link ValidationError} On invalid input (missing ids, illegal parent/child).
 * @throws {@link NotFoundError} When a referenced node id cannot be found.
 * @throws {@link CommandError} When the command cannot be applied for other reasons.
 *
 * @example
 * ```ts
 * const { world: next } = applyCommand(world, {
 *   type: 'addNode',
 *   parentId: 'apartment-1',
 *   node: {
 *     kind: 'group',
 *     id: 'g1',
 *     x: 0, y: 0, z: 0,
 *     width: 1, height: 1, depth: 1,
 *     children: [],
 *   },
 * })
 * ```
 */
declare const applyCommand: (world: World, command: Command) => ApplyCommandResult;

/**
 * Ensure a node has a defined string `id`.
 *
 * @param node - Node that must identify itself.
 * @returns The node id.
 * @throws {@link ValidationError} When `node.id` is missing or empty.
 *
 * @example
 * ```ts
 * const id = requireId(node)
 * ```
 */
declare const requireId: (node: {
    id?: string;
}) => string;
/**
 * Depth-first search for a node with the given id.
 *
 * @param root - Scene node to search under (usually a {@link World}).
 * @param id - Target node id.
 * @returns The matching node, or `undefined` if not found.
 *
 * @example
 * ```ts
 * const wall = findNodeById(world, 'wall-1')
 * ```
 */
declare const findNodeById: (root: Node, id: string) => Node | undefined;
/**
 * Find a node by id or throw.
 *
 * @param root - Scene node to search under.
 * @param id - Target node id.
 * @returns The matching node.
 * @throws {@link NotFoundError} When no node with `id` exists under `root`.
 *
 * @example
 * ```ts
 * const node = requireNodeById(world, 'zone-kitchen')
 * ```
 */
declare const requireNodeById: (root: Node, id: string) => Node;
/**
 * Shallow-clone a world (new root object, same child references).
 *
 * Useful when replacing top-level fields without deep-copying the tree.
 *
 * @param world - World to clone.
 * @returns A new {@link World} object with copied top-level fields.
 *
 * @example
 * ```ts
 * const next = cloneWorldShallow(world)
 * next.name = 'Copy'
 * ```
 */
declare const cloneWorldShallow: (world: World) => World;
/**
 * Return the direct children collection for a container node.
 *
 * @param node - Potential parent node.
 * @returns Child array reference, or `null` for leaf/independent nodes.
 */
declare const getChildNodes: (node: Node) => Node[] | null;
/**
 * Whether `child` may be parented under `parent` given node-kind rules.
 *
 * @param parent - Prospective parent.
 * @param child - Prospective child.
 * @returns `true` when the pairing is allowed.
 */
declare const canParentChild: (parent: Node, child: Node) => boolean;
/**
 * Immutably replace the node with `id` by applying `updater`.
 *
 * Walks from `root` and shallow-clones only the path to the target.
 *
 * @param root - Root of the subtree.
 * @param id - Id of the node to update.
 * @param updater - Function that returns the replacement node.
 * @returns A new root with the update applied, or `null` if `id` was not found.
 */
declare const updateNodeById: (root: Node, id: string, updater: (node: Node) => Node) => Node | null;
/**
 * Immutably remove the node with `id` from the tree.
 *
 * @param root - Root of the subtree.
 * @param id - Id of the node to remove.
 * @returns New root and the removed node, or `null` if not found / cannot remove root.
 */
declare const removeNodeById: (root: Node, id: string) => {
    root: Node;
    removed: Node;
} | null;
/**
 * Immutably append `child` under the parent with `parentId`.
 *
 * @param root - Root of the subtree (usually the world).
 * @param parentId - Id of the parent container, or `null` to attach under the world root.
 * @param child - Node to insert.
 * @returns New root with the child added, or `null` if the parent was not found.
 * @throws {@link ValidationError} When the parent cannot accept the child kind.
 */
declare const addChildToParent: (root: Node, parentId: string | null, child: Node) => Node | null;
/**
 * Create an empty world suitable as a document starting point.
 *
 * @param id - Optional world id. Defaults to `'world'`.
 * @returns A new empty {@link World}.
 *
 * @example
 * ```ts
 * const world = createEmptyWorld()
 * ```
 */
declare const createEmptyWorld: (id?: string) => World;

/**
 * Reason a document listener was notified.
 */
type DocumentChangeReason = 'dispatch' | 'undo' | 'redo' | 'replaceWorld' | 'setSelection';
/**
 * Payload passed to {@link Document.subscribe} listeners.
 */
type DocumentChange = {
    /** Current world after the change. */
    world: World;
    /** Current selection after the change. */
    selection: Selection;
    /** What triggered the notification. */
    reason: DocumentChangeReason;
};
/**
 * Listener invoked whenever the document world or selection changes.
 *
 * @param change - Snapshot of the new document state.
 */
type DocumentListener = (change: DocumentChange) => void;
/**
 * Options for {@link createDocument} / {@link Document} construction.
 */
type DocumentOptions = {
    /** Initial world. Defaults to {@link createEmptyWorld}. */
    world?: World;
    /** Initial selection. Defaults to empty. */
    selection?: Selection;
    /** Maximum undo stack depth. Defaults to `100`. */
    historyLimit?: number;
};
/**
 * Interactive document: holds a {@link World}, selection, and undo/redo history.
 *
 * The engine stays free of React; UI layers subscribe and dispatch commands.
 *
 * @example
 * ```ts
 * const doc = createDocument()
 * const unsub = doc.subscribe(({ world }) => {
 *   // react to world.children
 * })
 * doc.dispatch({
 *   type: 'addNode',
 *   parentId: null,
 *   node: {
 *     kind: 'apartment',
 *     id: 'apt-1',
 *     x: 0, y: 0, z: 0,
 *     width: 10, height: 3, depth: 8,
 *     children: [],
 *   },
 * })
 * doc.undo()
 * unsub()
 * ```
 */
declare class Document {
    private world;
    private selection;
    private readonly history;
    private readonly listeners;
    /**
     * @param options - Initial world, selection, and history limit.
     */
    constructor(options?: DocumentOptions);
    /**
     * Current world tree (treat as immutable; mutate via {@link Document.dispatch}).
     *
     * @returns The current {@link World}.
     */
    getWorld(): World;
    /**
     * Current selection snapshot.
     *
     * @returns The current {@link Selection}.
     */
    getSelection(): Selection;
    /**
     * Whether {@link Document.undo} would restore a previous snapshot.
     *
     * @returns `true` when the undo stack is non-empty.
     */
    canUndo(): boolean;
    /**
     * Whether {@link Document.redo} would re-apply a undone snapshot.
     *
     * @returns `true` when the redo stack is non-empty.
     */
    canRedo(): boolean;
    /**
     * Replace the world, recording history and notifying listeners.
     *
     * @param world - New world tree.
     * @param options - Pass `{ recordHistory: false }` to skip the undo stack (e.g. initial load).
     */
    replaceWorld(world: World, options?: {
        recordHistory?: boolean;
    }): void;
    /**
     * Set the selection without going through {@link Document.dispatch}.
     *
     * Selection-only updates are recorded on the history stack so undo restores
     * the previous selection.
     *
     * @param ids - Node ids to select.
     * @param options - Pass `{ recordHistory: false }` to skip the undo stack.
     */
    setSelection(ids: readonly string[], options?: {
        recordHistory?: boolean;
    }): void;
    /**
     * Apply a {@link Command}, push history, and notify subscribers.
     *
     * @param command - Command to apply.
     * @throws {@link import('../errors').ValidationError} On invalid command input.
     * @throws {@link import('../errors').NotFoundError} When a referenced id is missing.
     * @throws {@link import('../errors').CommandError} When the command cannot be applied.
     */
    dispatch(command: Command): void;
    /**
     * Restore the previous history snapshot.
     *
     * @returns `true` if a snapshot was restored; otherwise `false`.
     */
    undo(): boolean;
    /**
     * Re-apply the next redo snapshot.
     *
     * @returns `true` if a snapshot was restored; otherwise `false`.
     */
    redo(): boolean;
    /**
     * Subscribe to document changes.
     *
     * @param listener - Callback invoked after world/selection updates.
     * @returns Unsubscribe function.
     *
     * @example
     * ```ts
     * const stop = doc.subscribe((change) => {
     *   if (change.reason === 'undo') {
     *     // handle undo
     *   }
     * })
     * stop()
     * ```
     */
    subscribe(listener: DocumentListener): () => void;
    private pruneSelection;
    private emit;
}
/**
 * Create a {@link Document}.
 *
 * @param worldOrOptions - Initial world, or full {@link DocumentOptions}.
 * @returns A new document instance.
 *
 * @example
 * ```ts
 * const doc = createDocument()
 * const doc2 = createDocument(existingWorld)
 * const doc3 = createDocument({ world: existingWorld, historyLimit: 50 })
 * ```
 */
declare function createDocument(worldOrOptions?: World | DocumentOptions): Document;

/**
 * Library default style applied when a node has no (or partial) style.
 */
declare const defaultStyle: Readonly<Required<Omit<NodeStyle, 'extras'>> & Pick<NodeStyle, 'extras'>>;

/**
 * Shallow-merge a style patch onto a base style.
 *
 * `extras` is shallow-merged when both sides define it; otherwise the patch
 * value replaces the base.
 *
 * @param base - Existing style (or empty object).
 * @param patch - Partial style fields to apply.
 * @returns A new {@link NodeStyle} object.
 *
 * @example
 * ```ts
 * const next = mergeStyle({ color: '#fff' }, { opacity: 0.5 })
 * // { color: '#fff', opacity: 0.5 }
 * ```
 */
declare const mergeStyle: (base: NodeStyle | undefined, patch: Partial<NodeStyle>) => NodeStyle;

/**
 * Resolved style with all primary fields filled from {@link defaultStyle}.
 */
type ResolvedNodeStyle = Required<Omit<NodeStyle, 'extras'>> & Pick<NodeStyle, 'extras'>;
/**
 * Resolve a node's style by merging onto {@link defaultStyle}.
 *
 * @param node - Scene node (uses `node.style` when present).
 * @returns Fully resolved style suitable for rendering.
 *
 * @example
 * ```ts
 * const style = resolveStyle(wall)
 * mesh.material.color.set(style.color)
 * ```
 */
declare const resolveStyle: (node: Pick<Node, "style"> | NodeStyle | undefined) => ResolvedNodeStyle;

/**
 * Document JSON import / export.
 *
 * @packageDocumentation
 */
/** Schema version written by {@link exportDocumentObject}. */
declare const PLANA_DOCUMENT_VERSION: 1;
/** Format discriminator for Plana document files. */
declare const PLANA_DOCUMENT_FORMAT: "plana";
/**
 * Optional metadata stored alongside a document file.
 */
type PlanaDocumentMeta = {
    /** Human-readable title. */
    title?: string;
    /** ISO-8601 creation timestamp. */
    createdAt?: string;
    /** ISO-8601 last-modified timestamp. */
    modifiedAt?: string;
    /** Author name or identifier. */
    author?: string;
};
/**
 * On-disk / interchange shape for a Plana document.
 */
type PlanaDocumentFile = {
    /** Always `'plana'`. */
    format: typeof PLANA_DOCUMENT_FORMAT;
    /** Schema version; currently {@link PLANA_DOCUMENT_VERSION}. */
    version: typeof PLANA_DOCUMENT_VERSION;
    /** Optional file metadata. */
    meta?: PlanaDocumentMeta;
    /** Scene root. */
    world: World;
    /** Optional selection ids. */
    selection?: string[];
};
/**
 * Input accepted by export helpers (a full document or world + selection).
 */
type ExportDocumentInput = {
    world: World;
    selection?: readonly string[];
    meta?: PlanaDocumentMeta;
} | {
    getWorld: () => World;
    getSelection: () => {
        ids: readonly string[];
    };
};
/**
 * Result of a successful JSON import.
 */
type ImportDocumentResult = {
    /** Validated world tree. */
    world: World;
    /** Selection ids from the file (empty when omitted). */
    selection: string[];
    /** Optional metadata from the file. */
    meta?: PlanaDocumentMeta;
};

/**
 * Build a {@link PlanaDocumentFile} object from a document or world snapshot.
 *
 * @param input - Document-like object or `{ world, selection?, meta? }`.
 * @returns A serializable document file object.
 *
 * @example
 * ```ts
 * const file = exportDocumentObject({ world: doc.getWorld(), selection: doc.getSelection().ids })
 * ```
 */
declare const exportDocumentObject: (input: ExportDocumentInput) => PlanaDocumentFile;
/**
 * Serialize a document to pretty-printed JSON.
 *
 * @param input - Document-like object or `{ world, selection?, meta? }`.
 * @returns Pretty-printed JSON string (2-space indent).
 *
 * @example
 * ```ts
 * const json = exportDocumentJson(doc)
 * ```
 */
declare const exportDocumentJson: (input: ExportDocumentInput) => string;
/**
 * Parse and validate a Plana document JSON string.
 *
 * @param text - Raw JSON text.
 * @returns Validated world and selection.
 * @throws {@link ValidationError} On invalid JSON, format, version, or world tree.
 *
 * @example
 * ```ts
 * const { world, selection } = importDocumentJson(fileText)
 * doc.replaceWorld(world)
 * doc.setSelection(selection)
 * ```
 */
declare const importDocumentJson: (text: string) => ImportDocumentResult;

/**
 * Light recursive validation that node kinds look sane.
 *
 * @param node - Node to validate.
 * @param path - Dot path for error messages.
 * @throws {@link ValidationError} When a kind is missing or unknown.
 */
declare const validateNodeTree: (node: unknown, path?: string) => void;
/**
 * Ensure a value is a {@link World} with a sane tree.
 *
 * @param value - Candidate world.
 * @returns The validated world.
 * @throws {@link ValidationError} When validation fails.
 */
declare const validateWorld: (value: unknown) => World;

/**
 * Simple id generator for factory helpers.
 *
 * @param prefix - Prefix string (e.g. `'wall'`).
 * @returns A unique id like `wall-a1b2c3`.
 *
 * @example
 * ```ts
 * const id = id('box') // 'box-x7k2m9'
 * ```
 */
declare const id: (prefix: string) => string;

/**
 * Options for {@link createBoxObject}.
 */
type CreateBoxObjectOptions = Partial<Bounds> & {
    /** Node id. Auto-generated when omitted. */
    id?: string;
    /** Display name. */
    name?: string;
    /** Classification tag. */
    tag?: string;
    /** Visual style. */
    style?: NodeStyle;
};
/**
 * Create an independent box solid with default wood-like styling.
 *
 * @param options - Bounds, identity, and style overrides.
 * @returns A new {@link IndependentObject} with `shape.kind === 'box'`.
 *
 * @example
 * ```ts
 * const table = createBoxObject({ name: 'Table', width: 1.2, height: 0.75, depth: 0.8 })
 * ```
 */
declare const createBoxObject: (options?: CreateBoxObjectOptions) => IndependentObject;

/**
 * Options for {@link createWallObject}.
 */
type CreateWallObjectOptions = {
    /** Node id. Auto-generated when omitted. */
    id?: string;
    /** Display name. */
    name?: string;
    /** Classification tag. */
    tag?: string;
    /** Visual style. */
    style?: NodeStyle;
    /** Wall center X in parent space. */
    x?: number;
    /** Wall center Y (typically half height). */
    y?: number;
    /** Wall center Z in parent space. */
    z?: number;
    /** Wall height in meters. */
    height?: number;
    /** Wall thickness in meters. */
    thickness?: number;
    /**
     * Floor path in wall-local XZ. When omitted, a straight wall along +X
     * of length `length` is created.
     */
    path?: FloorPath;
    /** Length used when `path` is omitted. */
    length?: number;
};
/**
 * Create an independent wall solid along a floor path.
 *
 * @param options - Path / length, thickness, height, and style.
 * @returns A new {@link IndependentObject} with `shape.kind === 'wall'`.
 *
 * @example
 * ```ts
 * const wall = createWallObject({ length: 4, height: 2.7, thickness: 0.2 })
 * ```
 */
declare const createWallObject: (options?: CreateWallObjectOptions) => IndependentObject;

/**
 * Options for {@link createRoomApartment}.
 */
type CreateRoomApartmentOptions = {
    /** Interior width along X (meters). */
    width?: number;
    /** Interior depth along Z (meters). */
    depth?: number;
    /** Wall / room height (meters). */
    height?: number;
    /** Wall thickness (meters). */
    wallThickness?: number;
    /** Apartment node id. */
    id?: string;
    /** Apartment display name. */
    name?: string;
};
/**
 * Create a rectangular room apartment with four walls and a floor slab.
 *
 * @param options - Room dimensions and wall thickness.
 * @returns An {@link Apartment} containing a zone with walls + floor.
 *
 * @example
 * ```ts
 * const apt = createRoomApartment({ width: 5, depth: 4, height: 2.7 })
 * ```
 */
declare const createRoomApartment: (options?: CreateRoomApartmentOptions) => Apartment;

/**
 * Build a starter apartment world for the interactive editor.
 *
 * Includes a furnished rectangular room (walls, floor, table, sofa, rug).
 *
 * @returns A complete {@link World} ready for {@link createDocument}.
 *
 * @example
 * ```ts
 * const doc = createDocument({ world: createDemoWorld() })
 * ```
 */
declare const createDemoWorld: () => World;

/**
 * Real apartment layout (~33 m²): corridor, bath, kitchen, living,
 * solid walls with door/window cutouts, 5×5 shelving and end mirrors.
 *
 * Coordinates match the original plan (meters, X east, Z south, Y up).
 *
 * @packageDocumentation
 */

/**
 * Build the real ~33 m² apartment as a Plana {@link World}.
 *
 * Layout: L-corridor, bath, kitchen, living with 5×5 shelving and mirrors.
 * Clear footprint ≈ 6.12 × 5.485 m; outer AABB 6.42 × 5.935 m; wall height 2.47 m.
 *
 * @returns World ready for {@link createDocument} or {@link PlanaEditor}.
 *
 * @example
 * ```ts
 * import { createDocument, createFlatWorld } from 'plana'
 *
 * const doc = createDocument({ world: createFlatWorld() })
 * ```
 */
declare const createFlatWorld: () => World;

/**
 * Read the Plana document from the nearest {@link PlanaProvider}.
 *
 * @returns The shared {@link Document}.
 * @throws {Error} When called outside a {@link PlanaProvider}.
 *
 * @example
 * ```tsx
 * function Toolbar() {
 *   const doc = usePlanaDocument()
 *   return <button onClick={() => doc.undo()}>Undo</button>
 * }
 * ```
 */
declare function usePlanaDocument(): Document;
/**
 * Subscribe to the document world and re-render when it changes.
 *
 * @returns The current {@link World}.
 *
 * @example
 * ```tsx
 * function Scene() {
 *   const world = usePlanaWorld()
 *   return <div>{world.children.length} top-level nodes</div>
 * }
 * ```
 */
declare function usePlanaWorld(): World;
/**
 * Subscribe to the document selection and re-render when it changes.
 *
 * @returns The current {@link Selection}.
 *
 * @example
 * ```tsx
 * function SelectionBadge() {
 *   const { ids } = usePlanaSelection()
 *   return <span>{ids.length} selected</span>
 * }
 * ```
 */
declare function usePlanaSelection(): Selection;
/**
 * Dispatcher bound to the current document.
 *
 * @returns A function that applies a {@link Command} via {@link Document.dispatch}.
 *
 * @example
 * ```tsx
 * function ClearSelection() {
 *   const dispatch = usePlanaDispatch()
 *   return (
 *     <button onClick={() => dispatch({ type: 'setSelection', ids: [] })}>
 *       Clear
 *     </button>
 *   )
 * }
 * ```
 */
declare function usePlanaDispatch(): (command: Command) => void;

/**
 * React context value for a Plana {@link Document}.
 */
type PlanaContextValue = {
    /** Shared document instance for the subtree. */
    document: Document;
};
/**
 * Context holding the active {@link Document}. Prefer the hooks in `./hooks`.
 */
declare const PlanaContext: React.Context<PlanaContextValue | null>;
/**
 * Props for {@link PlanaProvider}.
 */
type PlanaProviderProps = {
    /**
     * Existing document to provide. When omitted, a document is created from
     * {@link PlanaProviderProps.world} (or an empty world).
     */
    document?: Document;
    /** Initial world used only when `document` is not passed (first mount). */
    world?: World;
    /** React children that may call Plana hooks. */
    children: ReactNode;
};
/**
 * Provide a Plana {@link Document} to descendant hooks.
 *
 * The engine itself has zero React dependency; this provider is a thin bridge.
 *
 * @param props - Document or initial world plus children.
 * @returns Context provider element.
 *
 * @example
 * ```tsx
 * const doc = createDocument()
 * return (
 *   <PlanaProvider document={doc}>
 *     <EditorCanvas />
 *   </PlanaProvider>
 * )
 * ```
 */
declare function PlanaProvider(props: PlanaProviderProps): React.JSX.Element;

/** Dimension overlay mode for the editor / canvas. */
type DimensionsMode = 'off' | 'selection' | 'all';
/**
 * Props for {@link PlanaDimensions}.
 */
type PlanaDimensionsProps = {
    /** Current world tree. */
    world: World;
    /** Current selection snapshot. */
    selection: Selection;
    /**
     * Overlay mode: `off` | `selection` | `all`.
     * Legacy `visible` boolean is accepted via callers that map it.
     */
    mode: DimensionsMode;
};
/**
 * Figma-like size labels (mm) as HTML overlays.
 *
 * - `selection` — selected solids only (hint when nothing selected)
 * - `all` — every visible independent solid
 *
 * @param props - World, selection, and mode.
 * @returns Dimension overlays, or `null` when off / empty.
 */
declare function PlanaDimensions(props: PlanaDimensionsProps): React.JSX.Element | null;

/**
 * Props for {@link PlanaCanvas}.
 */
type PlanaCanvasProps = {
    /** Optional class name on the canvas container. */
    className?: string;
    /** Show a ground grid. Defaults to `true`. */
    showGrid?: boolean;
    /**
     * Orbit target in world meters. Defaults to a point above the flat center.
     */
    target?: [number, number, number];
    /** Dimension overlay mode. Defaults to `'off'`. */
    dimensionsMode?: DimensionsMode;
    /** When true, draw sparse plan hatch. Defaults to `false`. */
    showHatch?: boolean;
    /** Extra Canvas props (camera, etc.). */
    canvasProps?: Omit<CanvasProps, 'children' | 'className'>;
    /** Additional scene children rendered after world meshes. */
    children?: React.ReactNode;
};
/**
 * React Three Fiber canvas with lights, orbit controls, grid, and Plana solids.
 *
 * Document state is read **outside** the Canvas and passed in as props so hosts
 * like Next.js do not lose React context across the R3F boundary.
 *
 * @param props - Canvas presentation options.
 * @returns A full-size R3F canvas element.
 *
 * @example
 * ```tsx
 * <PlanaProvider world={createFlatWorld()}>
 *   <PlanaCanvas />
 * </PlanaProvider>
 * ```
 */
declare function PlanaCanvas(props: PlanaCanvasProps): React.JSX.Element;

/**
 * Props for {@link PlanaWorldMesh}.
 *
 * Pass world/selection from outside {@link Canvas} — React context does not
 * reliably cross the R3F reconciler boundary in all hosts (e.g. Next.js).
 */
type PlanaWorldMeshProps = {
    /** Current world tree. */
    world: World;
    /** Current selection snapshot. */
    selection: Selection;
    /** Selection handler (node id, shift-additive). */
    onSelect: (id: string | undefined, additive: boolean) => void;
    /** When true, draw sparse plan hatch. Defaults to `false`. */
    showHatch?: boolean;
};
/**
 * Renders world solids as draft meshes (fill + edges) plus optional world hatch.
 *
 * @param props - World, selection, and click handler from the host (outside Canvas).
 * @returns A group of meshes for the active world.
 */
declare function PlanaWorldMesh(props: PlanaWorldMeshProps): React.JSX.Element;

/**
 * Convert a Plana {@link PlanaMesh} into a Three.js `BufferGeometry`.
 *
 * @param mesh - Engine mesh buffers (positions required; indices/normals optional).
 * @returns A new `THREE.BufferGeometry`.
 */
declare const meshToBufferGeometry: (mesh: Mesh) => THREE.BufferGeometry;

/**
 * Props for {@link PlanaEditor}.
 */
type PlanaEditorProps = {
    /**
     * Existing document to edit. When omitted, a document is created from
     * {@link PlanaEditorProps.world} (or {@link createDemoWorld}).
     */
    document?: Document;
    /** Initial world used only when `document` is not passed. */
    world?: World;
    /** Optional class name on the root editor element. */
    className?: string;
    /** Inject the built-in editor stylesheet. Defaults to `true`. */
    injectStyles?: boolean;
};
/**
 * Full-screen Plana apartment plan editor.
 *
 * Layout: top toolbar, left hierarchy, center 3D canvas, right inspector.
 * Keyboard: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo, Delete remove selection.
 *
 * @param props - Optional document/world and presentation options.
 * @returns The editor root element wrapped in {@link PlanaProvider}.
 *
 * @example
 * ```tsx
 * import { PlanaEditor, createDemoWorld } from 'plana'
 *
 * export function App() {
 *   return <PlanaEditor world={createDemoWorld()} />
 * }
 * ```
 */
declare function PlanaEditor(props?: PlanaEditorProps): React.JSX.Element;

/**
 * Props for {@link EditorToolbar}.
 */
type EditorToolbarProps = {
    /** Dimension overlay mode. */
    dimensionsMode?: DimensionsMode;
    /** Set dimension overlay mode. */
    onDimensionsModeChange?: (mode: DimensionsMode) => void;
    /** Whether sparse plan hatch is drawn. */
    showHatch?: boolean;
    /** Toggle hatch. */
    onToggleHatch?: () => void;
};
/**
 * Top toolbar for the Plana editor: file ops, history, and add primitives.
 *
 * @param props - Optional dimensions / hatch wiring.
 * @returns Toolbar element.
 */
declare function EditorToolbar(props?: EditorToolbarProps): React.JSX.Element;

/**
 * Hierarchy panel listing the world tree by name / kind / id.
 *
 * Tree groups are collapsible via chevrons (Figma-like). Selection highlight
 * stays in sync with the inspector / 3D selection.
 *
 * @returns Scrollable tree content (wrap in {@link EditorSidebar}).
 */
declare function HierarchyPanel(): React.JSX.Element;

/**
 * Inspector for the primary selected node: identity, bounds, and style.
 *
 * Sections are collapsible. Wrap in {@link EditorSidebar} for chrome.
 *
 * @returns Inspector content element.
 */
declare function InspectorPanel(): React.JSX.Element;

/**
 * Shared CSS for the Plana editor chrome.
 *
 * shadcn/ui dark (zinc) look — system font stack, card panels, muted borders.
 */
/** Inline stylesheet for the editor shell. */
declare const editorStyles = "\n.plana-editor {\n  --background: 240 10% 3.9%;\n  --foreground: 0 0% 98%;\n  --card: 240 10% 3.9%;\n  --card-foreground: 0 0% 98%;\n  --popover: 240 10% 3.9%;\n  --popover-foreground: 0 0% 98%;\n  --primary: 0 0% 98%;\n  --primary-foreground: 240 5.9% 10%;\n  --secondary: 240 3.7% 15.9%;\n  --secondary-foreground: 0 0% 98%;\n  --muted: 240 3.7% 15.9%;\n  --muted-foreground: 240 5% 64.9%;\n  --accent: 240 3.7% 15.9%;\n  --accent-foreground: 0 0% 98%;\n  --destructive: 0 62.8% 30.6%;\n  --destructive-foreground: 0 0% 98%;\n  --border: 240 3.7% 15.9%;\n  --input: 240 3.7% 15.9%;\n  --ring: 240 4.9% 83.9%;\n  --radius: 0.5rem;\n\n  --pe-bg: hsl(var(--background));\n  --pe-panel: hsl(var(--card));\n  --pe-panel-2: hsl(var(--secondary));\n  --pe-ink: hsl(var(--background));\n  --pe-border: hsl(var(--border));\n  --pe-border-strong: hsl(240 3.7% 22%);\n  --pe-text: hsl(var(--foreground));\n  --pe-muted: hsl(var(--muted-foreground));\n  --pe-accent: hsl(var(--primary));\n  --pe-accent-2: hsl(var(--muted-foreground));\n  --pe-accent-soft: hsl(var(--secondary));\n  --pe-danger: hsl(0 72% 51%);\n  --pe-input: hsl(var(--input));\n  --pe-radius: var(--radius);\n  --pe-font: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;\n  --pe-display: var(--pe-font);\n  --pe-sidebar-rail: 28px;\n\n  box-sizing: border-box;\n  display: grid;\n  grid-template-rows: auto minmax(0, 1fr);\n  width: 100%;\n  height: 100%;\n  min-height: 0;\n  background: var(--pe-bg);\n  color: var(--pe-text);\n  font-family: var(--pe-font);\n  font-size: 13px;\n  line-height: 1.5;\n  -webkit-font-smoothing: antialiased;\n}\n\n.plana-editor *,\n.plana-editor *::before,\n.plana-editor *::after {\n  box-sizing: border-box;\n}\n\n/* Hide scrollbars on panel bodies only; scrolling still works */\n.plana-panel__body {\n  scrollbar-width: none;\n  -ms-overflow-style: none;\n}\n\n.plana-panel__body::-webkit-scrollbar {\n  display: none;\n  width: 0;\n  height: 0;\n}\n\n.plana-editor__body {\n  display: flex;\n  min-height: 0;\n  height: 100%;\n  overflow: hidden;\n}\n\n.plana-editor__viewport {\n  position: relative;\n  flex: 1 1 auto;\n  min-width: 0;\n  min-height: 0;\n  height: 100%;\n  overflow: hidden;\n  background: #09090b;\n  border-left: 1px solid var(--pe-border);\n  border-right: 1px solid var(--pe-border);\n}\n\n.plana-editor__viewport > div {\n  width: 100% !important;\n  height: 100% !important;\n}\n\n.plana-editor__viewport canvas {\n  display: block;\n  width: 100% !important;\n  height: 100% !important;\n}\n\n.plana-toolbar {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  min-height: 48px;\n  padding: 0 8px;\n  background: hsl(var(--background) / 0.95);\n  border-bottom: 1px solid var(--pe-border);\n  backdrop-filter: blur(8px);\n}\n\n.plana-toolbar__brand {\n  display: grid;\n  place-items: center;\n  padding: 0 14px;\n  margin-right: 4px;\n  font-family: var(--pe-display);\n  font-size: 0.875rem;\n  font-weight: 600;\n  letter-spacing: -0.02em;\n  color: var(--pe-text);\n  border-right: 1px solid var(--pe-border);\n  user-select: none;\n}\n\n.plana-toolbar__group {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  padding: 0 4px;\n}\n\n.plana-toolbar__label {\n  color: var(--pe-muted);\n  font-size: 11px;\n  font-weight: 500;\n  letter-spacing: 0.04em;\n  text-transform: uppercase;\n  padding: 0 4px;\n  user-select: none;\n}\n\n.plana-segmented {\n  display: inline-flex;\n  align-items: stretch;\n  border: 1px solid var(--pe-border);\n  border-radius: calc(var(--pe-radius) - 1px);\n  overflow: hidden;\n  background: hsl(var(--secondary));\n}\n\n.plana-segmented__btn {\n  appearance: none;\n  border: 0;\n  margin: 0;\n  padding: 4px 10px;\n  background: transparent;\n  color: var(--pe-muted);\n  font: inherit;\n  font-size: 12px;\n  font-weight: 500;\n  line-height: 1.2;\n  cursor: pointer;\n  transition: background 120ms ease, color 120ms ease;\n}\n\n.plana-segmented__btn + .plana-segmented__btn {\n  border-left: 1px solid var(--pe-border);\n}\n\n.plana-segmented__btn:hover {\n  color: var(--pe-text);\n  background: hsl(var(--accent));\n}\n\n.plana-segmented__btn--active {\n  background: hsl(var(--primary));\n  color: hsl(var(--primary-foreground));\n}\n\n.plana-segmented__btn--active:hover {\n  background: hsl(0 0% 90%);\n  color: hsl(var(--primary-foreground));\n}\n\n.plana-toolbar__sep {\n  width: 1px;\n  align-self: stretch;\n  min-height: 24px;\n  margin: 8px 4px;\n  background: var(--pe-border);\n}\n\n.plana-btn {\n  appearance: none;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  height: 32px;\n  padding: 0 12px;\n  border: 1px solid var(--pe-border);\n  border-radius: calc(var(--pe-radius) - 2px);\n  background: hsl(var(--secondary));\n  color: hsl(var(--secondary-foreground));\n  font: inherit;\n  font-size: 0.8125rem;\n  font-weight: 500;\n  line-height: 1;\n  cursor: pointer;\n  transition: background 120ms ease, color 120ms ease, border-color 120ms ease, opacity 120ms ease;\n}\n\n.plana-btn:hover:not(:disabled) {\n  background: hsl(240 3.7% 20%);\n  color: var(--pe-text);\n}\n\n.plana-btn:active:not(:disabled) {\n  background: hsl(240 3.7% 18%);\n}\n\n.plana-btn:disabled {\n  opacity: 0.5;\n  cursor: not-allowed;\n}\n\n.plana-btn--accent {\n  background: hsl(var(--primary));\n  border-color: transparent;\n  color: hsl(var(--primary-foreground));\n}\n\n.plana-btn--accent:hover:not(:disabled) {\n  background: hsl(0 0% 90%);\n  color: hsl(var(--primary-foreground));\n}\n\n.plana-btn--danger:hover:not(:disabled) {\n  background: hsl(0 62.8% 30.6% / 0.25);\n  border-color: hsl(0 62.8% 30.6% / 0.5);\n  color: hsl(0 86% 70%);\n}\n\n.plana-btn--active {\n  background: hsl(var(--primary));\n  border-color: transparent;\n  color: hsl(var(--primary-foreground));\n}\n\n.plana-btn--active:hover:not(:disabled) {\n  background: hsl(0 0% 90%);\n  color: hsl(var(--primary-foreground));\n}\n\n.plana-btn--icon {\n  width: 28px;\n  height: 28px;\n  padding: 0;\n  flex-shrink: 0;\n}\n\n.plana-panel {\n  position: relative;\n  display: flex;\n  flex-direction: column;\n  flex: 0 0 auto;\n  width: var(--pe-panel-width, 260px);\n  min-width: var(--pe-sidebar-rail);\n  min-height: 0;\n  height: 100%;\n  background: var(--pe-panel);\n  border: 0;\n  /* No mount fade \u2014 restarting pe-fade-in was flashing both sidebars to opacity 0. */\n  contain: layout paint;\n}\n\n.plana-panel--collapsed {\n  width: var(--pe-sidebar-rail);\n  min-width: var(--pe-sidebar-rail);\n  max-width: var(--pe-sidebar-rail);\n  flex: 0 0 var(--pe-sidebar-rail);\n}\n\n.plana-panel__header {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  flex: 0 0 auto;\n  min-height: 40px;\n  padding: 4px 6px 4px 10px;\n  border-bottom: 1px solid var(--pe-border);\n}\n\n.plana-panel__header[hidden] {\n  display: none !important;\n}\n\n.plana-panel__title {\n  flex: 1;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-family: var(--pe-display);\n  font-size: 0.75rem;\n  font-weight: 600;\n  letter-spacing: 0.02em;\n  text-transform: uppercase;\n  color: var(--pe-muted);\n}\n\n.plana-panel__body {\n  flex: 1;\n  min-height: 0;\n  overflow: auto;\n  overscroll-behavior: contain;\n  padding: 8px;\n  scrollbar-width: none;\n  -ms-overflow-style: none;\n}\n\n.plana-panel__body--parked,\n.plana-panel__body[hidden] {\n  display: none !important;\n}\n\n.plana-panel__rail {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: flex-start;\n  gap: 8px;\n  height: 100%;\n  padding: 8px 0;\n}\n\n/* Author display:flex beats the UA [hidden] rule \u2014 force hide. */\n.plana-panel__rail[hidden] {\n  display: none !important;\n}\n\n.plana-panel__rail-label {\n  writing-mode: vertical-rl;\n  transform: rotate(180deg);\n  font-size: 0.6875rem;\n  font-weight: 600;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n  color: var(--pe-muted);\n  user-select: none;\n}\n\n.plana-panel__resize {\n  position: absolute;\n  top: 0;\n  bottom: 0;\n  width: 4px;\n  z-index: 2;\n  cursor: col-resize;\n  touch-action: none;\n  background: transparent;\n}\n\n.plana-panel__resize:hover,\n.plana-panel__resize:active {\n  background: hsl(var(--ring) / 0.35);\n}\n\n.plana-panel__resize--left {\n  right: -2px;\n}\n\n.plana-panel__resize--right {\n  left: -2px;\n}\n\n.plana-tree {\n  list-style: none;\n  margin: 0;\n  padding: 0;\n}\n\n.plana-tree ul {\n  list-style: none;\n  margin: 0;\n  padding-left: 12px;\n  border-left: 1px solid var(--pe-border);\n}\n\n.plana-tree__row {\n  display: flex;\n  align-items: center;\n  gap: 2px;\n  width: 100%;\n}\n\n.plana-tree__chevron {\n  appearance: none;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 18px;\n  height: 18px;\n  flex-shrink: 0;\n  padding: 0;\n  border: 0;\n  border-radius: calc(var(--pe-radius) - 4px);\n  background: transparent;\n  color: var(--pe-muted);\n  cursor: pointer;\n  transition: background 120ms ease, color 120ms ease, transform 120ms ease;\n}\n\n.plana-tree__chevron:hover {\n  background: hsl(var(--accent));\n  color: var(--pe-text);\n}\n\n.plana-tree__chevron--open {\n  transform: rotate(90deg);\n}\n\n.plana-tree__chevron--leaf {\n  visibility: hidden;\n  pointer-events: none;\n}\n\n.plana-tree__item {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  flex: 1;\n  min-width: 0;\n  text-align: left;\n  border: 1px solid transparent;\n  background: transparent;\n  color: inherit;\n  font: inherit;\n  padding: 6px 8px;\n  border-radius: calc(var(--pe-radius) - 2px);\n  cursor: pointer;\n  transition: background 120ms ease, border-color 120ms ease;\n}\n\n.plana-tree__item:hover {\n  background: hsl(var(--accent));\n}\n\n.plana-tree__item--selected {\n  background: hsl(240 5% 32%);\n  border-color: hsl(var(--ring) / 0.7);\n  box-shadow: inset 3px 0 0 hsl(0 0% 98%);\n  color: var(--pe-text);\n}\n\n.plana-tree__item--selected .plana-tree__kind {\n  color: hsl(var(--foreground) / 0.72);\n}\n\n.plana-tree__kind {\n  color: var(--pe-muted);\n  font-size: 10px;\n  text-transform: uppercase;\n  letter-spacing: 0.06em;\n  min-width: 58px;\n}\n\n.plana-tree__name {\n  flex: 1;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.plana-field {\n  display: grid;\n  gap: 6px;\n  margin-bottom: 12px;\n}\n\n.plana-field label {\n  color: var(--pe-muted);\n  font-size: 11px;\n  font-weight: 500;\n  letter-spacing: 0.02em;\n}\n\n.plana-field input[type='text'],\n.plana-field input[type='number'],\n.plana-field input[type='color'] {\n  width: 100%;\n  height: 32px;\n  background: hsl(var(--background));\n  border: 1px solid var(--pe-border);\n  border-radius: calc(var(--pe-radius) - 2px);\n  color: var(--pe-text);\n  padding: 6px 10px;\n  font: inherit;\n  font-size: 0.8125rem;\n  transition: border-color 120ms ease, box-shadow 120ms ease;\n}\n\n.plana-field input[type='color'] {\n  padding: 2px;\n  cursor: pointer;\n}\n\n.plana-field input:focus {\n  outline: none;\n  border-color: hsl(var(--ring));\n  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.25);\n}\n\n.plana-field--row {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 8px;\n}\n\n.plana-field--check {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.plana-field--check input {\n  accent-color: hsl(var(--foreground));\n}\n\n.plana-section {\n  margin-top: 2px;\n  margin-bottom: 8px;\n  border: 1px solid transparent;\n  border-radius: calc(var(--pe-radius) - 2px);\n}\n\n.plana-section__header {\n  appearance: none;\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  width: 100%;\n  margin: 0;\n  padding: 8px 6px;\n  border: 0;\n  border-radius: calc(var(--pe-radius) - 2px);\n  background: transparent;\n  color: var(--pe-text);\n  font: inherit;\n  cursor: pointer;\n  transition: background 120ms ease;\n}\n\n.plana-section__header:hover {\n  background: hsl(var(--accent));\n}\n\n.plana-section__chevron {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 14px;\n  height: 14px;\n  flex-shrink: 0;\n  color: var(--pe-muted);\n  transition: transform 120ms ease;\n}\n\n.plana-section__chevron--open {\n  transform: rotate(90deg);\n}\n\n.plana-section__title {\n  flex: 1;\n  text-align: left;\n  font-family: var(--pe-display);\n  font-size: 0.8125rem;\n  font-weight: 600;\n  letter-spacing: -0.01em;\n  color: var(--pe-text);\n  margin: 0;\n}\n\n.plana-section__body {\n  padding: 2px 6px 8px;\n}\n\n.plana-empty {\n  color: var(--pe-muted);\n  padding: 18px 10px;\n  text-align: left;\n}\n\n.plana-dim {\n  pointer-events: none;\n  white-space: nowrap;\n  padding: 5px 9px;\n  border-radius: calc(var(--pe-radius) - 2px);\n  border: 1px solid hsl(var(--border));\n  background: hsl(var(--background) / 0.94);\n  color: hsl(var(--foreground));\n  font-family: var(--pe-font);\n  font-size: 12px;\n  font-weight: 560;\n  letter-spacing: 0.02em;\n  line-height: 1.25;\n  box-shadow: 0 1px 3px hsl(0 0% 0% / 0.45);\n  backdrop-filter: blur(6px);\n}\n\n.plana-dim--emphasis {\n  border-color: hsl(var(--ring));\n  background: hsl(0 0% 98% / 0.95);\n  color: hsl(240 10% 3.9%);\n  font-size: 13px;\n  font-weight: 600;\n}\n\n.plana-dim--hint {\n  opacity: 0.85;\n  font-weight: 500;\n  color: var(--pe-muted);\n  border-style: dashed;\n}\n\n@media (max-width: 960px) {\n  .plana-editor {\n    min-height: 0;\n    height: 100%;\n  }\n\n  .plana-editor__body {\n    flex-direction: column;\n    min-height: 0;\n    flex: 1 1 auto;\n  }\n\n  .plana-panel {\n    width: 100% !important;\n    height: auto;\n    max-height: min(28dvh, 220px);\n    order: 2;\n  }\n\n  .plana-panel--truncated {\n    width: 100% !important;\n    max-height: 44px;\n  }\n\n  .plana-panel__resize {\n    display: none;\n  }\n\n  .plana-editor__viewport {\n    flex: 1 1 auto;\n    order: 1;\n    min-height: min(48dvh, 420px);\n    border-left: 0;\n    border-right: 0;\n    border-top: 0;\n    border-bottom: 1px solid var(--pe-border);\n  }\n\n  .plana-toolbar {\n    flex-wrap: wrap;\n    gap: 0.35rem;\n    padding: 0.4rem 0.5rem;\n  }\n\n  .plana-toolbar .plana-btn {\n    min-height: 36px;\n  }\n}\n\n@media (max-width: 640px) {\n  .plana-editor__viewport {\n    min-height: min(52dvh, 480px);\n  }\n\n  .plana-panel {\n    max-height: min(24dvh, 180px);\n  }\n\n  .plana-panel__header,\n  .plana-section__header {\n    padding-inline: 0.65rem;\n  }\n}\n";

export { CommandError, Document, EditorToolbar, GeometryError, HierarchyPanel, History, InspectorPanel, NotFoundError, PLANA_DOCUMENT_FORMAT, PLANA_DOCUMENT_VERSION, PlanaCanvas, PlanaContext, PlanaDimensions, PlanaEditor, PlanaError, PlanaProvider, PlanaWorldMesh, ValidationError, add2, add3, addChildToParent, applyCommand, boundsSize, buildBoxMesh, buildCapsuleMesh, buildCutoutMesh, buildCylinderMesh, buildExtrudeMesh, buildIndependentGeometry, buildShapeMesh, buildSphereMesh, buildWallMesh, buildWorldSolids, canParentChild, cloneWorldShallow, composeMatrices, computeVertexNormals, contourToRing, createBoxObject, createDemoWorld, createDocument, createEmptyWorld, createFlatWorld, createHistorySnapshot, createRoomApartment, createSelection, createWallObject, cross3, cutoutToHoleRings, cutoutsToWallGaps, defaultStyle, editorStyles, emptyMesh, emptySelection, exportDocumentJson, exportDocumentObject, findNodeById, flattenPath, getChildNodes, id, importDocumentJson, isApartment, isCompositeObject, isGroup, isIndependentObject, isSelected, isWorld, isZone, length2, length3, mat4Identity, mat4Multiply, mat4TransformDirection, mat4TransformPoint, mat4Translate, mergeMeshes, mergeStyle, meshToBufferGeometry, nodeLocalMatrix, normalize2, normalize3, perp2, pushQuad, removeNodeById, requireId, requireNodeById, resolveStyle, scale2, scale3, selectionEquals, sub2, sub3, transformMesh, updateNodeById, usePlanaDispatch, usePlanaDocument, usePlanaSelection, usePlanaWorld, validateNodeTree, validateWorld, vec2, vec3, walkWorld };
export type { AddNodeCommand, Apartment, ApplyCommandResult, Bounds, Command, CompositeObject, Contour, CreateBoxObjectOptions, CreateRoomApartmentOptions, CreateWallObjectOptions, Cutout, DimensionsMode, DocumentChange, DocumentChangeReason, DocumentListener, DocumentOptions, ExportDocumentInput, FloorArc, FloorLine, FloorPath, FloorSegment, Group, HistorySnapshot, ImportDocumentResult, IndependentGeometry, IndependentObject, Mat4, Mesh, Node, NodeBase, NodeKind, NodeStyle, PlanaCanvasProps, PlanaContextValue, PlanaDimensionsProps, PlanaDocumentFile, PlanaDocumentMeta, PlanaEditorProps, PlanaProviderProps, RemoveNodeCommand, ReplaceWorldCommand, ResolvedNodeStyle, Selection, SetSelectionCommand, Shape, Tag, UpdateBoundsCommand, UpdateIndependentCommand, UpdateNodeCommand, UpdateStyleCommand, Vec2, Vec3, WallGap, World, WorldNode, WorldSolid, Zone };
