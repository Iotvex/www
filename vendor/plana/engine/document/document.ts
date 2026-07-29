import type { World } from '../types/nodes'
import { applyCommand, createEmptyWorld, findNodeById } from '../commands'
import type { Command } from '../commands'
import { createHistorySnapshot, History } from '../history'
import type { Selection } from '../selection'
import { createSelection, emptySelection, selectionEquals } from '../selection'

/**
 * Reason a document listener was notified.
 */
export type DocumentChangeReason = 'dispatch' | 'undo' | 'redo' | 'replaceWorld' | 'setSelection'

/**
 * Payload passed to {@link Document.subscribe} listeners.
 */
export type DocumentChange = {
    /** Current world after the change. */
    world: World
    /** Current selection after the change. */
    selection: Selection
    /** What triggered the notification. */
    reason: DocumentChangeReason
}

/**
 * Listener invoked whenever the document world or selection changes.
 *
 * @param change - Snapshot of the new document state.
 */
export type DocumentListener = (change: DocumentChange) => void

/**
 * Options for {@link createDocument} / {@link Document} construction.
 */
export type DocumentOptions = {
    /** Initial world. Defaults to {@link createEmptyWorld}. */
    world?: World
    /** Initial selection. Defaults to empty. */
    selection?: Selection
    /** Maximum undo stack depth. Defaults to `100`. */
    historyLimit?: number
}

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
export class Document {
    private world: World
    private selection: Selection
    private readonly history: History
    private readonly listeners = new Set<DocumentListener>()

    /**
     * @param options - Initial world, selection, and history limit.
     */
    constructor(options: DocumentOptions = {}) {
        this.world = options.world ?? createEmptyWorld()
        this.selection = options.selection ? createSelection(options.selection.ids) : emptySelection()
        this.history = new History(options.historyLimit ?? 100)
    }

    /**
     * Current world tree (treat as immutable; mutate via {@link Document.dispatch}).
     *
     * @returns The current {@link World}.
     */
    getWorld(): World {
        return this.world
    }

    /**
     * Current selection snapshot.
     *
     * @returns The current {@link Selection}.
     */
    getSelection(): Selection {
        return this.selection
    }

    /**
     * Whether {@link Document.undo} would restore a previous snapshot.
     *
     * @returns `true` when the undo stack is non-empty.
     */
    canUndo(): boolean {
        return this.history.canUndo
    }

    /**
     * Whether {@link Document.redo} would re-apply a undone snapshot.
     *
     * @returns `true` when the redo stack is non-empty.
     */
    canRedo(): boolean {
        return this.history.canRedo
    }

    /**
     * Replace the world, recording history and notifying listeners.
     *
     * @param world - New world tree.
     * @param options - Pass `{ recordHistory: false }` to skip the undo stack (e.g. initial load).
     */
    replaceWorld(world: World, options: { recordHistory?: boolean } = {}): void {
        const recordHistory = options.recordHistory !== false
        if (recordHistory) {
            this.history.push(createHistorySnapshot(this.world, this.selection))
        }
        this.world = world
        this.emit('replaceWorld')
    }

    /**
     * Set the selection without going through {@link Document.dispatch}.
     *
     * Selection-only updates are recorded on the history stack so undo restores
     * the previous selection.
     *
     * @param ids - Node ids to select.
     * @param options - Pass `{ recordHistory: false }` to skip the undo stack.
     */
    setSelection(ids: readonly string[], options: { recordHistory?: boolean } = {}): void {
        const next = createSelection(ids)
        if (selectionEquals(this.selection, next)) return
        const recordHistory = options.recordHistory !== false
        if (recordHistory) {
            this.history.push(createHistorySnapshot(this.world, this.selection))
        }
        this.selection = next
        this.emit('setSelection')
    }

    /**
     * Apply a {@link Command}, push history, and notify subscribers.
     *
     * @param command - Command to apply.
     * @throws {@link import('../errors').ValidationError} On invalid command input.
     * @throws {@link import('../errors').NotFoundError} When a referenced id is missing.
     * @throws {@link import('../errors').CommandError} When the command cannot be applied.
     */
    dispatch(command: Command): void {
        this.history.push(createHistorySnapshot(this.world, this.selection))
        try {
            const result = applyCommand(this.world, command)
            this.world = result.world
            if (result.selectionIds !== undefined) {
                this.selection = createSelection(result.selectionIds)
            }
            this.pruneSelection()
            this.emit('dispatch')
        } catch (error) {
            this.history.dropLastUndo()
            throw error
        }
    }

    /**
     * Restore the previous history snapshot.
     *
     * @returns `true` if a snapshot was restored; otherwise `false`.
     */
    undo(): boolean {
        const restored = this.history.undo(createHistorySnapshot(this.world, this.selection))
        if (!restored) return false
        this.world = restored.world
        this.selection = restored.selection
        this.emit('undo')
        return true
    }

    /**
     * Re-apply the next redo snapshot.
     *
     * @returns `true` if a snapshot was restored; otherwise `false`.
     */
    redo(): boolean {
        const restored = this.history.redo(createHistorySnapshot(this.world, this.selection))
        if (!restored) return false
        this.world = restored.world
        this.selection = restored.selection
        this.emit('redo')
        return true
    }

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
    subscribe(listener: DocumentListener): () => void {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    private pruneSelection(): void {
        const alive = this.selection.ids.filter((id) => findNodeById(this.world, id))
        if (alive.length !== this.selection.ids.length) {
            this.selection = createSelection(alive)
        }
    }

    private emit(reason: DocumentChangeReason): void {
        const change: DocumentChange = {
            world: this.world,
            selection: this.selection,
            reason,
        }
        for (const listener of this.listeners) {
            listener(change)
        }
    }
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
export function createDocument(worldOrOptions?: World | DocumentOptions): Document {
    if (!worldOrOptions) {
        return new Document()
    }
    if ('kind' in worldOrOptions && worldOrOptions.kind === 'world') {
        return new Document({ world: worldOrOptions })
    }
    return new Document(worldOrOptions as DocumentOptions)
}
