import type { NodeStyle } from '../types/nodes/style'

/**
 * Library default style applied when a node has no (or partial) style.
 */
export const defaultStyle: Readonly<Required<Omit<NodeStyle, 'extras'>> & Pick<NodeStyle, 'extras'>> = {
    color: '#c4a574',
    accentColor: '#8b6914',
    opacity: 1,
    metalness: 0.05,
    roughness: 0.75,
    visible: true,
    selectable: true,
    outlineColor: '#2a241c',
    outlineWidth: 0.01,
    extras: undefined,
}
