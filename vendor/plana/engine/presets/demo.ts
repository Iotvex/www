import type { World } from '../types/nodes'
import { createBoxObject } from './box'
import { id } from './id'
import { createRoomApartment } from './room'

/**
 * Build a starter apartment world for the interactive editor.
 *
 * Includes a furnished rectangular room (walls, floor, table, sofa, rug).
 *
 * @returns A complete {@link World} ready for {@link createDocument}.
 *
 * @example
 * ```ts
 * const doc = createDocument({ world: createDemoWorld() })
 * ```
 */
export const createDemoWorld = (): World => {
    const apartment = createRoomApartment({
        id: 'apt-demo',
        name: 'Studio loft',
        width: 6,
        depth: 4.5,
        height: 2.7,
        wallThickness: 0.18,
    })

    const zone = apartment.children[0]
    if (zone && zone.kind === 'zone') {
        const table = createBoxObject({
            id: id('table'),
            name: 'Dining table',
            tag: 'furniture',
            x: -1.2,
            y: 0.4,
            z: 0.3,
            width: 1.4,
            height: 0.75,
            depth: 0.85,
            style: {
                color: '#6b4f3a',
                roughness: 0.55,
                metalness: 0.08,
            },
        })

        const sofa = createBoxObject({
            id: id('sofa'),
            name: 'Sofa',
            tag: 'furniture',
            x: 1.5,
            y: 0.4,
            z: -0.8,
            width: 2.0,
            height: 0.75,
            depth: 0.9,
            style: {
                color: '#4a5d4e',
                roughness: 0.8,
                metalness: 0.02,
                accentColor: '#2f3d32',
            },
        })

        const rug = createBoxObject({
            id: id('rug'),
            name: 'Rug',
            tag: 'decor',
            x: 0.4,
            y: 0.12,
            z: 0.2,
            width: 2.4,
            height: 0.04,
            depth: 1.6,
            style: {
                color: '#a65d3f',
                roughness: 0.95,
                metalness: 0,
            },
        })

        const lamp = createBoxObject({
            id: id('lamp'),
            name: 'Floor lamp',
            tag: 'furniture',
            x: 2.4,
            y: 0.85,
            z: 1.4,
            width: 0.25,
            height: 1.6,
            depth: 0.25,
            style: {
                color: '#c9b896',
                roughness: 0.4,
                metalness: 0.35,
                accentColor: '#f0e6c8',
            },
        })

        zone.children = [...zone.children, table, sofa, rug, lamp]
    }

    return {
        kind: 'world',
        id: 'world-demo',
        name: 'Demo apartment',
        x: 0,
        y: 0,
        z: 0,
        width: 6,
        height: 2.7,
        depth: 4.5,
        children: [apartment],
    }
}
