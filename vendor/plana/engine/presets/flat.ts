/**
 * Real apartment layout (~33 m²): corridor, bath, kitchen, living,
 * solid walls with door/window cutouts, 5×5 shelving and end mirrors.
 *
 * Coordinates match the original plan (meters, X east, Z south, Y up).
 *
 * @packageDocumentation
 */

import type {
    Apartment,
    CompositeObject,
    Cutout,
    Group,
    IndependentObject,
    NodeStyle,
    World,
    Zone,
} from '../types/nodes'
import { id } from './id'

const WALL_H = 2.47
const WALL_T = 0.15
const FLOOR_T = 0.08
const FLOOR_TOP = FLOOR_T
const OUTER_W = 6.42
const OUTER_D = 5.935
const DEFAULT_DOOR_W = 0.8
const DEFAULT_DOOR_H = 2.04

const STYLE_FLOOR: NodeStyle = {
    color: '#020617',
    opacity: 0.45,
    outlineColor: '#64748b',
}
const STYLE_WALL: NodeStyle = {
    color: '#09090b',
    opacity: 0.25,
    outlineColor: '#e2e8f0',
}
const STYLE_DOOR: NodeStyle = {
    color: '#1c1917',
    opacity: 0.3,
    outlineColor: '#f59e0b',
}
const STYLE_WINDOW: NodeStyle = {
    color: '#083344',
    opacity: 0.28,
    outlineColor: '#22d3ee',
}
const STYLE_MIRROR: NodeStyle = {
    color: '#083344',
    opacity: 0.32,
    outlineColor: '#22d3ee',
}
const STYLE_FURNITURE: NodeStyle = {
    color: '#1c1917',
    opacity: 0.35,
    outlineColor: '#d6d3d1',
}

const objectCenterY = (height: number, bottom = FLOOR_TOP) => bottom + height / 2

type WallAlong = 'x' | 'z'

type WallSpec = {
    id: string
    name: string
    along: WallAlong
    origin: number
    position: number
    length: number
    cutouts?: Array<{
        kind: 'door' | 'window'
        offset: number
        width: number
        height: number
        sill?: number
    }>
}

/**
 * Convert a plan wall segment into an independent wall solid with path cutouts.
 *
 * @param spec - Centerline wall definition from the flat plan.
 * @returns Wall {@link IndependentObject} in apartment space.
 */
const wallFromSpec = (spec: WallSpec): IndependentObject => {
    const { along, origin, position, length, cutouts = [] } = spec
    const cx = along === 'x' ? origin + length / 2 : position
    const cz = along === 'z' ? origin + length / 2 : position

    const path =
        along === 'x'
            ? {
                  start: { x: -length / 2, z: 0 },
                  segments: [{ kind: 'line' as const, to: { x: length / 2, z: 0 } }],
              }
            : {
                  start: { x: 0, z: -length / 2 },
                  segments: [{ kind: 'line' as const, to: { x: 0, z: length / 2 } }],
              }

    const baked: Cutout[] = cutouts.map((c, i) => {
        const bottom = c.kind === 'window' ? (c.sill ?? 0.8) : 0
        const yLocal = -WALL_H / 2 + bottom + c.height / 2
        return {
            id: `${spec.id}-cut-${i}`,
            name: c.kind === 'door' ? 'Door' : 'Window',
            pathOffset: c.offset,
            x: 0,
            y: yLocal,
            z: 0,
            width: c.width,
            height: c.height,
            depth: WALL_T + 0.02,
        }
    })

    return {
        kind: 'independent',
        id: spec.id,
        name: spec.name,
        tag: 'wall',
        style: STYLE_WALL,
        x: cx,
        y: objectCenterY(WALL_H),
        z: cz,
        width: along === 'x' ? length : WALL_T,
        height: WALL_H,
        depth: along === 'z' ? length : WALL_T,
        shape: {
            kind: 'wall',
            thickness: WALL_T,
            path,
        },
        cutouts: baked.length ? baked : undefined,
    }
}

type OpeningAlong = WallAlong

type DoorSpec = {
    id: string
    name: string
    x: number
    z: number
    along: OpeningAlong
    width?: number
    height?: number
}

type WindowSpec = {
    id: string
    name: string
    x: number
    z: number
    along: OpeningAlong
    width: number
    height: number
    sill: number
}

/**
 * Solid fill box for a door opening (apartment absolute space).
 */
const doorFill = (spec: DoorSpec): IndependentObject => {
    const width = spec.width ?? DEFAULT_DOOR_W
    const height = spec.height ?? DEFAULT_DOOR_H
    return {
        kind: 'independent',
        id: spec.id,
        name: spec.name,
        tag: 'door',
        style: STYLE_DOOR,
        x: spec.x,
        y: objectCenterY(height),
        z: spec.z,
        width: spec.along === 'x' ? width : WALL_T,
        height,
        depth: spec.along === 'z' ? width : WALL_T,
        shape: { kind: 'box' },
    }
}

/**
 * Solid fill box for a window opening (apartment absolute space).
 */
const windowFill = (spec: WindowSpec): IndependentObject => {
    const bottom = FLOOR_TOP + spec.sill
    return {
        kind: 'independent',
        id: spec.id,
        name: spec.name,
        tag: 'window',
        style: STYLE_WINDOW,
        x: spec.x,
        y: objectCenterY(spec.height, bottom),
        z: spec.z,
        width: spec.along === 'x' ? spec.width : WALL_T,
        height: spec.height,
        depth: spec.along === 'z' ? spec.width : WALL_T,
        shape: { kind: 'box' },
    }
}

/**
 * Thin floor slab centered on a clear room rectangle.
 *
 * @param opts - Identity and plan rectangle (x0/z0 = NW corner).
 * @returns Floor box solid.
 */
const floorSlab = (opts: {
    id: string
    name: string
    x0: number
    z0: number
    width: number
    depth: number
}): IndependentObject => ({
    kind: 'independent',
    id: opts.id,
    name: opts.name,
    tag: 'floor',
    style: STYLE_FLOOR,
    x: opts.x0 + opts.width / 2,
    y: FLOOR_T / 2,
    z: opts.z0 + opts.depth / 2,
    width: opts.width,
    height: FLOOR_T,
    depth: opts.depth,
    shape: { kind: 'box' },
})

const SHELF_OUTER = 0.05
const SHELF_INNER = 0.016
const SHELF_CELL = 0.36
const SHELF_DEPTH = 0.392
const SHELF_COLS = 5
const SHELF_ROWS = 5
const SHELF_SPAN = SHELF_OUTER * 2 + SHELF_INNER * (SHELF_COLS - 1) + SHELF_CELL * SHELF_COLS

const MIRROR_THICK = 0.004
const MIRROR_W = 0.37
const MIRROR_LOWER_H = 0.37
const MIRROR_UPPER_H = 0.9
const MIRROR_LOWER_FROM_FLOOR = 0.27
const MIRROR_GAP = 0.21

/**
 * Build the living-room 5×5 shelving unit with two end mirrors.
 *
 * @param xWest - West face X of the carcass.
 * @param zNorth - North face Z of the carcass.
 * @returns Composite object (boards + mirrors) in apartment space.
 */
const buildLivingShelving = (xWest: number, zNorth: number): CompositeObject => {
    const depth = SHELF_DEPTH
    const span = SHELF_SPAN
    const xCenter = xWest + depth / 2
    const zCenter = zNorth + span / 2
    const y0 = FLOOR_TOP
    const parts: IndependentObject[] = []

    const pushBoard = (
        name: string,
        cx: number,
        cy: number,
        cz: number,
        width: number,
        height: number,
        depthBoard: number,
        style: NodeStyle = STYLE_FURNITURE,
        tag = 'furniture'
    ) => {
        parts.push({
            kind: 'independent',
            id: id('shelf-part'),
            name,
            tag,
            style,
            // Local to composite center
            x: cx - xCenter,
            y: cy - (y0 + span / 2),
            z: cz - zCenter,
            width,
            height,
            depth: depthBoard,
            shape: { kind: 'box' },
        })
    }

    const horiz: Array<{ bottom: number; thick: number; label: string }> = [
        { bottom: y0, thick: SHELF_OUTER, label: 'полка низ 50' },
    ]
    let yCursor = y0 + SHELF_OUTER
    for (let row = 0; row < SHELF_ROWS - 1; row++) {
        yCursor += SHELF_CELL
        horiz.push({ bottom: yCursor, thick: SHELF_INNER, label: `полка 16 #${row + 1}` })
        yCursor += SHELF_INNER
    }
    yCursor += SHELF_CELL
    horiz.push({ bottom: yCursor, thick: SHELF_OUTER, label: 'полка верх 50' })

    for (const h of horiz) {
        pushBoard(h.label, xCenter, h.bottom + h.thick / 2, zCenter, depth, h.thick, span)
    }

    const sideHeight = span - 2 * SHELF_OUTER
    const sideCy = y0 + SHELF_OUTER + sideHeight / 2
    pushBoard('стойка 50 север', xCenter, sideCy, zNorth + SHELF_OUTER / 2, depth, sideHeight, SHELF_OUTER)
    pushBoard('стойка 50 юг', xCenter, sideCy, zNorth + span - SHELF_OUTER / 2, depth, sideHeight, SHELF_OUTER)

    for (let row = 0; row < SHELF_ROWS; row++) {
        const cellY0 = y0 + SHELF_OUTER + row * (SHELF_CELL + SHELF_INNER)
        const cy = cellY0 + SHELF_CELL / 2
        for (let col = 0; col < SHELF_COLS - 1; col++) {
            const zBoard = zNorth + SHELF_OUTER + (col + 1) * SHELF_CELL + col * SHELF_INNER
            pushBoard(
                `стойка 16 r${row + 1}c${col + 1}`,
                xCenter,
                cy,
                zBoard + SHELF_INNER / 2,
                depth,
                SHELF_CELL,
                SHELF_INNER
            )
        }
    }

    const zSouthFace = zNorth + span
    const mirrorCz = zSouthFace + MIRROR_THICK / 2
    const lowerBottom = y0 + MIRROR_LOWER_FROM_FLOOR
    const upperBottom = lowerBottom + MIRROR_LOWER_H + MIRROR_GAP
    pushBoard(
        'зеркало нижнее',
        xCenter,
        lowerBottom + MIRROR_LOWER_H / 2,
        mirrorCz,
        MIRROR_W,
        MIRROR_LOWER_H,
        MIRROR_THICK,
        STYLE_MIRROR,
        'mirror'
    )
    pushBoard(
        'зеркало верхнее',
        xCenter,
        upperBottom + MIRROR_UPPER_H / 2,
        mirrorCz,
        MIRROR_W,
        MIRROR_UPPER_H,
        MIRROR_THICK,
        STYLE_MIRROR,
        'mirror'
    )

    return {
        kind: 'composite',
        id: 'furniture-shelving-living',
        name: 'стеллаж гостиная',
        tag: 'furniture',
        style: STYLE_FURNITURE,
        x: xCenter,
        y: y0 + span / 2,
        z: zCenter,
        width: depth,
        height: span,
        depth: span,
        objects: parts,
    }
}

const WALLS: WallSpec[] = [
    { id: 'wall-north', name: 'Север', along: 'x', origin: 0, position: 0.075, length: 6.42 },
    { id: 'wall-south', name: 'Юг', along: 'x', origin: 0, position: 5.86, length: 6.42 },
    {
        id: 'wall-west-north',
        name: 'Запад (коридор)',
        along: 'z',
        origin: 0,
        position: 0.075,
        length: 2.53,
        cutouts: [{ kind: 'door', offset: 1.23, width: 0.8, height: 2.04 }],
    },
    {
        id: 'wall-west-living',
        name: 'Запад (гостиная)',
        along: 'z',
        origin: 2.53,
        position: 0.075,
        length: 3.405,
    },
    {
        id: 'wall-east-kitchen',
        name: 'Восток (кухня)',
        along: 'z',
        origin: 0,
        position: 6.345,
        length: 2.53,
        cutouts: [{ kind: 'window', offset: 0.29, width: 1.32, height: 1.46, sill: 0.8 }],
    },
    {
        id: 'wall-east-living',
        name: 'Восток (гостиная)',
        along: 'z',
        origin: 2.53,
        position: 6.345,
        length: 3.405,
        cutouts: [
            { kind: 'window', offset: 0.585, width: 1.4, height: 1.46, sill: 0.8 },
            { kind: 'door', offset: 1.985, width: 0.7, height: 2.26 },
        ],
    },
    {
        id: 'wall-bath-west',
        name: 'С/у запад',
        along: 'z',
        origin: 0,
        position: 1.46,
        length: 1.41,
    },
    {
        id: 'wall-bath-east',
        name: 'С/у восток',
        along: 'z',
        origin: 0,
        position: 3.78,
        length: 1.41,
    },
    {
        id: 'wall-bath-south',
        name: 'С/у юг',
        along: 'x',
        origin: 1.385,
        position: 1.335,
        length: 2.47,
        cutouts: [{ kind: 'door', offset: 0.88, width: 0.8, height: 2.04 }],
    },
    {
        id: 'wall-partition',
        name: 'Перегородка',
        along: 'x',
        origin: 0,
        position: 2.53,
        length: 6.42,
        cutouts: [{ kind: 'door', offset: 0.575, width: 0.84, height: 2.04 }],
    },
]

/** Door fill centers from the original apartment plan (absolute space). */
const DOORS: DoorSpec[] = [
    { id: 'door-entry', name: 'дверь', x: 0.075, z: 1.63, along: 'z' },
    { id: 'door-partition', name: 'дверь', x: 0.995, z: 2.53, along: 'x', width: 0.84, height: 2.04 },
    { id: 'door-bath', name: 'дверь', x: 2.665, z: 1.335, along: 'x', width: 0.8, height: 2.04 },
    { id: 'door-living-east', name: 'дверь', x: 6.345, z: 4.865, along: 'z', width: 0.7, height: 2.26 },
]

/** Window fill centers from the original apartment plan (absolute space). */
const WINDOWS: WindowSpec[] = [
    {
        id: 'window-kitchen',
        name: 'окно',
        x: 6.345,
        z: 0.95,
        along: 'z',
        width: 1.32,
        height: 1.46,
        sill: 0.8,
    },
    {
        id: 'window-living',
        name: 'окно',
        x: 6.345,
        z: 3.815,
        along: 'z',
        width: 1.4,
        height: 1.46,
        sill: 0.8,
    },
]

/**
 * Build the real ~33 m² apartment as a Plana {@link World}.
 *
 * Layout: L-corridor, bath, kitchen, living with 5×5 shelving and mirrors.
 * Clear footprint ≈ 6.12 × 5.485 m; outer AABB 6.42 × 5.935 m; wall height 2.47 m.
 *
 * @returns World ready for {@link createDocument} or {@link PlanaEditor}.
 *
 * @example
 * ```ts
 * import { createDocument, createFlatWorld } from 'plana'
 *
 * const doc = createDocument({ world: createFlatWorld() })
 * ```
 */
export const createFlatWorld = (): World => {
    const walls = WALLS.map(wallFromSpec)
    const openings = [...DOORS.map(doorFill), ...WINDOWS.map(windowFill)]

    const floorCorridorA = floorSlab({
        id: 'floor-corridor-a',
        name: 'Пол коридор',
        x0: 0.15,
        z0: 0.15,
        width: 1.235,
        depth: 2.305,
    })
    const floorCorridorB = floorSlab({
        id: 'floor-corridor-b',
        name: 'Пол коридор (рукав)',
        x0: 1.385,
        z0: 1.41,
        width: 2.47,
        depth: 1.045,
    })
    const floorBath = floorSlab({
        id: 'floor-bath',
        name: 'Пол с/у',
        x0: 1.535,
        z0: 0.15,
        width: 2.17,
        depth: 1.11,
    })
    const floorKitchen = floorSlab({
        id: 'floor-kitchen',
        name: 'Пол кухня',
        x0: 3.855,
        z0: 0.15,
        width: 2.415,
        depth: 2.305,
    })
    const floorLiving = floorSlab({
        id: 'floor-living',
        name: 'Пол гостиная',
        x0: 0.15,
        z0: 2.605,
        width: 6.12,
        depth: 3.18,
    })

    const shelving = buildLivingShelving(3.633, 2.605)

    const zoneCorridor = zoneWithLocalChildren(
        {
            kind: 'zone',
            id: 'zone-corridor',
            name: 'Коридор',
            tag: 'room',
            x: 0.15 + 1.235 / 2,
            y: 0,
            z: 0.15 + 2.305 / 2,
            width: 1.235,
            height: WALL_H,
            depth: 2.305,
            footprint: {
                kind: 'polygon',
                points: [
                    { x: -1.235 / 2, z: -2.305 / 2 },
                    { x: 1.235 / 2, z: -2.305 / 2 },
                    { x: 1.235 / 2, z: 2.305 / 2 },
                    { x: -1.235 / 2, z: 2.305 / 2 },
                ],
            },
            children: [],
        },
        [floorCorridorA, floorCorridorB]
    )

    const zoneBath = zoneWithLocalChildren(
        {
            kind: 'zone',
            id: 'zone-bath',
            name: 'Сан-узел',
            tag: 'room',
            x: 1.535 + 2.17 / 2,
            y: 0,
            z: 0.15 + 1.11 / 2,
            width: 2.17,
            height: WALL_H,
            depth: 1.11,
            children: [],
        },
        [floorBath]
    )

    const zoneKitchen = zoneWithLocalChildren(
        {
            kind: 'zone',
            id: 'zone-kitchen',
            name: 'Кухня',
            tag: 'room',
            x: 3.855 + 2.415 / 2,
            y: 0,
            z: 0.15 + 2.305 / 2,
            width: 2.415,
            height: WALL_H,
            depth: 2.305,
            children: [],
        },
        [floorKitchen]
    )

    const zoneLiving = zoneWithLocalChildren(
        {
            kind: 'zone',
            id: 'zone-living',
            name: 'Гостиная',
            tag: 'room',
            x: 0.15 + 6.12 / 2,
            y: 0,
            z: 2.605 + 3.18 / 2,
            width: 6.12,
            height: WALL_H,
            depth: 3.18,
            children: [],
        },
        [floorLiving, shelving]
    )

    const aptX = OUTER_W / 2
    const aptZ = OUTER_D / 2

    const apartment: Apartment = {
        kind: 'apartment',
        id: 'apt-flat',
        name: 'Квартира',
        tag: 'apartment',
        x: aptX,
        y: 0,
        z: aptZ,
        width: OUTER_W,
        height: WALL_H + FLOOR_TOP,
        depth: OUTER_D,
        footprint: {
            kind: 'polygon',
            points: [
                { x: -OUTER_W / 2, z: -OUTER_D / 2 },
                { x: OUTER_W / 2, z: -OUTER_D / 2 },
                { x: OUTER_W / 2, z: OUTER_D / 2 },
                { x: -OUTER_W / 2, z: OUTER_D / 2 },
            ],
        },
        children: [
            {
                kind: 'group',
                id: 'group-walls',
                name: 'Стены',
                tag: 'walls',
                style: STYLE_WALL,
                x: 0,
                y: 0,
                z: 0,
                width: OUTER_W,
                height: WALL_H + FLOOR_TOP,
                depth: OUTER_D,
                children: walls.map((w) => toParentLocal(w, aptX, aptZ)),
            } satisfies Group,
            {
                kind: 'group',
                id: 'group-openings',
                name: 'Проёмы',
                tag: 'openings',
                x: 0,
                y: 0,
                z: 0,
                width: OUTER_W,
                height: WALL_H + FLOOR_TOP,
                depth: OUTER_D,
                children: openings.map((o) => toParentLocal(o, aptX, aptZ)),
            } satisfies Group,
            toParentLocal(zoneCorridor, aptX, aptZ),
            toParentLocal(zoneBath, aptX, aptZ),
            toParentLocal(zoneKitchen, aptX, aptZ),
            toParentLocal(zoneLiving, aptX, aptZ),
        ],
    }

    return {
        kind: 'world',
        id: 'world-flat',
        name: 'Квартира (~33 м²)',
        x: 0,
        y: 0,
        z: 0,
        width: OUTER_W,
        height: WALL_H + FLOOR_TOP,
        depth: OUTER_D,
        children: [apartment],
    }
}

type PlanChild = IndependentObject | CompositeObject

/**
 * Re-express absolute plan children in a zone's local space.
 *
 * @param zone - Zone whose `x`/`z` are in plan/apartment space.
 * @param children - Children still in absolute plan coordinates.
 * @returns Zone with children translated into zone-local space.
 */
const zoneWithLocalChildren = (zone: Zone, children: PlanChild[]): Zone => ({
    ...zone,
    children: children.map((c) => toParentLocal(c, zone.x, zone.z)),
})

/**
 * Translate a node from absolute plan space into a parent's local XZ.
 *
 * @param node - Node with absolute `x`/`z`.
 * @param parentX - Parent center X in the same absolute space.
 * @param parentZ - Parent center Z in the same absolute space.
 * @returns Cloned node with local `x`/`z`.
 */
const toParentLocal = <T extends { x: number; z: number }>(node: T, parentX: number, parentZ: number): T => ({
    ...node,
    x: node.x - parentX,
    z: node.z - parentZ,
})
