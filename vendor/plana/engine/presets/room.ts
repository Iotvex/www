import type { Apartment, IndependentObject, Zone } from '../types/nodes'
import { createBoxObject } from './box'
import { id } from './id'
import { createWallObject } from './wall'

/**
 * Options for {@link createRoomApartment}.
 */
export type CreateRoomApartmentOptions = {
    /** Interior width along X (meters). */
    width?: number
    /** Interior depth along Z (meters). */
    depth?: number
    /** Wall / room height (meters). */
    height?: number
    /** Wall thickness (meters). */
    wallThickness?: number
    /** Apartment node id. */
    id?: string
    /** Apartment display name. */
    name?: string
}

/**
 * Create a rectangular room apartment with four walls and a floor slab.
 *
 * @param options - Room dimensions and wall thickness.
 * @returns An {@link Apartment} containing a zone with walls + floor.
 *
 * @example
 * ```ts
 * const apt = createRoomApartment({ width: 5, depth: 4, height: 2.7 })
 * ```
 */
export const createRoomApartment = (options: CreateRoomApartmentOptions = {}): Apartment => {
    const { width = 5, depth = 4, height = 2.7, wallThickness = 0.2, id: aptId = id('apt'), name = 'Room' } = options

    const halfW = width / 2
    const halfD = depth / 2
    const wallY = height / 2

    const north = createWallObject({
        id: id('wall'),
        name: 'North wall',
        length: width,
        height,
        thickness: wallThickness,
        x: 0,
        y: wallY,
        z: -halfD,
        path: {
            start: { x: -halfW, z: 0 },
            segments: [{ kind: 'line', to: { x: halfW, z: 0 } }],
        },
    })

    const south = createWallObject({
        id: id('wall'),
        name: 'South wall',
        length: width,
        height,
        thickness: wallThickness,
        x: 0,
        y: wallY,
        z: halfD,
        path: {
            start: { x: -halfW, z: 0 },
            segments: [{ kind: 'line', to: { x: halfW, z: 0 } }],
        },
    })

    const west = createWallObject({
        id: id('wall'),
        name: 'West wall',
        length: depth,
        height,
        thickness: wallThickness,
        x: -halfW,
        y: wallY,
        z: 0,
        path: {
            start: { x: 0, z: -halfD },
            segments: [{ kind: 'line', to: { x: 0, z: halfD } }],
        },
    })

    const east = createWallObject({
        id: id('wall'),
        name: 'East wall',
        length: depth,
        height,
        thickness: wallThickness,
        x: halfW,
        y: wallY,
        z: 0,
        path: {
            start: { x: 0, z: -halfD },
            segments: [{ kind: 'line', to: { x: 0, z: halfD } }],
        },
    })

    const floor: IndependentObject = createBoxObject({
        id: id('floor'),
        name: 'Floor',
        tag: 'floor',
        x: 0,
        y: 0.05,
        z: 0,
        width,
        height: 0.1,
        depth,
        style: {
            color: '#8b7355',
            roughness: 0.9,
            metalness: 0.02,
        },
    })

    const zone: Zone = {
        kind: 'zone',
        id: id('zone'),
        name: 'Main',
        tag: 'room',
        x: 0,
        y: 0,
        z: 0,
        width,
        height,
        depth,
        children: [floor, north, south, west, east],
    }

    return {
        kind: 'apartment',
        id: aptId,
        name,
        tag: 'apartment',
        x: 0,
        y: 0,
        z: 0,
        width,
        height,
        depth,
        children: [zone],
    }
}
