import type { Cutout, Mesh, Shape } from '../types/nodes'
import type { Bounds, Vec2 } from '../types/nodes/math'
import { mat4Translate } from '../math'
import { buildBoxMesh } from './box'
import { buildExtrudeMesh, contourToRing } from './extrude'
import { buildCapsuleMesh, buildCylinderMesh, buildSphereMesh } from './primitives'
import { mergeMeshes, transformMesh } from './mesh'
import { buildWallMesh, type WallGap } from './wall'

/**
 * Build mesh for a Shape in local space (origin = host center).
 */
export const buildShapeMesh = (shape: Shape, host: Pick<Bounds, 'width' | 'height' | 'depth'>): Mesh => {
    switch (shape.kind) {
        case 'box':
            return buildBoxMesh(host.width, host.height, host.depth)
        case 'extrude':
            return buildExtrudeMesh(shape.contour, -host.height / 2, host.height / 2)
        case 'wall':
            return buildWallMesh(shape.path, shape.thickness, -host.height / 2, host.height / 2)
        case 'sphere':
            return buildSphereMesh(shape.radius)
        case 'capsule':
            return buildCapsuleMesh(shape.radius, shape.height)
        case 'cylinder':
            return buildCylinderMesh(shape.radius, shape.height ?? host.height)
        case 'mesh':
            return {
                positions: [...shape.mesh.positions],
                indices: shape.mesh.indices ? [...shape.mesh.indices] : undefined,
                normals: shape.mesh.normals ? [...shape.mesh.normals] : undefined,
                uvs: shape.mesh.uvs ? [...shape.mesh.uvs] : undefined,
            }
        case 'csg':
            if (shape.op === 'union') {
                return mergeMeshes([buildShapeMesh(shape.a, host), buildShapeMesh(shape.b, host)])
            }
            // subtract / intersect — host only until real CSG
            return buildShapeMesh(shape.a, host)
        case 'custom':
            return { positions: [], indices: [] }
        default: {
            const _exhaustive: never = shape
            return _exhaustive
        }
    }
}

export const buildCutoutMesh = (cutout: Cutout): Mesh => {
    const shape: Shape = cutout.shape ?? { kind: 'box' }
    const local = buildShapeMesh(shape, cutout)
    return transformMesh(local, mat4Translate(cutout.x, cutout.y, cutout.z))
}

export const cutoutsToWallGaps = (cutouts: Cutout[] | undefined): WallGap[] => {
    if (!cutouts?.length) return []
    return cutouts
        .filter((c) => c.pathOffset != null)
        .map((c) => ({
            from: c.pathOffset!,
            to: c.pathOffset! + c.width,
            yMin: c.y - c.height / 2,
            yMax: c.y + c.height / 2,
        }))
}

/** Hole rings in host XZ for extrude baking. */
export const cutoutToHoleRings = (cutout: Cutout): Vec2[][] => {
    if (cutout.shape?.kind === 'extrude') {
        return [
            contourToRing(cutout.shape.contour).map((p) => ({
                x: p.x + cutout.x,
                z: p.z + cutout.z,
            })),
        ]
    }
    if (cutout.shape?.kind === 'sphere' || cutout.shape?.kind === 'cylinder') {
        const r = cutout.shape.kind === 'sphere' ? cutout.shape.radius : cutout.shape.radius
        const segments = 24
        const ring: Vec2[] = []
        for (let i = 0; i < segments; i++) {
            const t = (i / segments) * Math.PI * 2
            ring.push({
                x: cutout.x + Math.cos(t) * r,
                z: cutout.z + Math.sin(t) * r,
            })
        }
        return [ring]
    }
    // default: AABB rectangle in XZ
    const hx = cutout.width / 2
    const hz = cutout.depth / 2
    return [
        [
            { x: cutout.x - hx, z: cutout.z - hz },
            { x: cutout.x + hx, z: cutout.z - hz },
            { x: cutout.x + hx, z: cutout.z + hz },
            { x: cutout.x - hx, z: cutout.z + hz },
        ],
    ]
}
