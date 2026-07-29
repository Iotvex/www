/**
 * Editor selection: a list of selected node ids.
 *
 * Selection is document-level state (not stored on the {@link World} tree).
 */
export type Selection = Readonly<{
    /** Selected node identifiers (order is preserved for multi-select UX). */
    ids: readonly string[]
}>

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
export const emptySelection = (): Selection => Object.freeze({ ids: Object.freeze([]) })

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
export const createSelection = (ids: readonly string[] = []): Selection => {
    const seen = new Set<string>()
    const unique: string[] = []
    for (const id of ids) {
        if (seen.has(id)) continue
        seen.add(id)
        unique.push(id)
    }
    return Object.freeze({ ids: Object.freeze(unique) })
}

/**
 * Compare two selections for equality (same ids in the same order).
 *
 * @param a - First selection.
 * @param b - Second selection.
 * @returns `true` when both selections list the same ids in order.
 */
export const selectionEquals = (a: Selection, b: Selection): boolean => {
    if (a.ids.length !== b.ids.length) return false
    for (let i = 0; i < a.ids.length; i++) {
        if (a.ids[i] !== b.ids[i]) return false
    }
    return true
}

/**
 * Return whether the selection contains the given id.
 *
 * @param selection - Selection to query.
 * @param id - Node id to look for.
 * @returns `true` if `id` is selected.
 */
export const isSelected = (selection: Selection, id: string): boolean => selection.ids.includes(id)
