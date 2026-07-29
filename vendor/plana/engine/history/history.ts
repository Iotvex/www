import type { World } from '../types/nodes'
import type { Selection } from '../selection'
import { createSelection } from '../selection'

/**
 * Immutable snapshot of document state stored on the undo/redo stacks.
 */
export type HistorySnapshot = Readonly<{
    /** Scene graph at the time of the snapshot. */
    world: World
    /** Selection at the time of the snapshot. */
    selection: Selection
}>

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
export const createHistorySnapshot = (world: World, selection: Selection): HistorySnapshot =>
    Object.freeze({
        world,
        selection: createSelection(selection.ids),
    })

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
export class History {
    private readonly undoStack: HistorySnapshot[] = []
    private readonly redoStack: HistorySnapshot[] = []
    private readonly limit: number

    /**
     * @param limit - Maximum number of undo entries retained (oldest dropped). Defaults to `100`.
     */
    constructor(limit = 100) {
        this.limit = Math.max(1, limit)
    }

    /**
     * Whether an undo operation is available.
     */
    get canUndo(): boolean {
        return this.undoStack.length > 0
    }

    /**
     * Whether a redo operation is available.
     */
    get canRedo(): boolean {
        return this.redoStack.length > 0
    }

    /**
     * Number of entries on the undo stack.
     */
    get undoDepth(): number {
        return this.undoStack.length
    }

    /**
     * Number of entries on the redo stack.
     */
    get redoDepth(): number {
        return this.redoStack.length
    }

    /**
     * Record a snapshot taken *before* a mutating change. Clears the redo stack.
     *
     * @param snapshot - Previous world + selection.
     */
    push(snapshot: HistorySnapshot): void {
        this.undoStack.push(snapshot)
        if (this.undoStack.length > this.limit) {
            this.undoStack.shift()
        }
        this.redoStack.length = 0
    }

    /**
     * Pop the previous snapshot and push `current` onto the redo stack.
     *
     * @param current - Document state at the moment of undo (pushed to redo).
     * @returns The restored snapshot, or `null` if the undo stack is empty.
     */
    undo(current: HistorySnapshot): HistorySnapshot | null {
        const previous = this.undoStack.pop()
        if (!previous) return null
        this.redoStack.push(current)
        return previous
    }

    /**
     * Pop the next redo snapshot and push `current` onto the undo stack.
     *
     * @param current - Document state at the moment of redo (pushed to undo).
     * @returns The restored snapshot, or `null` if the redo stack is empty.
     */
    redo(current: HistorySnapshot): HistorySnapshot | null {
        const next = this.redoStack.pop()
        if (!next) return null
        this.undoStack.push(current)
        return next
    }

    /**
     * Remove the most recent undo entry without affecting the redo stack.
     *
     * Useful when a command was pushed optimistically but then failed to apply.
     *
     * @returns The dropped snapshot, or `null` if the undo stack was empty.
     */
    dropLastUndo(): HistorySnapshot | null {
        return this.undoStack.pop() ?? null
    }

    /**
     * Clear both undo and redo stacks.
     */
    clear(): void {
        this.undoStack.length = 0
        this.redoStack.length = 0
    }
}
