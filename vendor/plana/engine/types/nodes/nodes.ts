/**
 * Scene-graph node types for Plana worlds.
 *
 * Node kinds: `world` → `apartment` / `group` → `zone` / nested groups →
 * `composite` / `independent` solids.
 *
 * @packageDocumentation
 */

import type { Contour, Cutout, Shape } from './independent-object'
import type { Bounds } from './math'
import type { NodeStyle } from './style'

/**
 * Free-form tag string attached to a node (filtering, styling, editor metadata).
 */
export type Tag = string

/**
 * Shared fields for every scene node: optional identity plus {@link Bounds}.
 */
export type NodeBase = Bounds & {
    /** Stable identifier used by selection, commands, and lookups. */
    id?: string
    /** Human-readable label for editors and debugging. */
    name?: string
    /** Optional classification tag. */
    tag?: Tag
    /** Optional visual / interaction style. */
    style?: NodeStyle
}

/**
 * Leaf solid: a single geometric object with optional cutouts.
 */
export type IndependentObject = NodeBase & {
    kind: 'independent'
    /** Tessellatable shape; defaults to a box when omitted. */
    shape?: Shape
    /** Openings / voids relative to the host solid. */
    cutouts?: Cutout[]
}

/**
 * Aggregate of independent objects that move/transform as one unit.
 */
export type CompositeObject = NodeBase & {
    kind: 'composite'
    /** Member solids in composite local space. */
    objects: IndependentObject[]
}

/**
 * Hierarchical grouping node (furniture sets, layers, etc.).
 */
export type Group = NodeBase & {
    kind: 'group'
    /** Nested objects, zones, or further groups. */
    children: Array<IndependentObject | CompositeObject | Zone | Group>
}

/**
 * Named spatial region inside an apartment (room, corridor, balcony).
 */
export type Zone = NodeBase & {
    kind: 'zone'
    /** Optional plan outline of the zone. */
    footprint?: Contour
    /** Contents of the zone. */
    children: Array<IndependentObject | CompositeObject | Group>
}

/**
 * Single dwelling unit containing zones and groups.
 */
export type Apartment = NodeBase & {
    kind: 'apartment'
    /** Optional plan outline of the apartment. */
    footprint?: Contour
    /** Top-level spaces inside the apartment. */
    children: Array<Zone | Group>
}

/**
 * Root of the scene graph for a document.
 */
export type World = NodeBase & {
    kind: 'world'
    /** Apartments and top-level groups. */
    children: Array<Apartment | Group>
}

/**
 * Any node in the Plana scene graph.
 */
export type Node = World | Apartment | Zone | Group | CompositeObject | IndependentObject

/**
 * Discriminant string for {@link Node}.
 */
export type NodeKind = Node['kind']

/**
 * Type guard for {@link World}.
 *
 * @param n - Node to test.
 * @returns `true` when `n.kind === 'world'`.
 */
export const isWorld = (n: Node): n is World => n.kind === 'world'

/**
 * Type guard for {@link Apartment}.
 *
 * @param n - Node to test.
 * @returns `true` when `n.kind === 'apartment'`.
 */
export const isApartment = (n: Node): n is Apartment => n.kind === 'apartment'

/**
 * Type guard for {@link Zone}.
 *
 * @param n - Node to test.
 * @returns `true` when `n.kind === 'zone'`.
 */
export const isZone = (n: Node): n is Zone => n.kind === 'zone'

/**
 * Type guard for {@link Group}.
 *
 * @param n - Node to test.
 * @returns `true` when `n.kind === 'group'`.
 */
export const isGroup = (n: Node): n is Group => n.kind === 'group'

/**
 * Type guard for {@link CompositeObject}.
 *
 * @param n - Node to test.
 * @returns `true` when `n.kind === 'composite'`.
 */
export const isCompositeObject = (n: Node): n is CompositeObject => n.kind === 'composite'

/**
 * Type guard for {@link IndependentObject}.
 *
 * @param n - Node to test.
 * @returns `true` when `n.kind === 'independent'`.
 */
export const isIndependentObject = (n: Node): n is IndependentObject => n.kind === 'independent'
