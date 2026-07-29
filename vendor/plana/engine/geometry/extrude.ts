import type { Contour } from '../types/nodes'
import type { Mesh } from '../types/nodes'
import type { Vec2 } from '../types/nodes/math'
import { computeVertexNormals } from './mesh'

/** Ear-clip triangulation for a simple polygon in XZ (y ignored). CCW or CW. */
const earclip = (ring: Vec2[]): number[] => {
    const n = ring.length
    if (n < 3) return []
    if (n === 3) return [0, 1, 2]

    const idx = ring.map((_, i) => i)
    const area = () => {
        let a = 0
        for (let i = 0; i < ring.length; i++) {
            const p = ring[i]
            const q = ring[(i + 1) % ring.length]
            a += p.x * q.z - q.x * p.z
        }
        return a
    }
    const sign = area() >= 0 ? 1 : -1

    const isEar = (i0: number, i1: number, i2: number, rest: number[]) => {
        const a = ring[i0]
        const b = ring[i1]
        const c = ring[i2]
        const cross = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
        if (cross * sign <= 1e-12) return false
        for (const i of rest) {
            if (i === i0 || i === i1 || i === i2) continue
            const p = ring[i]
            const d1 = (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)
            const d2 = (c.x - b.x) * (p.z - b.z) - (c.z - b.z) * (p.x - b.x)
            const d3 = (a.x - c.x) * (p.z - c.z) - (a.z - c.z) * (p.x - c.x)
            if (d1 * sign >= -1e-12 && d2 * sign >= -1e-12 && d3 * sign >= -1e-12) return false
        }
        return true
    }

    const tris: number[] = []
    let guard = 0
    while (idx.length > 3 && guard++ < 10_000) {
        let clipped = false
        for (let i = 0; i < idx.length; i++) {
            const i0 = idx[(i + idx.length - 1) % idx.length]
            const i1 = idx[i]
            const i2 = idx[(i + 1) % idx.length]
            if (!isEar(i0, i1, i2, idx)) continue
            tris.push(i0, i1, i2)
            idx.splice(i, 1)
            clipped = true
            break
        }
        if (!clipped) break
    }
    if (idx.length === 3) tris.push(idx[0], idx[1], idx[2])
    return tris
}

const ellipsePoints = (cx: number, cz: number, rx: number, rz: number, rot: number, segments = 48): Vec2[] => {
    const pts: Vec2[] = []
    const cos = Math.cos(rot)
    const sin = Math.sin(rot)
    for (let i = 0; i < segments; i++) {
        const t = (i / segments) * Math.PI * 2
        const lx = Math.cos(t) * rx
        const lz = Math.sin(t) * rz
        pts.push({
            x: cx + lx * cos - lz * sin,
            z: cz + lx * sin + lz * cos,
        })
    }
    return pts
}

/** Contour → closed ring in XZ (local). Arc bulge approximated. */
export const contourToRing = (contour: Contour, arcSegments = 12): Vec2[] => {
    if (contour.kind === 'polygon') return contour.points.map((p) => ({ ...p }))
    if (contour.kind === 'ellipse') {
        return ellipsePoints(
            contour.center.x,
            contour.center.z,
            contour.radiusX,
            contour.radiusZ,
            contour.rotation ?? 0
        )
    }

    // path
    const pts: Vec2[] = [{ ...contour.start }]
    let cur = contour.start
    for (const seg of contour.segments) {
        if (seg.kind === 'line') {
            cur = { ...seg.to }
            pts.push(cur)
            continue
        }
        // arc via bulge
        const start = cur
        const end = seg.to
        const bulge = seg.bulge
        const chord = { x: end.x - start.x, z: end.z - start.z }
        const chordLen = Math.hypot(chord.x, chord.z) || 1e-9
        const s = (bulge * chordLen) / 2
        // approximate with samples
        for (let i = 1; i <= arcSegments; i++) {
            const t = i / arcSegments
            const mx = start.x + chord.x * t
            const mz = start.z + chord.z * t
            const nx = -chord.z / chordLen
            const nz = chord.x / chordLen
            const offset = 4 * s * t * (1 - t)
            pts.push({ x: mx + nx * offset, z: mz + nz * offset })
        }
        cur = { ...end }
    }
    // ensure closed unique
    if (pts.length > 1) {
        const f = pts[0]
        const l = pts[pts.length - 1]
        if (Math.hypot(f.x - l.x, f.z - l.z) < 1e-9) pts.pop()
    }
    return pts
}

/**
 * Vertical extrusion of a contour (+ optional holes) from yMin to yMax.
 * Holes are rings in the same local XZ.
 */
export const buildExtrudeMesh = (contour: Contour, yMin: number, yMax: number, holes: Vec2[][] = []): Mesh => {
    const outer = contourToRing(contour)
    if (outer.length < 3) return { positions: [], indices: [] }

    const positions: number[] = []
    const indices: number[] = []

    const pushRing = (ring: Vec2[], y: number) => {
        const base = positions.length / 3
        for (const p of ring) positions.push(p.x, y, p.z)
        return base
    }

    const bottomBase = pushRing(outer, yMin)
    const topBase = pushRing(outer, yMax)
    const holeBottomBases: number[] = []
    const holeTopBases: number[] = []
    for (const hole of holes) {
        if (hole.length < 3) continue
        holeBottomBases.push(pushRing(hole, yMin))
        holeTopBases.push(pushRing(hole, yMax))
    }

    // Cap triangulation (outer only for now if holes — use earclip outer, skip hole caps properly later)
    // With holes: triangulate outer, then we still need proper hole support.
    // Simple approach without earcut holes: fan only when no holes; with holes build side walls of holes + outer sides, caps via earclip on outer minus approximate.
    const flatTris = earclip(outer)
    if (holes.length === 0) {
        for (let i = 0; i < flatTris.length; i += 3) {
            const a = flatTris[i]
            const b = flatTris[i + 1]
            const c = flatTris[i + 2]
            indices.push(bottomBase + a, bottomBase + c, bottomBase + b) // bottom flipped
            indices.push(topBase + a, topBase + b, topBase + c)
        }
    } else {
        // Caps: still triangulate outer; hole openings left open on caps (acceptable v0) OR subtract later.
        for (let i = 0; i < flatTris.length; i += 3) {
            const a = flatTris[i]
            const b = flatTris[i + 1]
            const c = flatTris[i + 2]
            indices.push(bottomBase + a, bottomBase + c, bottomBase + b)
            indices.push(topBase + a, topBase + b, topBase + c)
        }
    }

    const side = (baseBottom: number, baseTop: number, ringLen: number, outward: boolean) => {
        for (let i = 0; i < ringLen; i++) {
            const j = (i + 1) % ringLen
            const a = baseBottom + i
            const b = baseBottom + j
            const c = baseTop + j
            const d = baseTop + i
            if (outward) indices.push(a, b, c, a, c, d)
            else indices.push(a, c, b, a, d, c)
        }
    }

    side(bottomBase, topBase, outer.length, true)
    for (let h = 0; h < holeBottomBases.length; h++) {
        const ring = holes[h]
        side(holeBottomBases[h], holeTopBases[h], ring.length, false)
    }

    return computeVertexNormals({ positions, indices })
}
