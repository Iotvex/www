import type { FloorPath, Mesh } from '../types/nodes'
import type { Vec2 } from '../types/nodes/math'
import { length2, normalize2, perp2, sub2 } from '../math'
import { computeVertexNormals } from './mesh'

type Polyline = { points: Vec2[]; cum: number[]; total: number }

type Uv = { u: number; v: number }

type ElevationRect = { u0: number; u1: number; v0: number; v1: number }

const flattenPath = (path: FloorPath, arcSegments = 12): Polyline => {
    const points: Vec2[] = [{ ...path.start }]
    let cur = path.start
    for (const seg of path.segments) {
        if (seg.kind === 'line') {
            cur = { ...seg.to }
            points.push(cur)
            continue
        }
        const start = cur
        const end = seg.to
        const bulge = seg.bulge
        const chord = sub2(end, start)
        const chordLen = length2(chord) || 1e-9
        const s = (bulge * chordLen) / 2
        const n = normalize2(perp2(chord))
        for (let i = 1; i <= arcSegments; i++) {
            const t = i / arcSegments
            const mx = start.x + chord.x * t
            const mz = start.z + chord.z * t
            const offset = 4 * s * t * (1 - t)
            points.push({ x: mx + n.x * offset, z: mz + n.z * offset })
        }
        cur = { ...end }
    }
    if (path.closed && points.length > 1) {
        const f = points[0]
        const l = points[points.length - 1]
        if (Math.hypot(f.x - l.x, f.z - l.z) > 1e-6) points.push({ ...f })
    }

    const cum = [0]
    for (let i = 1; i < points.length; i++) {
        cum.push(cum[i - 1] + length2(sub2(points[i], points[i - 1])))
    }
    return { points, cum, total: cum[cum.length - 1] ?? 0 }
}

export type WallGap = {
    /** Along path from start. */
    from: number
    to: number
    /** Opening vertical span in local Y (absolute). */
    yMin: number
    yMax: number
}

const lerp2 = (a: Vec2, b: Vec2, t: number): Vec2 => ({
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
})

/** Centerline point + unit thickness normal at distance `d` along the path. */
const frameAt = (poly: Polyline, d: number): { point: Vec2; normal: Vec2 } => {
    const nSeg = poly.points.length - 1
    if (nSeg < 1) return { point: { ...poly.points[0] }, normal: { x: 0, z: 1 } }

    let i = 0
    while (i < nSeg - 1 && poly.cum[i + 1] < d - 1e-12) i++
    const d0 = poly.cum[i]
    const d1 = poly.cum[i + 1]
    const p0 = poly.points[i]
    const p1 = poly.points[i + 1]
    const span = d1 - d0
    const t = span < 1e-12 ? 0 : (d - d0) / span
    const point = lerp2(p0, p1, Math.min(1, Math.max(0, t)))
    return { point, normal: perp2(normalize2(sub2(p1, p0))) }
}

const uvKey = (u: number, v: number) => `${u.toFixed(6)},${v.toFixed(6)}`

const uniqSorted = (values: number[], eps: number): number[] => {
    const sorted = [...values].sort((a, b) => a - b)
    const out: number[] = []
    for (const v of sorted) {
        if (!out.length || v - out[out.length - 1] > eps) out.push(v)
    }
    return out
}

/**
 * Elevation rectangles that tessellate the solid face.
 * Pier columns are split at adjacent opening heights so opening-edge
 * vertices coincide with hole/notch rings (manifold extrude).
 */
const solidElevationRects = (
    length: number,
    yMin: number,
    yMax: number,
    gaps: WallGap[],
    eps: number
): ElevationRect[] => {
    const sorted = [...gaps].sort((a, b) => a.from - b.from)
    const rects: ElevationRect[] = []

    const pushPier = (u0: number, u1: number, splitYs: number[]) => {
        if (u1 - u0 <= eps) return
        const ys = uniqSorted([yMin, yMax, ...splitYs], eps)
        for (let i = 0; i < ys.length - 1; i++) {
            if (ys[i + 1] - ys[i] > eps) {
                rects.push({ u0, u1, v0: ys[i], v1: ys[i + 1] })
            }
        }
    }

    if (sorted.length === 0) {
        rects.push({ u0: 0, u1: length, v0: yMin, v1: yMax })
        return rects
    }

    let cursor = 0
    const allSplits = sorted.flatMap((g) => [g.yMin, g.yMax])
    for (let gi = 0; gi < sorted.length; gi++) {
        const gap = sorted[gi]
        pushPier(cursor, gap.from, allSplits)

        if (gap.yMin - yMin > eps) {
            // Sill — split horizontally at other openings' u.
            const us = uniqSorted([gap.from, gap.to, ...sorted.flatMap((g) => [g.from, g.to])], eps).filter(
                (u) => u >= gap.from - eps && u <= gap.to + eps
            )
            for (let i = 0; i < us.length - 1; i++) {
                if (us[i + 1] - us[i] > eps) {
                    rects.push({ u0: us[i], u1: us[i + 1], v0: yMin, v1: gap.yMin })
                }
            }
        }
        if (yMax - gap.yMax > eps) {
            const us = uniqSorted([gap.from, gap.to, ...sorted.flatMap((g) => [g.from, g.to])], eps).filter(
                (u) => u >= gap.from - eps && u <= gap.to + eps
            )
            const vs = uniqSorted([gap.yMax, yMax, ...sorted.flatMap((g) => [g.yMin, g.yMax])], eps).filter(
                (v) => v >= gap.yMax - eps && v <= yMax + eps
            )
            for (let i = 0; i < us.length - 1; i++) {
                for (let j = 0; j < vs.length - 1; j++) {
                    if (us[i + 1] - us[i] > eps && vs[j + 1] - vs[j] > eps) {
                        rects.push({ u0: us[i], u1: us[i + 1], v0: vs[j], v1: vs[j + 1] })
                    }
                }
            }
        }
        cursor = gap.to
    }

    pushPier(cursor, length, allSplits)
    return rects
}

type ClampedGap = WallGap & { touchesBottom: boolean; touchesTop: boolean }

/**
 * Outer elevation ring (CCW). Bottom-touching doors become notches.
 * Edges are subdivided at opening u/v so side walls weld to cap tris
 * (EdgesGeometry needs shared silhouette edges).
 */
const buildOuterRing = (length: number, yMin: number, yMax: number, gaps: ClampedGap[], eps: number): Uv[] => {
    const bottomNotches = gaps
        .filter((g) => g.touchesBottom)
        .sort((a, b) => a.from - b.from)

    const usAll = uniqSorted(
        [0, length, ...gaps.flatMap((g) => [g.from, g.to])],
        eps
    )
    const vsAll = uniqSorted(
        [yMin, yMax, ...gaps.flatMap((g) => [g.yMin, g.yMax])],
        eps
    )

    const outer: Uv[] = []

    // Bottom edge (left → right), with door notches rising into the wall.
    let uCursor = 0
    outer.push({ u: 0, v: yMin })
    for (const g of bottomNotches) {
        for (const u of usAll) {
            if (u <= uCursor + eps || u >= g.from - eps) continue
            outer.push({ u, v: yMin })
        }
        if (Math.abs(outer[outer.length - 1].u - g.from) > eps || Math.abs(outer[outer.length - 1].v - yMin) > eps) {
            outer.push({ u: g.from, v: yMin })
        }
        const top = g.touchesTop ? yMax : g.yMax
        // Left jamb bottom → top (subdivide at other openings' heights).
        for (const v of vsAll) {
            if (v <= yMin + eps || v >= top - eps) continue
            outer.push({ u: g.from, v })
        }
        outer.push({ u: g.from, v: top })
        // Lintel of notch left → right.
        for (const u of usAll) {
            if (u <= g.from + eps || u >= g.to - eps) continue
            outer.push({ u, v: top })
        }
        outer.push({ u: g.to, v: top })
        // Right jamb top → bottom.
        for (let i = vsAll.length - 1; i >= 0; i--) {
            const v = vsAll[i]
            if (v >= top - eps || v <= yMin + eps) continue
            outer.push({ u: g.to, v })
        }
        outer.push({ u: g.to, v: yMin })
        uCursor = g.to
    }
    for (const u of usAll) {
        if (u <= uCursor + eps) continue
        outer.push({ u, v: yMin })
    }
    if (Math.abs(outer[outer.length - 1].u - length) > eps || Math.abs(outer[outer.length - 1].v - yMin) > eps) {
        outer.push({ u: length, v: yMin })
    }

    // Right end (bottom → top), subdivided.
    for (const v of vsAll) {
        if (v <= yMin + eps || v >= yMax - eps) continue
        outer.push({ u: length, v })
    }
    outer.push({ u: length, v: yMax })

    // Top edge (right → left), subdivided.
    for (let i = usAll.length - 2; i >= 0; i--) {
        outer.push({ u: usAll[i], v: yMax })
    }
    if (Math.abs(outer[outer.length - 1].u) > eps || Math.abs(outer[outer.length - 1].v - yMax) > eps) {
        outer.push({ u: 0, v: yMax })
    }

    // Left end (top → bottom), subdivided.
    for (let i = vsAll.length - 2; i >= 0; i--) {
        const v = vsAll[i]
        if (v <= yMin + eps) continue
        outer.push({ u: 0, v })
    }

    return outer
}

/** Interior hole rings (CW) — windows / openings that do not touch the floor. */
const buildHoleRings = (gaps: ClampedGap[], allGaps: ClampedGap[], eps: number): Uv[][] => {
    const usAll = uniqSorted(
        allGaps.flatMap((g) => [g.from, g.to]),
        eps
    )
    const vsAll = uniqSorted(
        allGaps.flatMap((g) => [g.yMin, g.yMax]),
        eps
    )

    return gaps
        .filter((g) => !g.touchesBottom && !g.touchesTop)
        .map((g) => {
            const ring: Uv[] = []
            // left bottom → top
            ring.push({ u: g.from, v: g.yMin })
            for (const v of vsAll) {
                if (v <= g.yMin + eps || v >= g.yMax - eps) continue
                ring.push({ u: g.from, v })
            }
            ring.push({ u: g.from, v: g.yMax })
            // top left → right
            for (const u of usAll) {
                if (u <= g.from + eps || u >= g.to - eps) continue
                ring.push({ u, v: g.yMax })
            }
            ring.push({ u: g.to, v: g.yMax })
            // right top → bottom
            for (let i = vsAll.length - 1; i >= 0; i--) {
                const v = vsAll[i]
                if (v >= g.yMax - eps || v <= g.yMin + eps) continue
                ring.push({ u: g.to, v })
            }
            ring.push({ u: g.to, v: g.yMin })
            // bottom right → left
            for (let i = usAll.length - 1; i >= 0; i--) {
                const u = usAll[i]
                if (u >= g.to - eps || u <= g.from + eps) continue
                ring.push({ u, v: g.yMin })
            }
            return ring
        })
}

/**
 * Wall strip along path × thickness × [yMin,yMax] as one extruded prism.
 *
 * Elevation contour (path × height) is extruded by thickness; openings are
 * holes or floor notches — continuous solid like plana.d ExtrudeGeometry.
 * No pier/sill/lintel box seams for EdgesGeometry.
 */
export const buildWallMesh = (
    path: FloorPath,
    thickness: number,
    yMin: number,
    yMax: number,
    gaps: WallGap[] = []
): Mesh => {
    const poly = flattenPath(path)
    if (poly.points.length < 2 || poly.total < 1e-9) return { positions: [], indices: [] }
    if (yMax - yMin < 1e-6) return { positions: [], indices: [] }

    const length = poly.total
    const half = thickness / 2
    const eps = 1e-6

    const clampedGaps: ClampedGap[] = [...gaps]
        .map((g) => {
            const from = Math.max(0, Math.min(length, Math.min(g.from, g.to)))
            const to = Math.max(0, Math.min(length, Math.max(g.from, g.to)))
            const gy0 = Math.max(yMin, Math.min(yMax, Math.min(g.yMin, g.yMax)))
            const gy1 = Math.max(yMin, Math.min(yMax, Math.max(g.yMin, g.yMax)))
            return {
                from,
                to,
                yMin: gy0,
                yMax: gy1,
                touchesBottom: gy0 <= yMin + eps,
                touchesTop: gy1 >= yMax - eps,
            }
        })
        .filter((g) => g.to - g.from > eps && g.yMax - g.yMin > eps)
        .sort((a, b) => a.from - b.from)

    const rects = solidElevationRects(length, yMin, yMax, clampedGaps, eps)
    if (rects.length === 0) return { positions: [], indices: [] }

    const outer = buildOuterRing(length, yMin, yMax, clampedGaps, eps)
    const holes = buildHoleRings(clampedGaps, clampedGaps, eps)

    // Shared UV pool so caps, outer sides, and hole jambs weld into one solid.
    const uvs: Uv[] = []
    const keyToIndex = new Map<string, number>()
    const indexOf = (u: number, v: number): number => {
        const key = uvKey(u, v)
        const existing = keyToIndex.get(key)
        if (existing != null) return existing
        const idx = uvs.length
        keyToIndex.set(key, idx)
        uvs.push({ u, v })
        return idx
    }

    const capTris: number[] = []
    for (const r of rects) {
        const a = indexOf(r.u0, r.v0)
        const b = indexOf(r.u1, r.v0)
        const c = indexOf(r.u1, r.v1)
        const d = indexOf(r.u0, r.v1)
        capTris.push(a, b, c, a, c, d)
    }

    const outerRing = outer.map((p) => indexOf(p.u, p.v))
    const holeRings = holes.map((h) => h.map((p) => indexOf(p.u, p.v)))

    const dedupeRing = (ring: number[]): number[] => {
        const out: number[] = []
        for (const i of ring) {
            if (out.length && out[out.length - 1] === i) continue
            out.push(i)
        }
        if (out.length > 1 && out[0] === out[out.length - 1]) out.pop()
        return out
    }

    const positions: number[] = []
    const indices: number[] = []

    const push3 = (x: number, y: number, z: number) => {
        positions.push(x, y, z)
        return positions.length / 3 - 1
    }

    const frontOf: number[] = []
    const backOf: number[] = []
    for (const { u, v } of uvs) {
        const { point, normal } = frameAt(poly, u)
        frontOf.push(push3(point.x + normal.x * half, v, point.z + normal.z * half))
        backOf.push(push3(point.x - normal.x * half, v, point.z - normal.z * half))
    }

    for (let i = 0; i < capTris.length; i += 3) {
        const a = capTris[i]
        const b = capTris[i + 1]
        const c = capTris[i + 2]
        indices.push(frontOf[a], frontOf[b], frontOf[c])
        indices.push(backOf[a], backOf[c], backOf[b])
    }

    const emitRingSides = (ring: number[], outward: boolean) => {
        const r = dedupeRing(ring)
        if (r.length < 3) return
        for (let i = 0; i < r.length; i++) {
            const a = r[i]
            const b = r[(i + 1) % r.length]
            const f0 = frontOf[a]
            const f1 = frontOf[b]
            const b0 = backOf[a]
            const b1 = backOf[b]
            if (outward) indices.push(f0, b0, b1, f0, b1, f1)
            else indices.push(f0, f1, b1, f0, b1, b0)
        }
    }

    emitRingSides(outerRing, true)
    for (const hole of holeRings) emitRingSides(hole, false)

    return computeVertexNormals({ positions, indices })
}

export { flattenPath }
