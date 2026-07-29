import type { NodeStyle } from '../types/nodes/style'

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
export const mergeStyle = (base: NodeStyle | undefined, patch: Partial<NodeStyle>): NodeStyle => {
    const merged: NodeStyle = { ...(base ?? {}), ...patch }
    if (base?.extras && patch.extras) {
        merged.extras = { ...base.extras, ...patch.extras }
    }
    return merged
}
