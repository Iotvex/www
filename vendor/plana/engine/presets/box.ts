import type { Bounds, IndependentObject, NodeStyle } from '../types/nodes'
import { id } from './id'

/**
 * Options for {@link createBoxObject}.
 */
export type CreateBoxObjectOptions = Partial<Bounds> & {
    /** Node id. Auto-generated when omitted. */
    id?: string
    /** Display name. */
    name?: string
    /** Classification tag. */
    tag?: string
    /** Visual style. */
    style?: NodeStyle
}

/**
 * Create an independent box solid with default wood-like styling.
 *
 * @param options - Bounds, identity, and style overrides.
 * @returns A new {@link IndependentObject} with `shape.kind === 'box'`.
 *
 * @example
 * ```ts
 * const table = createBoxObject({ name: 'Table', width: 1.2, height: 0.75, depth: 0.8 })
 * ```
 */
export const createBoxObject = (options: CreateBoxObjectOptions = {}): IndependentObject => {
    const {
        id: nodeId = id('box'),
        name = 'Box',
        tag = 'furniture',
        style = {
            color: '#b8956a',
            roughness: 0.7,
            metalness: 0.05,
        },
        x = 0,
        y = 0.4,
        z = 0,
        width = 0.8,
        height = 0.8,
        depth = 0.8,
    } = options

    return {
        kind: 'independent',
        id: nodeId,
        name,
        tag,
        style,
        x,
        y,
        z,
        width,
        height,
        depth,
        shape: { kind: 'box' },
    }
}
