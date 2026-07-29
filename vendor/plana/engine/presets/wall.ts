import type { FloorPath, IndependentObject, NodeStyle } from '../types/nodes'
import { id } from './id'

/**
 * Options for {@link createWallObject}.
 */
export type CreateWallObjectOptions = {
    /** Node id. Auto-generated when omitted. */
    id?: string
    /** Display name. */
    name?: string
    /** Classification tag. */
    tag?: string
    /** Visual style. */
    style?: NodeStyle
    /** Wall center X in parent space. */
    x?: number
    /** Wall center Y (typically half height). */
    y?: number
    /** Wall center Z in parent space. */
    z?: number
    /** Wall height in meters. */
    height?: number
    /** Wall thickness in meters. */
    thickness?: number
    /**
     * Floor path in wall-local XZ. When omitted, a straight wall along +X
     * of length `length` is created.
     */
    path?: FloorPath
    /** Length used when `path` is omitted. */
    length?: number
}

/**
 * Create an independent wall solid along a floor path.
 *
 * @param options - Path / length, thickness, height, and style.
 * @returns A new {@link IndependentObject} with `shape.kind === 'wall'`.
 *
 * @example
 * ```ts
 * const wall = createWallObject({ length: 4, height: 2.7, thickness: 0.2 })
 * ```
 */
export const createWallObject = (options: CreateWallObjectOptions = {}): IndependentObject => {
    const {
        id: nodeId = id('wall'),
        name = 'Wall',
        tag = 'wall',
        style = {
            color: '#d8cfc4',
            roughness: 0.85,
            metalness: 0.02,
        },
        thickness = 0.2,
        height = 2.7,
        length = 4,
        path = {
            start: { x: -length / 2, z: 0 },
            segments: [{ kind: 'line', to: { x: length / 2, z: 0 } }],
        },
        x = 0,
        y = height / 2,
        z = 0,
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
        width: Math.max(length, thickness),
        height,
        depth: Math.max(thickness, 0.05),
        shape: {
            kind: 'wall',
            thickness,
            path,
        },
    }
}
