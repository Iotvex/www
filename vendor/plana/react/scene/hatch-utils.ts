import type { Bounds, Cutout, Mat4 } from '../../engine'
import { mat4TransformPoint } from '../../engine'
import * as THREE from 'three'

/**
 * Spacing between diagonal hatch lines (meters).
 * Kept sparse — dense elevation hatch was the main FPS killer on flats.
 */
export const HATCH_STEP = 0.75

/** Hatch material opacity relative to edge brightness. */
export const HATCH_EDGE_OPACITY = 0.14

/**
 * When true, hatch every large face (top + elevations).
 * Default false: top / plan faces only — far fewer line segments.
 */
export const HATCH_ELEVATIONS = false

type ElevationRect = { u0: number; u1: number; v0: number; v1: number }

type HatchCutout = Pick<Cutout, 'pathOffset' | 'width' | 'height' | 'y'>

export type HatchSolidInput = {
    bounds: Pick<Bounds, 'width' | 'height' | 'depth'>
    worldMatrix: Mat4
    tag?: string
    cutouts?: HatchCutout[]
    /** Edge / outline hex used as hatch vertex color. */
    edgeColor: string
}

const pushLine = (
    positions: number[],
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number
) => {
    positions.push(ax, ay, az, bx, by, bz)
}

const clipUvDiagonal = (
    u0: number,
    u1: number,
    v0: number,
    v1: number,
    sum: number
): [[number, number], [number, number]] | null => {
    const pts: Array<[number, number]> = []
    const add = (u: number, v: number) => {
        if (u >= u0 - 1e-9 && u <= u1 + 1e-9 && v >= v0 - 1e-9 && v <= v1 + 1e-9) {
            const key = `${u.toFixed(5)},${v.toFixed(5)}`
            if (!pts.some((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}` === key)) {
                pts.push([u, v])
            }
        }
    }

    add(u0, sum - u0)
    add(u1, sum - u1)
    add(sum - v0, v0)
    add(sum - v1, v1)

    if (pts.length < 2) return null
    return [pts[0], pts[pts.length - 1]]
}

const hatchFaceLocal = (
    positions: number[],
    u0: number,
    u1: number,
    v0: number,
    v1: number,
    map: (u: number, v: number) => [number, number, number],
    step: number
) => {
    const lo = Math.min(u0, u1)
    const hi = Math.max(u0, u1)
    const vlo = Math.min(v0, v1)
    const vhi = Math.max(v0, v1)
    if (hi - lo < 1e-6 || vhi - vlo < 1e-6) return

    const kMin = Math.floor((lo + vlo) / step)
    const kMax = Math.ceil((hi + vhi) / step)

    for (let k = kMin; k <= kMax; k++) {
        const seg = clipUvDiagonal(lo, hi, vlo, vhi, k * step)
        if (!seg) continue
        const a = map(seg[0][0], seg[0][1])
        const b = map(seg[1][0], seg[1][1])
        pushLine(positions, a[0], a[1], a[2], b[0], b[1], b[2])
    }
}

/**
 * Solid elevation rectangles (piers + sill + lintel) — plana.d `solidElevationRects`.
 * u ∈ [0, length], v ∈ [0, height] from wall bottom.
 */
const solidElevationRects = (
    length: number,
    height: number,
    wallYMin: number,
    cutouts: HatchCutout[]
): ElevationRect[] => {
    const sorted = [...cutouts]
        .filter((c) => c.pathOffset != null)
        .sort((a, b) => (a.pathOffset ?? 0) - (b.pathOffset ?? 0))

    const rects: ElevationRect[] = []
    let cursor = 0

    for (const cutout of sorted) {
        const offset = cutout.pathOffset ?? 0
        const sill = cutout.y - cutout.height / 2 - wallYMin
        if (offset - cursor > 1e-6) {
            rects.push({ u0: cursor, u1: offset, v0: 0, v1: height })
        }
        if (sill > 1e-6) {
            rects.push({
                u0: offset,
                u1: offset + cutout.width,
                v0: 0,
                v1: Math.min(height, sill),
            })
        }
        const top = sill + cutout.height
        if (height - top > 1e-6) {
            rects.push({
                u0: offset,
                u1: offset + cutout.width,
                v0: Math.max(0, top),
                v1: height,
            })
        }
        cursor = offset + cutout.width
    }

    if (length - cursor > 1e-6) {
        rects.push({ u0: cursor, u1: length, v0: 0, v1: height })
    }

    return rects
}

/** Top face always; optional large side faces unless `tag === 'floor'`. */
const appendHatchBoxLocal = (
    positions: number[],
    bounds: Pick<Bounds, 'width' | 'height' | 'depth'>,
    tag: string | undefined,
    step: number,
    elevations: boolean
) => {
    const hw = bounds.width / 2
    const hh = bounds.height / 2
    const hd = bounds.depth / 2
    const x0 = -hw
    const x1 = hw
    const y0 = -hh
    const y1 = hh
    const z0 = -hd
    const z1 = hd

    hatchFaceLocal(positions, x0, x1, z0, z1, (u, v) => [u, y1, v], step)

    if (!elevations || tag === 'floor') return

    if (bounds.width >= bounds.depth) {
        hatchFaceLocal(positions, x0, x1, y0, y1, (u, v) => [u, v, z1], step)
        hatchFaceLocal(positions, x0, x1, y0, y1, (u, v) => [u, v, z0], step)
    } else {
        hatchFaceLocal(positions, z0, z1, y0, y1, (u, v) => [x1, v, u], step)
        hatchFaceLocal(positions, z0, z1, y0, y1, (u, v) => [x0, v, u], step)
    }
}

/** Continuous wall with openings: full top; optional elevations on solid rects. */
const appendHatchCutoutWallLocal = (
    positions: number[],
    bounds: Pick<Bounds, 'width' | 'height' | 'depth'>,
    cutouts: HatchCutout[],
    step: number,
    elevations: boolean
) => {
    const axis = bounds.width >= bounds.depth ? 'x' : 'z'
    const length = axis === 'x' ? bounds.width : bounds.depth
    const thickness = axis === 'x' ? bounds.depth : bounds.width
    const height = bounds.height
    const hh = height / 2
    const ht = thickness / 2
    const wallYMin = -hh

    if (axis === 'x') {
        const x0 = -length / 2
        const x1 = length / 2
        hatchFaceLocal(positions, x0, x1, -ht, ht, (u, v) => [u, hh, v], step)
    } else {
        const z0 = -length / 2
        const z1 = length / 2
        hatchFaceLocal(positions, -ht, ht, z0, z1, (u, v) => [u, hh, v], step)
    }

    if (!elevations) return

    const rects = solidElevationRects(length, height, wallYMin, cutouts)
    for (const rect of rects) {
        const vA = wallYMin + rect.v0
        const vB = wallYMin + rect.v1
        if (axis === 'x') {
            const xA = -length / 2 + rect.u0
            const xB = -length / 2 + rect.u1
            hatchFaceLocal(positions, xA, xB, vA, vB, (u, v) => [u, v, ht], step)
            hatchFaceLocal(positions, xA, xB, vA, vB, (u, v) => [u, v, -ht], step)
        } else {
            const zA = -length / 2 + rect.u0
            const zB = -length / 2 + rect.u1
            hatchFaceLocal(positions, zA, zB, vA, vB, (u, v) => [ht, v, u], step)
            hatchFaceLocal(positions, zA, zB, vA, vB, (u, v) => [-ht, v, u], step)
        }
    }
}

export type AppendHatchOptions = {
    /** Line spacing in meters. */
    step?: number
    /** Include vertical elevation faces (expensive). Defaults to {@link HATCH_ELEVATIONS}. */
    elevations?: boolean
}

/**
 * Append local-space hatch segments for one solid (mutates `positions`).
 * Walls with path cutouts use elevation-rect hatch when elevations are on.
 */
export const appendHatchLocal = (
    positions: number[],
    bounds: Pick<Bounds, 'width' | 'height' | 'depth'>,
    tag: string | undefined,
    cutouts: HatchCutout[] | undefined,
    stepOrOptions: number | AppendHatchOptions = HATCH_STEP
) => {
    if (bounds.width < 1e-6 || bounds.height < 1e-6 || bounds.depth < 1e-6) return

    const opts: AppendHatchOptions =
        typeof stepOrOptions === 'number' ? { step: stepOrOptions } : stepOrOptions
    const step = opts.step ?? HATCH_STEP
    const elevations = opts.elevations ?? HATCH_ELEVATIONS

    const pathCutouts = (cutouts ?? []).filter((c) => c.pathOffset != null)
    if (tag === 'wall' && pathCutouts.length > 0) {
        appendHatchCutoutWallLocal(positions, bounds, pathCutouts, step, elevations)
        return
    }

    appendHatchBoxLocal(positions, bounds, tag, step, elevations)
}

/**
 * One world-level hatch geometry for all solids (plana.d-style batch).
 * Vertex colors = edge RGB; draw with {@link HATCH_EDGE_OPACITY}.
 */
export const buildWorldHatchGeometry = (
    items: HatchSolidInput[],
    stepOrOptions: number | AppendHatchOptions = HATCH_STEP
): THREE.BufferGeometry => {
    const opts: AppendHatchOptions =
        typeof stepOrOptions === 'number' ? { step: stepOrOptions } : stepOrOptions
    const positions: number[] = []
    const colors: number[] = []
    const color = new THREE.Color()

    for (const item of items) {
        const local: number[] = []
        appendHatchLocal(local, item.bounds, item.tag, item.cutouts, opts)
        if (local.length === 0) continue

        try {
            color.set(item.edgeColor)
        } catch {
            color.set('#a3a3a3')
        }
        const r = color.r
        const g = color.g
        const b = color.b

        for (let i = 0; i < local.length; i += 3) {
            const p = mat4TransformPoint(item.worldMatrix, {
                x: local[i],
                y: local[i + 1],
                z: local[i + 2],
            })
            positions.push(p.x, p.y, p.z)
            colors.push(r, g, b)
        }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return geometry
}

/** @deprecated Prefer {@link buildWorldHatchGeometry}. */
export const buildBatchedHatchGeometry = buildWorldHatchGeometry

/** @deprecated Prefer world batch via {@link buildWorldHatchGeometry}. */
export const buildHatchGeometry = (
    bounds: Pick<Bounds, 'width' | 'height' | 'depth'>,
    worldMatrix: Mat4,
    tag?: string,
    step = HATCH_STEP
): THREE.BufferGeometry => {
    const local: number[] = []
    appendHatchLocal(local, bounds, tag, undefined, step)
    const positions = new Float32Array(local.length)
    for (let i = 0; i < local.length; i += 3) {
        const p = mat4TransformPoint(worldMatrix, {
            x: local[i],
            y: local[i + 1],
            z: local[i + 2],
        })
        positions[i] = p.x
        positions[i + 1] = p.y
        positions[i + 2] = p.z
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geometry
}
