import type { Bounds, IndependentObject, Node, World } from '../types/nodes'
import type { NodeStyle } from '../types/nodes/style'

/**
 * Replace the entire world tree.
 */
export type ReplaceWorldCommand = {
    type: 'replaceWorld'
    /** New world to install. */
    world: World
}

/**
 * Set the document selection to the given node ids.
 */
export type SetSelectionCommand = {
    type: 'setSelection'
    /** Selected node ids (duplicates ignored by the document). */
    ids: readonly string[]
}

/**
 * Insert a node under a parent container.
 */
export type AddNodeCommand = {
    type: 'addNode'
    /**
     * Parent node id. Use `null` (or omit matching the world id) to attach
     * under the world root.
     */
    parentId: string | null
    /** Node to insert. Must have a unique `id`. */
    node: Node
}

/**
 * Remove a node (and its subtree) by id.
 */
export type RemoveNodeCommand = {
    type: 'removeNode'
    /** Id of the node to remove. */
    id: string
}

/**
 * Patch fields on an independent object.
 */
export type UpdateIndependentCommand = {
    type: 'updateIndependent'
    /** Target independent object id. */
    id: string
    /**
     * Partial fields to merge. `kind` and `id` cannot be changed.
     */
    patch: Partial<Omit<IndependentObject, 'kind' | 'id'>>
}

/**
 * Patch axis-aligned bounds (center + size) on any node.
 */
export type UpdateBoundsCommand = {
    type: 'updateBounds'
    /** Target node id. */
    id: string
    /** Partial bounds fields to merge. */
    bounds: Partial<Bounds>
}

/**
 * Merge a style patch into `node.style` for any node.
 */
export type UpdateStyleCommand = {
    type: 'updateStyle'
    /** Target node id. */
    id: string
    /** Partial style fields to merge into the existing style. */
    style: Partial<NodeStyle>
}

/**
 * Shallow-patch top-level fields on any node.
 *
 * `kind` and `id` cannot be changed. Nested collections such as `children`
 * are replaced only when explicitly provided in the patch (no deep merge).
 */
export type UpdateNodeCommand = {
    type: 'updateNode'
    /** Target node id. */
    id: string
    /** Partial fields to merge. `kind` and `id` cannot be changed. */
    patch: Partial<Omit<Node, 'kind' | 'id'>>
}

/**
 * Discriminated union of all document commands.
 *
 * Commands are plain data; apply them with {@link applyCommand} or
 * {@link Document.dispatch}.
 */
export type Command =
    | ReplaceWorldCommand
    | SetSelectionCommand
    | AddNodeCommand
    | RemoveNodeCommand
    | UpdateIndependentCommand
    | UpdateBoundsCommand
    | UpdateStyleCommand
    | UpdateNodeCommand

/**
 * Result of applying a command to world (+ optional selection override).
 */
export type ApplyCommandResult = {
    /** Updated world (may be the same reference when the command only touches selection). */
    world: World
    /**
     * When set, the document should replace its selection with this value.
     * When `undefined`, selection is left unchanged.
     */
    selectionIds?: readonly string[]
}
