import type { ReactNode } from 'react'
import * as React from 'react'
import type { Document, World } from '../engine'
import { createDocument } from '../engine'

/**
 * React context value for a Plana {@link Document}.
 */
export type PlanaContextValue = {
    /** Shared document instance for the subtree. */
    document: Document
}

/**
 * Context holding the active {@link Document}. Prefer the hooks in `./hooks`.
 */
export const PlanaContext = React.createContext<PlanaContextValue | null>(null)

/**
 * Props for {@link PlanaProvider}.
 */
export type PlanaProviderProps = {
    /**
     * Existing document to provide. When omitted, a document is created from
     * {@link PlanaProviderProps.world} (or an empty world).
     */
    document?: Document
    /** Initial world used only when `document` is not passed (first mount). */
    world?: World
    /** React children that may call Plana hooks. */
    children: ReactNode
}

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
export function PlanaProvider(props: PlanaProviderProps) {
    const { document: documentProp, world, children } = props
    const [owned] = React.useState(() => createDocument(world ? { world } : undefined))
    const document = documentProp ?? owned
    const value = React.useMemo(() => ({ document }), [document])
    return <PlanaContext.Provider value={value}>{children}</PlanaContext.Provider>
}
