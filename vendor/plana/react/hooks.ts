import * as React from 'react'
import type { Command, Document, Selection, World } from '../engine'
import { PlanaContext } from './provider'

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
export function usePlanaDocument(): Document {
    const ctx = React.useContext(PlanaContext)
    if (!ctx) {
        throw new Error('usePlanaDocument must be used within a PlanaProvider')
    }
    return ctx.document
}

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
export function usePlanaWorld(): World {
    const document = usePlanaDocument()
    return React.useSyncExternalStore(
        (onStoreChange) => document.subscribe(() => onStoreChange()),
        () => document.getWorld(),
        () => document.getWorld()
    )
}

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
export function usePlanaSelection(): Selection {
    const document = usePlanaDocument()
    return React.useSyncExternalStore(
        (onStoreChange) => document.subscribe(() => onStoreChange()),
        () => document.getSelection(),
        () => document.getSelection()
    )
}

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
export function usePlanaDispatch(): (command: Command) => void {
    const document = usePlanaDocument()
    return (command: Command) => document.dispatch(command)
}
