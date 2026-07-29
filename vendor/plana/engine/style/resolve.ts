import type { Node } from '../types/nodes'
import type { NodeStyle } from '../types/nodes/style'
import { defaultStyle } from './defaults'
import { mergeStyle } from './merge'

/**
 * Resolved style with all primary fields filled from {@link defaultStyle}.
 */
export type ResolvedNodeStyle = Required<Omit<NodeStyle, 'extras'>> & Pick<NodeStyle, 'extras'>

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
export const resolveStyle = (node: Pick<Node, 'style'> | NodeStyle | undefined): ResolvedNodeStyle => {
    const style = node && 'style' in node ? node.style : (node as NodeStyle | undefined)
    const merged = mergeStyle(defaultStyle, style ?? {})
    return {
        color: merged.color ?? defaultStyle.color,
        accentColor: merged.accentColor ?? defaultStyle.accentColor,
        opacity: merged.opacity ?? defaultStyle.opacity,
        metalness: merged.metalness ?? defaultStyle.metalness,
        roughness: merged.roughness ?? defaultStyle.roughness,
        visible: merged.visible ?? defaultStyle.visible,
        selectable: merged.selectable ?? defaultStyle.selectable,
        outlineColor: merged.outlineColor ?? defaultStyle.outlineColor,
        outlineWidth: merged.outlineWidth ?? defaultStyle.outlineWidth,
        extras: merged.extras,
    }
}
