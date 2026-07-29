'use strict';

const React$1 = require('react');
const fiber = require('@react-three/fiber');
const drei = require('@react-three/drei');
const THREE = require('three');

function _interopNamespaceCompat(e) {
    if (e && typeof e === 'object' && 'default' in e) return e;
    const n = Object.create(null);
    if (e) {
        for (const k in e) {
            n[k] = e[k];
        }
    }
    n.default = e;
    return n;
}

const React__namespace = /*#__PURE__*/_interopNamespaceCompat(React$1);
const THREE__namespace = /*#__PURE__*/_interopNamespaceCompat(THREE);

const isWorld = (n) => n.kind === "world";
const isApartment = (n) => n.kind === "apartment";
const isZone = (n) => n.kind === "zone";
const isGroup = (n) => n.kind === "group";
const isCompositeObject = (n) => n.kind === "composite";
const isIndependentObject = (n) => n.kind === "independent";

const mat4Identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const mat4Translate = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const mat4Multiply = (a, b) => {
  const out = new Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] = a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] + a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
    }
  }
  return out;
};
const mat4TransformPoint = (m, p) => ({
  x: m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12],
  y: m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13],
  z: m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14]
});
const mat4TransformDirection = (m, d) => ({
  x: m[0] * d.x + m[4] * d.y + m[8] * d.z,
  y: m[1] * d.x + m[5] * d.y + m[9] * d.z,
  z: m[2] * d.x + m[6] * d.y + m[10] * d.z
});

const vec2 = (x, z) => ({ x, z });
const vec3 = (x, y, z) => ({ x, y, z });
const add2 = (a, b) => ({ x: a.x + b.x, z: a.z + b.z });
const sub2 = (a, b) => ({ x: a.x - b.x, z: a.z - b.z });
const scale2 = (a, s) => ({ x: a.x * s, z: a.z * s });
const length2 = (a) => Math.hypot(a.x, a.z);
const normalize2 = (a) => {
  const len = length2(a);
  if (len < 1e-12) return { x: 0, z: 0 };
  return { x: a.x / len, z: a.z / len };
};
const perp2 = (a) => ({ x: -a.z, z: a.x });
const add3 = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub3 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale3 = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const cross3 = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x
});
const length3 = (a) => Math.hypot(a.x, a.y, a.z);
const normalize3 = (a) => {
  const len = length3(a);
  if (len < 1e-12) return { x: 0, y: 0, z: 0 };
  return { x: a.x / len, y: a.y / len, z: a.z / len };
};

const nodeLocalMatrix = (node) => mat4Translate(node.x, node.y, node.z);
const composeMatrices = (parentWorld, local) => mat4Multiply(parentWorld, local);
const walkWorld = (root, visit, parentWorld = mat4Identity(), parent = null) => {
  const worldMatrix = composeMatrices(parentWorld, nodeLocalMatrix(root));
  visit({ node: root, worldMatrix, parent });
  if (isIndependentObject(root)) return;
  if (isCompositeObject(root)) {
    for (const child of root.objects) {
      walkWorld(child, visit, worldMatrix, root);
    }
    return;
  }
  if (isGroup(root) || isZone(root) || isApartment(root) || isWorld(root)) {
    for (const child of root.children) {
      walkWorld(child, visit, worldMatrix, root);
    }
  }
};
const boundsSize = (b) => ({
  width: b.width,
  height: b.height,
  depth: b.depth
});

const emptyMesh = () => ({
  positions: [],
  indices: [],
  normals: []
});
const mergeMeshes = (meshes) => {
  const positions = [];
  const normals = [];
  const indices = [];
  let vertexOffset = 0;
  for (const mesh of meshes) {
    positions.push(...mesh.positions);
    if (mesh.normals?.length) {
      normals.push(...mesh.normals);
    } else {
      const count = mesh.positions.length / 3;
      for (let i = 0; i < count; i++) normals.push(0, 1, 0);
    }
    const src = mesh.indices;
    if (src?.length) {
      for (const i of src) indices.push(i + vertexOffset);
    } else {
      const count = mesh.positions.length / 3;
      for (let i = 0; i < count; i++) indices.push(vertexOffset + i);
    }
    vertexOffset += mesh.positions.length / 3;
  }
  return { positions, indices, normals };
};
const transformMesh = (mesh, matrix) => {
  const positions = [];
  const normals = [];
  const vcount = mesh.positions.length / 3;
  for (let i = 0; i < vcount; i++) {
    const p = mat4TransformPoint(matrix, {
      x: mesh.positions[i * 3],
      y: mesh.positions[i * 3 + 1],
      z: mesh.positions[i * 3 + 2]
    });
    positions.push(p.x, p.y, p.z);
    if (mesh.normals?.length) {
      const n = mat4TransformDirection(matrix, {
        x: mesh.normals[i * 3],
        y: mesh.normals[i * 3 + 1],
        z: mesh.normals[i * 3 + 2]
      });
      const len = Math.hypot(n.x, n.y, n.z) || 1;
      normals.push(n.x / len, n.y / len, n.z / len);
    }
  }
  return {
    positions,
    indices: mesh.indices ? [...mesh.indices] : void 0,
    normals: normals.length ? normals : void 0,
    uvs: mesh.uvs ? [...mesh.uvs] : void 0
  };
};
const computeVertexNormals = (mesh) => {
  const indices = mesh.indices ?? [...Array(mesh.positions.length / 3).keys()];
  const normals = new Array(mesh.positions.length).fill(0);
  const get = (i) => ({
    x: mesh.positions[i * 3],
    y: mesh.positions[i * 3 + 1],
    z: mesh.positions[i * 3 + 2]
  });
  for (let t = 0; t < indices.length; t += 3) {
    const ia = indices[t];
    const ib = indices[t + 1];
    const ic = indices[t + 2];
    const a = get(ia);
    const b = get(ib);
    const c = get(ic);
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const abz = b.z - a.z;
    const acx = c.x - a.x;
    const acy = c.y - a.y;
    const acz = c.z - a.z;
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    for (const i of [ia, ib, ic]) {
      normals[i * 3] += nx;
      normals[i * 3 + 1] += ny;
      normals[i * 3 + 2] += nz;
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= len;
    normals[i + 1] /= len;
    normals[i + 2] /= len;
  }
  return { ...mesh, normals, indices: [...indices] };
};
const pushQuad = (positions, indices, a, b, c, d) => {
  const base = positions.length / 3;
  for (const p of [a, b, c, d]) positions.push(p.x, p.y, p.z);
  indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
};

const buildBoxMesh = (width, height, depth) => {
  const hx = width / 2;
  const hy = height / 2;
  const hz = depth / 2;
  const positions = [];
  const indices = [];
  pushQuad(
    positions,
    indices,
    { x: -hx, y: -hy, z: hz },
    { x: hx, y: -hy, z: hz },
    { x: hx, y: hy, z: hz },
    { x: -hx, y: hy, z: hz }
  );
  pushQuad(
    positions,
    indices,
    { x: hx, y: -hy, z: -hz },
    { x: -hx, y: -hy, z: -hz },
    { x: -hx, y: hy, z: -hz },
    { x: hx, y: hy, z: -hz }
  );
  pushQuad(
    positions,
    indices,
    { x: hx, y: -hy, z: hz },
    { x: hx, y: -hy, z: -hz },
    { x: hx, y: hy, z: -hz },
    { x: hx, y: hy, z: hz }
  );
  pushQuad(
    positions,
    indices,
    { x: -hx, y: -hy, z: -hz },
    { x: -hx, y: -hy, z: hz },
    { x: -hx, y: hy, z: hz },
    { x: -hx, y: hy, z: -hz }
  );
  pushQuad(
    positions,
    indices,
    { x: -hx, y: hy, z: hz },
    { x: hx, y: hy, z: hz },
    { x: hx, y: hy, z: -hz },
    { x: -hx, y: hy, z: -hz }
  );
  pushQuad(
    positions,
    indices,
    { x: -hx, y: -hy, z: -hz },
    { x: hx, y: -hy, z: -hz },
    { x: hx, y: -hy, z: hz },
    { x: -hx, y: -hy, z: hz }
  );
  return computeVertexNormals({ positions, indices });
};

const earclip = (ring) => {
  const n = ring.length;
  if (n < 3) return [];
  if (n === 3) return [0, 1, 2];
  const idx = ring.map((_, i) => i);
  const area = () => {
    let a = 0;
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i];
      const q = ring[(i + 1) % ring.length];
      a += p.x * q.z - q.x * p.z;
    }
    return a;
  };
  const sign = area() >= 0 ? 1 : -1;
  const isEar = (i0, i1, i2, rest) => {
    const a = ring[i0];
    const b = ring[i1];
    const c = ring[i2];
    const cross = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
    if (cross * sign <= 1e-12) return false;
    for (const i of rest) {
      if (i === i0 || i === i1 || i === i2) continue;
      const p = ring[i];
      const d1 = (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
      const d2 = (c.x - b.x) * (p.z - b.z) - (c.z - b.z) * (p.x - b.x);
      const d3 = (a.x - c.x) * (p.z - c.z) - (a.z - c.z) * (p.x - c.x);
      if (d1 * sign >= -1e-12 && d2 * sign >= -1e-12 && d3 * sign >= -1e-12) return false;
    }
    return true;
  };
  const tris = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < 1e4) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const i0 = idx[(i + idx.length - 1) % idx.length];
      const i1 = idx[i];
      const i2 = idx[(i + 1) % idx.length];
      if (!isEar(i0, i1, i2, idx)) continue;
      tris.push(i0, i1, i2);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) tris.push(idx[0], idx[1], idx[2]);
  return tris;
};
const ellipsePoints = (cx, cz, rx, rz, rot, segments = 48) => {
  const pts = [];
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  for (let i = 0; i < segments; i++) {
    const t = i / segments * Math.PI * 2;
    const lx = Math.cos(t) * rx;
    const lz = Math.sin(t) * rz;
    pts.push({
      x: cx + lx * cos - lz * sin,
      z: cz + lx * sin + lz * cos
    });
  }
  return pts;
};
const contourToRing = (contour, arcSegments = 12) => {
  if (contour.kind === "polygon") return contour.points.map((p) => ({ ...p }));
  if (contour.kind === "ellipse") {
    return ellipsePoints(
      contour.center.x,
      contour.center.z,
      contour.radiusX,
      contour.radiusZ,
      contour.rotation ?? 0
    );
  }
  const pts = [{ ...contour.start }];
  let cur = contour.start;
  for (const seg of contour.segments) {
    if (seg.kind === "line") {
      cur = { ...seg.to };
      pts.push(cur);
      continue;
    }
    const start = cur;
    const end = seg.to;
    const bulge = seg.bulge;
    const chord = { x: end.x - start.x, z: end.z - start.z };
    const chordLen = Math.hypot(chord.x, chord.z) || 1e-9;
    const s = bulge * chordLen / 2;
    for (let i = 1; i <= arcSegments; i++) {
      const t = i / arcSegments;
      const mx = start.x + chord.x * t;
      const mz = start.z + chord.z * t;
      const nx = -chord.z / chordLen;
      const nz = chord.x / chordLen;
      const offset = 4 * s * t * (1 - t);
      pts.push({ x: mx + nx * offset, z: mz + nz * offset });
    }
    cur = { ...end };
  }
  if (pts.length > 1) {
    const f = pts[0];
    const l = pts[pts.length - 1];
    if (Math.hypot(f.x - l.x, f.z - l.z) < 1e-9) pts.pop();
  }
  return pts;
};
const buildExtrudeMesh = (contour, yMin, yMax, holes = []) => {
  const outer = contourToRing(contour);
  if (outer.length < 3) return { positions: [], indices: [] };
  const positions = [];
  const indices = [];
  const pushRing = (ring, y) => {
    const base = positions.length / 3;
    for (const p of ring) positions.push(p.x, y, p.z);
    return base;
  };
  const bottomBase = pushRing(outer, yMin);
  const topBase = pushRing(outer, yMax);
  const holeBottomBases = [];
  const holeTopBases = [];
  for (const hole of holes) {
    if (hole.length < 3) continue;
    holeBottomBases.push(pushRing(hole, yMin));
    holeTopBases.push(pushRing(hole, yMax));
  }
  const flatTris = earclip(outer);
  if (holes.length === 0) {
    for (let i = 0; i < flatTris.length; i += 3) {
      const a = flatTris[i];
      const b = flatTris[i + 1];
      const c = flatTris[i + 2];
      indices.push(bottomBase + a, bottomBase + c, bottomBase + b);
      indices.push(topBase + a, topBase + b, topBase + c);
    }
  } else {
    for (let i = 0; i < flatTris.length; i += 3) {
      const a = flatTris[i];
      const b = flatTris[i + 1];
      const c = flatTris[i + 2];
      indices.push(bottomBase + a, bottomBase + c, bottomBase + b);
      indices.push(topBase + a, topBase + b, topBase + c);
    }
  }
  const side = (baseBottom, baseTop, ringLen, outward) => {
    for (let i = 0; i < ringLen; i++) {
      const j = (i + 1) % ringLen;
      const a = baseBottom + i;
      const b = baseBottom + j;
      const c = baseTop + j;
      const d = baseTop + i;
      if (outward) indices.push(a, b, c, a, c, d);
      else indices.push(a, c, b, a, d, c);
    }
  };
  side(bottomBase, topBase, outer.length, true);
  for (let h = 0; h < holeBottomBases.length; h++) {
    const ring = holes[h];
    side(holeBottomBases[h], holeTopBases[h], ring.length, false);
  }
  return computeVertexNormals({ positions, indices });
};

const flattenPath = (path, arcSegments = 12) => {
  const points = [{ ...path.start }];
  let cur = path.start;
  for (const seg of path.segments) {
    if (seg.kind === "line") {
      cur = { ...seg.to };
      points.push(cur);
      continue;
    }
    const start = cur;
    const end = seg.to;
    const bulge = seg.bulge;
    const chord = sub2(end, start);
    const chordLen = length2(chord) || 1e-9;
    const s = bulge * chordLen / 2;
    const n = normalize2(perp2(chord));
    for (let i = 1; i <= arcSegments; i++) {
      const t = i / arcSegments;
      const mx = start.x + chord.x * t;
      const mz = start.z + chord.z * t;
      const offset = 4 * s * t * (1 - t);
      points.push({ x: mx + n.x * offset, z: mz + n.z * offset });
    }
    cur = { ...end };
  }
  if (path.closed && points.length > 1) {
    const f = points[0];
    const l = points[points.length - 1];
    if (Math.hypot(f.x - l.x, f.z - l.z) > 1e-6) points.push({ ...f });
  }
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + length2(sub2(points[i], points[i - 1])));
  }
  return { points, cum, total: cum[cum.length - 1] ?? 0 };
};
const lerp2 = (a, b, t) => ({
  x: a.x + (b.x - a.x) * t,
  z: a.z + (b.z - a.z) * t
});
const frameAt = (poly, d) => {
  const nSeg = poly.points.length - 1;
  if (nSeg < 1) return { point: { ...poly.points[0] }, normal: { x: 0, z: 1 } };
  let i = 0;
  while (i < nSeg - 1 && poly.cum[i + 1] < d - 1e-12) i++;
  const d0 = poly.cum[i];
  const d1 = poly.cum[i + 1];
  const p0 = poly.points[i];
  const p1 = poly.points[i + 1];
  const span = d1 - d0;
  const t = span < 1e-12 ? 0 : (d - d0) / span;
  const point = lerp2(p0, p1, Math.min(1, Math.max(0, t)));
  return { point, normal: perp2(normalize2(sub2(p1, p0))) };
};
const uvKey = (u, v) => `${u.toFixed(6)},${v.toFixed(6)}`;
const uniqSorted = (values, eps) => {
  const sorted = [...values].sort((a, b) => a - b);
  const out = [];
  for (const v of sorted) {
    if (!out.length || v - out[out.length - 1] > eps) out.push(v);
  }
  return out;
};
const solidElevationRects$1 = (length, yMin, yMax, gaps, eps) => {
  const sorted = [...gaps].sort((a, b) => a.from - b.from);
  const rects = [];
  const pushPier = (u0, u1, splitYs) => {
    if (u1 - u0 <= eps) return;
    const ys = uniqSorted([yMin, yMax, ...splitYs], eps);
    for (let i = 0; i < ys.length - 1; i++) {
      if (ys[i + 1] - ys[i] > eps) {
        rects.push({ u0, u1, v0: ys[i], v1: ys[i + 1] });
      }
    }
  };
  if (sorted.length === 0) {
    rects.push({ u0: 0, u1: length, v0: yMin, v1: yMax });
    return rects;
  }
  let cursor = 0;
  const allSplits = sorted.flatMap((g) => [g.yMin, g.yMax]);
  for (let gi = 0; gi < sorted.length; gi++) {
    const gap = sorted[gi];
    pushPier(cursor, gap.from, allSplits);
    if (gap.yMin - yMin > eps) {
      const us = uniqSorted([gap.from, gap.to, ...sorted.flatMap((g) => [g.from, g.to])], eps).filter(
        (u) => u >= gap.from - eps && u <= gap.to + eps
      );
      for (let i = 0; i < us.length - 1; i++) {
        if (us[i + 1] - us[i] > eps) {
          rects.push({ u0: us[i], u1: us[i + 1], v0: yMin, v1: gap.yMin });
        }
      }
    }
    if (yMax - gap.yMax > eps) {
      const us = uniqSorted([gap.from, gap.to, ...sorted.flatMap((g) => [g.from, g.to])], eps).filter(
        (u) => u >= gap.from - eps && u <= gap.to + eps
      );
      const vs = uniqSorted([gap.yMax, yMax, ...sorted.flatMap((g) => [g.yMin, g.yMax])], eps).filter(
        (v) => v >= gap.yMax - eps && v <= yMax + eps
      );
      for (let i = 0; i < us.length - 1; i++) {
        for (let j = 0; j < vs.length - 1; j++) {
          if (us[i + 1] - us[i] > eps && vs[j + 1] - vs[j] > eps) {
            rects.push({ u0: us[i], u1: us[i + 1], v0: vs[j], v1: vs[j + 1] });
          }
        }
      }
    }
    cursor = gap.to;
  }
  pushPier(cursor, length, allSplits);
  return rects;
};
const buildOuterRing = (length, yMin, yMax, gaps, eps) => {
  const bottomNotches = gaps.filter((g) => g.touchesBottom).sort((a, b) => a.from - b.from);
  const usAll = uniqSorted(
    [0, length, ...gaps.flatMap((g) => [g.from, g.to])],
    eps
  );
  const vsAll = uniqSorted(
    [yMin, yMax, ...gaps.flatMap((g) => [g.yMin, g.yMax])],
    eps
  );
  const outer = [];
  let uCursor = 0;
  outer.push({ u: 0, v: yMin });
  for (const g of bottomNotches) {
    for (const u of usAll) {
      if (u <= uCursor + eps || u >= g.from - eps) continue;
      outer.push({ u, v: yMin });
    }
    if (Math.abs(outer[outer.length - 1].u - g.from) > eps || Math.abs(outer[outer.length - 1].v - yMin) > eps) {
      outer.push({ u: g.from, v: yMin });
    }
    const top = g.touchesTop ? yMax : g.yMax;
    for (const v of vsAll) {
      if (v <= yMin + eps || v >= top - eps) continue;
      outer.push({ u: g.from, v });
    }
    outer.push({ u: g.from, v: top });
    for (const u of usAll) {
      if (u <= g.from + eps || u >= g.to - eps) continue;
      outer.push({ u, v: top });
    }
    outer.push({ u: g.to, v: top });
    for (let i = vsAll.length - 1; i >= 0; i--) {
      const v = vsAll[i];
      if (v >= top - eps || v <= yMin + eps) continue;
      outer.push({ u: g.to, v });
    }
    outer.push({ u: g.to, v: yMin });
    uCursor = g.to;
  }
  for (const u of usAll) {
    if (u <= uCursor + eps) continue;
    outer.push({ u, v: yMin });
  }
  if (Math.abs(outer[outer.length - 1].u - length) > eps || Math.abs(outer[outer.length - 1].v - yMin) > eps) {
    outer.push({ u: length, v: yMin });
  }
  for (const v of vsAll) {
    if (v <= yMin + eps || v >= yMax - eps) continue;
    outer.push({ u: length, v });
  }
  outer.push({ u: length, v: yMax });
  for (let i = usAll.length - 2; i >= 0; i--) {
    outer.push({ u: usAll[i], v: yMax });
  }
  if (Math.abs(outer[outer.length - 1].u) > eps || Math.abs(outer[outer.length - 1].v - yMax) > eps) {
    outer.push({ u: 0, v: yMax });
  }
  for (let i = vsAll.length - 2; i >= 0; i--) {
    const v = vsAll[i];
    if (v <= yMin + eps) continue;
    outer.push({ u: 0, v });
  }
  return outer;
};
const buildHoleRings = (gaps, allGaps, eps) => {
  const usAll = uniqSorted(
    allGaps.flatMap((g) => [g.from, g.to]),
    eps
  );
  const vsAll = uniqSorted(
    allGaps.flatMap((g) => [g.yMin, g.yMax]),
    eps
  );
  return gaps.filter((g) => !g.touchesBottom && !g.touchesTop).map((g) => {
    const ring = [];
    ring.push({ u: g.from, v: g.yMin });
    for (const v of vsAll) {
      if (v <= g.yMin + eps || v >= g.yMax - eps) continue;
      ring.push({ u: g.from, v });
    }
    ring.push({ u: g.from, v: g.yMax });
    for (const u of usAll) {
      if (u <= g.from + eps || u >= g.to - eps) continue;
      ring.push({ u, v: g.yMax });
    }
    ring.push({ u: g.to, v: g.yMax });
    for (let i = vsAll.length - 1; i >= 0; i--) {
      const v = vsAll[i];
      if (v >= g.yMax - eps || v <= g.yMin + eps) continue;
      ring.push({ u: g.to, v });
    }
    ring.push({ u: g.to, v: g.yMin });
    for (let i = usAll.length - 1; i >= 0; i--) {
      const u = usAll[i];
      if (u >= g.to - eps || u <= g.from + eps) continue;
      ring.push({ u, v: g.yMin });
    }
    return ring;
  });
};
const buildWallMesh = (path, thickness, yMin, yMax, gaps = []) => {
  const poly = flattenPath(path);
  if (poly.points.length < 2 || poly.total < 1e-9) return { positions: [], indices: [] };
  if (yMax - yMin < 1e-6) return { positions: [], indices: [] };
  const length = poly.total;
  const half = thickness / 2;
  const eps = 1e-6;
  const clampedGaps = [...gaps].map((g) => {
    const from = Math.max(0, Math.min(length, Math.min(g.from, g.to)));
    const to = Math.max(0, Math.min(length, Math.max(g.from, g.to)));
    const gy0 = Math.max(yMin, Math.min(yMax, Math.min(g.yMin, g.yMax)));
    const gy1 = Math.max(yMin, Math.min(yMax, Math.max(g.yMin, g.yMax)));
    return {
      from,
      to,
      yMin: gy0,
      yMax: gy1,
      touchesBottom: gy0 <= yMin + eps,
      touchesTop: gy1 >= yMax - eps
    };
  }).filter((g) => g.to - g.from > eps && g.yMax - g.yMin > eps).sort((a, b) => a.from - b.from);
  const rects = solidElevationRects$1(length, yMin, yMax, clampedGaps, eps);
  if (rects.length === 0) return { positions: [], indices: [] };
  const outer = buildOuterRing(length, yMin, yMax, clampedGaps, eps);
  const holes = buildHoleRings(clampedGaps, clampedGaps, eps);
  const uvs = [];
  const keyToIndex = /* @__PURE__ */ new Map();
  const indexOf = (u, v) => {
    const key = uvKey(u, v);
    const existing = keyToIndex.get(key);
    if (existing != null) return existing;
    const idx = uvs.length;
    keyToIndex.set(key, idx);
    uvs.push({ u, v });
    return idx;
  };
  const capTris = [];
  for (const r of rects) {
    const a = indexOf(r.u0, r.v0);
    const b = indexOf(r.u1, r.v0);
    const c = indexOf(r.u1, r.v1);
    const d = indexOf(r.u0, r.v1);
    capTris.push(a, b, c, a, c, d);
  }
  const outerRing = outer.map((p) => indexOf(p.u, p.v));
  const holeRings = holes.map((h) => h.map((p) => indexOf(p.u, p.v)));
  const dedupeRing = (ring) => {
    const out = [];
    for (const i of ring) {
      if (out.length && out[out.length - 1] === i) continue;
      out.push(i);
    }
    if (out.length > 1 && out[0] === out[out.length - 1]) out.pop();
    return out;
  };
  const positions = [];
  const indices = [];
  const push3 = (x, y, z) => {
    positions.push(x, y, z);
    return positions.length / 3 - 1;
  };
  const frontOf = [];
  const backOf = [];
  for (const { u, v } of uvs) {
    const { point, normal } = frameAt(poly, u);
    frontOf.push(push3(point.x + normal.x * half, v, point.z + normal.z * half));
    backOf.push(push3(point.x - normal.x * half, v, point.z - normal.z * half));
  }
  for (let i = 0; i < capTris.length; i += 3) {
    const a = capTris[i];
    const b = capTris[i + 1];
    const c = capTris[i + 2];
    indices.push(frontOf[a], frontOf[b], frontOf[c]);
    indices.push(backOf[a], backOf[c], backOf[b]);
  }
  const emitRingSides = (ring, outward) => {
    const r = dedupeRing(ring);
    if (r.length < 3) return;
    for (let i = 0; i < r.length; i++) {
      const a = r[i];
      const b = r[(i + 1) % r.length];
      const f0 = frontOf[a];
      const f1 = frontOf[b];
      const b0 = backOf[a];
      const b1 = backOf[b];
      if (outward) indices.push(f0, b0, b1, f0, b1, f1);
      else indices.push(f0, f1, b1, f0, b1, b0);
    }
  };
  emitRingSides(outerRing, true);
  for (const hole of holeRings) emitRingSides(hole, false);
  return computeVertexNormals({ positions, indices });
};

const buildSphereMesh = (radius, segments = 24, rings = 16) => {
  const positions = [];
  const indices = [];
  for (let y = 0; y <= rings; y++) {
    const v = y / rings;
    const phi = v * Math.PI;
    for (let x = 0; x <= segments; x++) {
      const u = x / segments;
      const theta = u * Math.PI * 2;
      const sx = Math.cos(theta) * Math.sin(phi);
      const sy = Math.cos(phi);
      const sz = Math.sin(theta) * Math.sin(phi);
      positions.push(sx * radius, sy * radius, sz * radius);
    }
  }
  for (let y = 0; y < rings; y++) {
    for (let x = 0; x < segments; x++) {
      const a = y * (segments + 1) + x;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return computeVertexNormals({ positions, indices });
};
const buildCylinderMesh = (radius, height, segments = 24) => {
  const positions = [];
  const indices = [];
  const hy = height / 2;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments * Math.PI * 2;
    const x = Math.cos(t) * radius;
    const z = Math.sin(t) * radius;
    positions.push(x, -hy, z, x, hy, z);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }
  const bottomCenter = positions.length / 3;
  positions.push(0, -hy, 0);
  const topCenter = positions.length / 3;
  positions.push(0, hy, 0);
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const c = a + 2;
    indices.push(bottomCenter, c, a);
    const b = a + 1;
    const d = a + 3;
    indices.push(topCenter, b, d);
  }
  return computeVertexNormals({ positions, indices });
};
const buildCapsuleMesh = (radius, height) => {
  const cylH = Math.max(height - radius * 2, 1e-6);
  const cyl = buildCylinderMesh(radius, cylH);
  const hemi = buildSphereMesh(radius, 16, 8);
  const top = transformMesh(hemi, mat4Translate(0, cylH / 2, 0));
  const bottom = transformMesh(hemi, mat4Translate(0, -cylH / 2, 0));
  return mergeMeshes([cyl, top, bottom]);
};

const buildShapeMesh = (shape, host) => {
  switch (shape.kind) {
    case "box":
      return buildBoxMesh(host.width, host.height, host.depth);
    case "extrude":
      return buildExtrudeMesh(shape.contour, -host.height / 2, host.height / 2);
    case "wall":
      return buildWallMesh(shape.path, shape.thickness, -host.height / 2, host.height / 2);
    case "sphere":
      return buildSphereMesh(shape.radius);
    case "capsule":
      return buildCapsuleMesh(shape.radius, shape.height);
    case "cylinder":
      return buildCylinderMesh(shape.radius, shape.height ?? host.height);
    case "mesh":
      return {
        positions: [...shape.mesh.positions],
        indices: shape.mesh.indices ? [...shape.mesh.indices] : void 0,
        normals: shape.mesh.normals ? [...shape.mesh.normals] : void 0,
        uvs: shape.mesh.uvs ? [...shape.mesh.uvs] : void 0
      };
    case "csg":
      if (shape.op === "union") {
        return mergeMeshes([buildShapeMesh(shape.a, host), buildShapeMesh(shape.b, host)]);
      }
      return buildShapeMesh(shape.a, host);
    case "custom":
      return { positions: [], indices: [] };
    default: {
      const _exhaustive = shape;
      return _exhaustive;
    }
  }
};
const buildCutoutMesh = (cutout) => {
  const shape = cutout.shape ?? { kind: "box" };
  const local = buildShapeMesh(shape, cutout);
  return transformMesh(local, mat4Translate(cutout.x, cutout.y, cutout.z));
};
const cutoutsToWallGaps = (cutouts) => {
  if (!cutouts?.length) return [];
  return cutouts.filter((c) => c.pathOffset != null).map((c) => ({
    from: c.pathOffset,
    to: c.pathOffset + c.width,
    yMin: c.y - c.height / 2,
    yMax: c.y + c.height / 2
  }));
};
const cutoutToHoleRings = (cutout) => {
  if (cutout.shape?.kind === "extrude") {
    return [
      contourToRing(cutout.shape.contour).map((p) => ({
        x: p.x + cutout.x,
        z: p.z + cutout.z
      }))
    ];
  }
  if (cutout.shape?.kind === "sphere" || cutout.shape?.kind === "cylinder") {
    const r = cutout.shape.kind === "sphere" ? cutout.shape.radius : cutout.shape.radius;
    const segments = 24;
    const ring = [];
    for (let i = 0; i < segments; i++) {
      const t = i / segments * Math.PI * 2;
      ring.push({
        x: cutout.x + Math.cos(t) * r,
        z: cutout.z + Math.sin(t) * r
      });
    }
    return [ring];
  }
  const hx = cutout.width / 2;
  const hz = cutout.depth / 2;
  return [
    [
      { x: cutout.x - hx, z: cutout.z - hz },
      { x: cutout.x + hx, z: cutout.z - hz },
      { x: cutout.x + hx, z: cutout.z + hz },
      { x: cutout.x - hx, z: cutout.z + hz }
    ]
  ];
};

const buildIndependentGeometry = (object) => {
  const shape = object.shape ?? { kind: "box" };
  const cutoutMeshes = (object.cutouts ?? []).map(buildCutoutMesh);
  if (shape.kind === "wall") {
    const gaps = cutoutsToWallGaps(object.cutouts);
    const solid = buildWallMesh(shape.path, shape.thickness, -object.height / 2, object.height / 2, gaps);
    return { solid, cutouts: cutoutMeshes };
  }
  if (shape.kind === "extrude") {
    const holes = (object.cutouts ?? []).flatMap(cutoutToHoleRings);
    const solid = buildExtrudeMesh(shape.contour, -object.height / 2, object.height / 2, holes);
    return { solid, cutouts: cutoutMeshes };
  }
  return {
    solid: buildShapeMesh(shape, object),
    cutouts: cutoutMeshes
  };
};

const buildWorldSolids = (world) => {
  const result = [];
  walkWorld(world, ({ node, worldMatrix }) => {
    if (!isIndependentObject(node)) return;
    const local = buildIndependentGeometry(node);
    result.push({
      object: node,
      local,
      worldSolid: transformMesh(local.solid, worldMatrix),
      worldMatrix
    });
  });
  return result;
};

class PlanaError extends Error {
  /**
   * @param message - Human-readable description of the failure.
   * @param options - Standard `Error` options (e.g. `cause`).
   */
  constructor(message, options) {
    super(message, options);
    this.name = "PlanaError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

class ValidationError extends PlanaError {
  /**
   * @param message - Description of the validation failure.
   * @param options - Standard `Error` options (e.g. `cause`).
   */
  constructor(message, options) {
    super(message, options);
    this.name = "ValidationError";
  }
}

class NotFoundError extends PlanaError {
  /**
   * Identifier that could not be resolved, when applicable.
   */
  id;
  /**
   * @param message - Description of what was missing.
   * @param id - Optional resource id that was looked up.
   * @param options - Standard `Error` options (e.g. `cause`).
   */
  constructor(message, id, options) {
    super(message, options);
    this.name = "NotFoundError";
    this.id = id;
  }
}

class CommandError extends PlanaError {
  /**
   * @param message - Description of why the command failed.
   * @param options - Standard `Error` options (e.g. `cause`).
   */
  constructor(message, options) {
    super(message, options);
    this.name = "CommandError";
  }
}

class GeometryError extends PlanaError {
  /**
   * @param message - Description of the geometry failure.
   * @param options - Standard `Error` options (e.g. `cause`).
   */
  constructor(message, options) {
    super(message, options);
    this.name = "GeometryError";
  }
}

const emptySelection = () => Object.freeze({ ids: Object.freeze([]) });
const createSelection = (ids = []) => {
  const seen = /* @__PURE__ */ new Set();
  const unique = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  return Object.freeze({ ids: Object.freeze(unique) });
};
const selectionEquals = (a, b) => {
  if (a.ids.length !== b.ids.length) return false;
  for (let i = 0; i < a.ids.length; i++) {
    if (a.ids[i] !== b.ids[i]) return false;
  }
  return true;
};
const isSelected = (selection, id) => selection.ids.includes(id);

const createHistorySnapshot = (world, selection) => Object.freeze({
  world,
  selection: createSelection(selection.ids)
});
class History {
  undoStack = [];
  redoStack = [];
  limit;
  /**
   * @param limit - Maximum number of undo entries retained (oldest dropped). Defaults to `100`.
   */
  constructor(limit = 100) {
    this.limit = Math.max(1, limit);
  }
  /**
   * Whether an undo operation is available.
   */
  get canUndo() {
    return this.undoStack.length > 0;
  }
  /**
   * Whether a redo operation is available.
   */
  get canRedo() {
    return this.redoStack.length > 0;
  }
  /**
   * Number of entries on the undo stack.
   */
  get undoDepth() {
    return this.undoStack.length;
  }
  /**
   * Number of entries on the redo stack.
   */
  get redoDepth() {
    return this.redoStack.length;
  }
  /**
   * Record a snapshot taken *before* a mutating change. Clears the redo stack.
   *
   * @param snapshot - Previous world + selection.
   */
  push(snapshot) {
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.limit) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }
  /**
   * Pop the previous snapshot and push `current` onto the redo stack.
   *
   * @param current - Document state at the moment of undo (pushed to redo).
   * @returns The restored snapshot, or `null` if the undo stack is empty.
   */
  undo(current) {
    const previous = this.undoStack.pop();
    if (!previous) return null;
    this.redoStack.push(current);
    return previous;
  }
  /**
   * Pop the next redo snapshot and push `current` onto the undo stack.
   *
   * @param current - Document state at the moment of redo (pushed to undo).
   * @returns The restored snapshot, or `null` if the redo stack is empty.
   */
  redo(current) {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push(current);
    return next;
  }
  /**
   * Remove the most recent undo entry without affecting the redo stack.
   *
   * Useful when a command was pushed optimistically but then failed to apply.
   *
   * @returns The dropped snapshot, or `null` if the undo stack was empty.
   */
  dropLastUndo() {
    return this.undoStack.pop() ?? null;
  }
  /**
   * Clear both undo and redo stacks.
   */
  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}

const defaultStyle = {
  color: "#c4a574",
  accentColor: "#8b6914",
  opacity: 1,
  metalness: 0.05,
  roughness: 0.75,
  visible: true,
  selectable: true,
  outlineColor: "#2a241c",
  outlineWidth: 0.01,
  extras: void 0
};

const mergeStyle = (base, patch) => {
  const merged = { ...base ?? {}, ...patch };
  if (base?.extras && patch.extras) {
    merged.extras = { ...base.extras, ...patch.extras };
  }
  return merged;
};

const resolveStyle = (node) => {
  const style = node && "style" in node ? node.style : node;
  const merged = mergeStyle(defaultStyle, style ?? {});
  return {
    color: merged.color ?? defaultStyle.color,
    accentColor: merged.accentColor ?? defaultStyle.accentColor,
    opacity: merged.opacity ?? defaultStyle.opacity,
    metalness: merged.metalness ?? defaultStyle.metalness,
    roughness: merged.roughness ?? defaultStyle.roughness,
    visible: merged.visible ?? defaultStyle.visible,
    selectable: merged.selectable ?? defaultStyle.selectable,
    outlineColor: merged.outlineColor ?? defaultStyle.outlineColor,
    outlineWidth: merged.outlineWidth ?? defaultStyle.outlineWidth,
    extras: merged.extras
  };
};

const requireId = (node) => {
  if (!node.id) {
    throw new ValidationError("Node is missing a required id");
  }
  return node.id;
};
const findNodeById = (root, id) => {
  if (root.id === id) return root;
  if (isIndependentObject(root)) return void 0;
  if (isCompositeObject(root)) {
    for (const child of root.objects) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
    return void 0;
  }
  if (isGroup(root) || isZone(root) || isApartment(root) || isWorld(root)) {
    for (const child of root.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  return void 0;
};
const requireNodeById = (root, id) => {
  const found = findNodeById(root, id);
  if (!found) {
    throw new NotFoundError(`Node not found: ${id}`, id);
  }
  return found;
};
const cloneWorldShallow = (world) => ({
  ...world,
  children: [...world.children]
});
const getChildNodes = (node) => {
  if (isCompositeObject(node)) return node.objects;
  if (isGroup(node) || isZone(node) || isApartment(node) || isWorld(node)) return node.children;
  return null;
};
const isContainer = (node) => !isIndependentObject(node);
const canParentChild = (parent, child) => {
  if (isWorld(parent)) {
    return child.kind === "apartment" || child.kind === "group";
  }
  if (isApartment(parent)) {
    return child.kind === "zone" || child.kind === "group";
  }
  if (isZone(parent)) {
    return child.kind === "independent" || child.kind === "composite" || child.kind === "group";
  }
  if (isGroup(parent)) {
    return child.kind === "independent" || child.kind === "composite" || child.kind === "zone" || child.kind === "group";
  }
  if (isCompositeObject(parent)) {
    return child.kind === "independent";
  }
  return false;
};
const updateNodeById = (root, id, updater) => {
  if (root.id === id) {
    return updater(root);
  }
  if (!isContainer(root)) return null;
  if (isCompositeObject(root)) {
    let changed2 = false;
    const objects = [];
    for (const child of root.objects) {
      const next = updateNodeById(child, id, updater);
      if (next) {
        changed2 = true;
        objects.push(next);
      } else {
        objects.push(child);
      }
    }
    return changed2 ? { ...root, objects } : null;
  }
  let changed = false;
  const children = [];
  for (const child of root.children) {
    const next = updateNodeById(child, id, updater);
    if (next) {
      changed = true;
      children.push(next);
    } else {
      children.push(child);
    }
  }
  if (!changed) return null;
  if (isWorld(root)) {
    return { ...root, children };
  }
  if (isApartment(root)) {
    return { ...root, children };
  }
  if (isZone(root)) {
    return { ...root, children };
  }
  if (isGroup(root)) {
    return { ...root, children };
  }
  return null;
};
const removeNodeById = (root, id) => {
  if (root.id === id) {
    return null;
  }
  if (!isContainer(root)) return null;
  if (isCompositeObject(root)) {
    const index2 = root.objects.findIndex((c) => c.id === id);
    if (index2 >= 0) {
      const removed = root.objects[index2];
      const objects = [...root.objects.slice(0, index2), ...root.objects.slice(index2 + 1)];
      return { root: { ...root, objects }, removed };
    }
    for (let i = 0; i < root.objects.length; i++) {
      const result = removeNodeById(root.objects[i], id);
      if (result) {
        const objects = [...root.objects];
        objects[i] = result.root;
        return { root: { ...root, objects }, removed: result.removed };
      }
    }
    return null;
  }
  const index = root.children.findIndex((c) => c.id === id);
  if (index >= 0) {
    const removed = root.children[index];
    const children = [...root.children.slice(0, index), ...root.children.slice(index + 1)];
    return { root: withChildren(root, children), removed };
  }
  for (let i = 0; i < root.children.length; i++) {
    const result = removeNodeById(root.children[i], id);
    if (result) {
      const children = [...root.children];
      children[i] = result.root;
      return { root: withChildren(root, children), removed: result.removed };
    }
  }
  return null;
};
const withChildren = (parent, children) => {
  if (isWorld(parent)) return { ...parent, children };
  if (isApartment(parent)) return { ...parent, children };
  if (isZone(parent)) return { ...parent, children };
  return { ...parent, children };
};
const addChildToParent = (root, parentId, child) => {
  const matchesParent = parentId === null ? isWorld(root) : root.id !== void 0 && root.id === parentId;
  if (matchesParent) {
    if (!canParentChild(root, child)) {
      throw new ValidationError(`Cannot add ${child.kind} under parent kind ${root.kind}`);
    }
    return appendChild(root, child);
  }
  if (!isContainer(root)) return null;
  if (isCompositeObject(root)) {
    let changed2 = null;
    const objects = root.objects.map((c) => {
      if (changed2) return c;
      const next = addChildToParent(c, parentId, child);
      if (next) {
        changed2 = next;
        return next;
      }
      return c;
    });
    return changed2 ? { ...root, objects } : null;
  }
  let changed = null;
  const children = root.children.map((c) => {
    if (changed) return c;
    const next = addChildToParent(c, parentId, child);
    if (next) {
      changed = next;
      return next;
    }
    return c;
  });
  return changed ? withChildren(root, children) : null;
};
const appendChild = (parent, child) => {
  if (isCompositeObject(parent)) {
    return { ...parent, objects: [...parent.objects, child] };
  }
  if (isWorld(parent)) {
    return { ...parent, children: [...parent.children, child] };
  }
  if (isApartment(parent)) {
    return {
      ...parent,
      children: [...parent.children, child]
    };
  }
  if (isZone(parent)) {
    return { ...parent, children: [...parent.children, child] };
  }
  if (isGroup(parent)) {
    return { ...parent, children: [...parent.children, child] };
  }
  throw new ValidationError(`Cannot append children to kind ${parent.kind}`);
};
const createEmptyWorld = (id = "world") => ({
  kind: "world",
  id,
  x: 0,
  y: 0,
  z: 0,
  width: 0,
  height: 0,
  depth: 0,
  children: []
});

const applyCommand = (world, command) => {
  switch (command.type) {
    case "replaceWorld": {
      if (!isWorld(command.world)) {
        throw new ValidationError('replaceWorld requires a node with kind "world"');
      }
      return { world: command.world };
    }
    case "setSelection": {
      return { world, selectionIds: command.ids };
    }
    case "addNode": {
      requireId(command.node);
      const nodeId = command.node.id;
      if (findNodeById(world, nodeId)) {
        throw new ValidationError(`Node id already exists: ${nodeId}`);
      }
      const next = addChildToParent(world, command.parentId, command.node);
      if (!next || !isWorld(next)) {
        const id = command.parentId ?? world.id;
        throw new NotFoundError(`Parent not found: ${id ?? "(world root)"}`, id ?? void 0);
      }
      return { world: next };
    }
    case "removeNode": {
      if (world.id === command.id) {
        throw new CommandError("Cannot remove the world root");
      }
      const result = removeNodeById(world, command.id);
      if (!result || !isWorld(result.root)) {
        throw new NotFoundError(`Node not found: ${command.id}`, command.id);
      }
      return { world: result.root };
    }
    case "updateIndependent": {
      const existing = findNodeById(world, command.id);
      if (!existing) {
        throw new NotFoundError(`Node not found: ${command.id}`, command.id);
      }
      if (!isIndependentObject(existing)) {
        throw new CommandError(`updateIndependent requires an independent node (got ${existing.kind})`);
      }
      const next = updateNodeById(world, command.id, (node) => {
        const patched = {
          ...node,
          ...command.patch,
          kind: "independent",
          id: command.id
        };
        return patched;
      });
      if (!next || !isWorld(next)) {
        throw new NotFoundError(`Node not found: ${command.id}`, command.id);
      }
      return { world: next };
    }
    case "updateBounds": {
      if (!findNodeById(world, command.id)) {
        throw new NotFoundError(`Node not found: ${command.id}`, command.id);
      }
      const next = updateNodeById(world, command.id, (node) => ({
        ...node,
        ...command.bounds
      }));
      if (!next || !isWorld(next)) {
        throw new NotFoundError(`Node not found: ${command.id}`, command.id);
      }
      return { world: next };
    }
    case "updateStyle": {
      if (!findNodeById(world, command.id)) {
        throw new NotFoundError(`Node not found: ${command.id}`, command.id);
      }
      const next = updateNodeById(world, command.id, (node) => ({
        ...node,
        style: mergeStyle(node.style, command.style)
      }));
      if (!next || !isWorld(next)) {
        throw new NotFoundError(`Node not found: ${command.id}`, command.id);
      }
      return { world: next };
    }
    case "updateNode": {
      if (!findNodeById(world, command.id)) {
        throw new NotFoundError(`Node not found: ${command.id}`, command.id);
      }
      const next = updateNodeById(world, command.id, (node) => {
        const {
          kind: _kind,
          id: _id,
          ...safePatch
        } = command.patch;
        return {
          ...node,
          ...safePatch,
          kind: node.kind,
          id: command.id
        };
      });
      if (!next || !isWorld(next)) {
        throw new NotFoundError(`Node not found: ${command.id}`, command.id);
      }
      return { world: next };
    }
    default: {
      const _exhaustive = command;
      throw new CommandError(`Unknown command: ${JSON.stringify(_exhaustive)}`);
    }
  }
};

class Document {
  world;
  selection;
  history;
  listeners = /* @__PURE__ */ new Set();
  /**
   * @param options - Initial world, selection, and history limit.
   */
  constructor(options = {}) {
    this.world = options.world ?? createEmptyWorld();
    this.selection = options.selection ? createSelection(options.selection.ids) : emptySelection();
    this.history = new History(options.historyLimit ?? 100);
  }
  /**
   * Current world tree (treat as immutable; mutate via {@link Document.dispatch}).
   *
   * @returns The current {@link World}.
   */
  getWorld() {
    return this.world;
  }
  /**
   * Current selection snapshot.
   *
   * @returns The current {@link Selection}.
   */
  getSelection() {
    return this.selection;
  }
  /**
   * Whether {@link Document.undo} would restore a previous snapshot.
   *
   * @returns `true` when the undo stack is non-empty.
   */
  canUndo() {
    return this.history.canUndo;
  }
  /**
   * Whether {@link Document.redo} would re-apply a undone snapshot.
   *
   * @returns `true` when the redo stack is non-empty.
   */
  canRedo() {
    return this.history.canRedo;
  }
  /**
   * Replace the world, recording history and notifying listeners.
   *
   * @param world - New world tree.
   * @param options - Pass `{ recordHistory: false }` to skip the undo stack (e.g. initial load).
   */
  replaceWorld(world, options = {}) {
    const recordHistory = options.recordHistory !== false;
    if (recordHistory) {
      this.history.push(createHistorySnapshot(this.world, this.selection));
    }
    this.world = world;
    this.emit("replaceWorld");
  }
  /**
   * Set the selection without going through {@link Document.dispatch}.
   *
   * Selection-only updates are recorded on the history stack so undo restores
   * the previous selection.
   *
   * @param ids - Node ids to select.
   * @param options - Pass `{ recordHistory: false }` to skip the undo stack.
   */
  setSelection(ids, options = {}) {
    const next = createSelection(ids);
    if (selectionEquals(this.selection, next)) return;
    const recordHistory = options.recordHistory !== false;
    if (recordHistory) {
      this.history.push(createHistorySnapshot(this.world, this.selection));
    }
    this.selection = next;
    this.emit("setSelection");
  }
  /**
   * Apply a {@link Command}, push history, and notify subscribers.
   *
   * @param command - Command to apply.
   * @throws {@link import('../errors').ValidationError} On invalid command input.
   * @throws {@link import('../errors').NotFoundError} When a referenced id is missing.
   * @throws {@link import('../errors').CommandError} When the command cannot be applied.
   */
  dispatch(command) {
    this.history.push(createHistorySnapshot(this.world, this.selection));
    try {
      const result = applyCommand(this.world, command);
      this.world = result.world;
      if (result.selectionIds !== void 0) {
        this.selection = createSelection(result.selectionIds);
      }
      this.pruneSelection();
      this.emit("dispatch");
    } catch (error) {
      this.history.dropLastUndo();
      throw error;
    }
  }
  /**
   * Restore the previous history snapshot.
   *
   * @returns `true` if a snapshot was restored; otherwise `false`.
   */
  undo() {
    const restored = this.history.undo(createHistorySnapshot(this.world, this.selection));
    if (!restored) return false;
    this.world = restored.world;
    this.selection = restored.selection;
    this.emit("undo");
    return true;
  }
  /**
   * Re-apply the next redo snapshot.
   *
   * @returns `true` if a snapshot was restored; otherwise `false`.
   */
  redo() {
    const restored = this.history.redo(createHistorySnapshot(this.world, this.selection));
    if (!restored) return false;
    this.world = restored.world;
    this.selection = restored.selection;
    this.emit("redo");
    return true;
  }
  /**
   * Subscribe to document changes.
   *
   * @param listener - Callback invoked after world/selection updates.
   * @returns Unsubscribe function.
   *
   * @example
   * ```ts
   * const stop = doc.subscribe((change) => {
   *   if (change.reason === 'undo') {
   *     // handle undo
   *   }
   * })
   * stop()
   * ```
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  pruneSelection() {
    const alive = this.selection.ids.filter((id) => findNodeById(this.world, id));
    if (alive.length !== this.selection.ids.length) {
      this.selection = createSelection(alive);
    }
  }
  emit(reason) {
    const change = {
      world: this.world,
      selection: this.selection,
      reason
    };
    for (const listener of this.listeners) {
      listener(change);
    }
  }
}
function createDocument(worldOrOptions) {
  if (!worldOrOptions) {
    return new Document();
  }
  if ("kind" in worldOrOptions && worldOrOptions.kind === "world") {
    return new Document({ world: worldOrOptions });
  }
  return new Document(worldOrOptions);
}

const PLANA_DOCUMENT_VERSION = 1;
const PLANA_DOCUMENT_FORMAT = "plana";

const KNOWN_KINDS = /* @__PURE__ */ new Set(["world", "apartment", "zone", "group", "composite", "independent"]);
const validateNodeTree = (node, path = "world") => {
  if (!node || typeof node !== "object") {
    throw new ValidationError(`Invalid node at ${path}: expected an object`);
  }
  const record = node;
  if (typeof record.kind !== "string" || !KNOWN_KINDS.has(record.kind)) {
    throw new ValidationError(`Invalid node kind at ${path}: ${String(record.kind)}`);
  }
  const asNode = node;
  const children = getChildNodes(asNode);
  if (children) {
    for (let i = 0; i < children.length; i++) {
      validateNodeTree(children[i], `${path}.children[${i}]`);
    }
  }
};
const validateWorld = (value) => {
  if (!value || typeof value !== "object") {
    throw new ValidationError("Document world must be an object");
  }
  if (value.kind !== "world") {
    throw new ValidationError('Document world.kind must be "world"');
  }
  validateNodeTree(value, "world");
  return value;
};

const resolveExportInput = (input) => {
  if ("getWorld" in input) {
    return {
      world: input.getWorld(),
      selection: input.getSelection().ids
    };
  }
  return input;
};
const exportDocumentObject = (input) => {
  const { world, selection, meta } = resolveExportInput(input);
  const file = {
    format: PLANA_DOCUMENT_FORMAT,
    version: PLANA_DOCUMENT_VERSION,
    world
  };
  if (meta) file.meta = meta;
  if (selection && selection.length > 0) file.selection = [...selection];
  return file;
};
const exportDocumentJson = (input) => {
  return `${JSON.stringify(exportDocumentObject(input), null, 2)}
`;
};
const importDocumentJson = (text) => {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new ValidationError("Invalid JSON", { cause });
  }
  if (!parsed || typeof parsed !== "object") {
    throw new ValidationError("Document must be a JSON object");
  }
  const record = parsed;
  if (record.format !== PLANA_DOCUMENT_FORMAT) {
    throw new ValidationError(`Unsupported document format: ${String(record.format)}`);
  }
  if (record.version !== PLANA_DOCUMENT_VERSION) {
    throw new ValidationError(`Unsupported document version: ${String(record.version)}`);
  }
  if (!("world" in record)) {
    throw new ValidationError("Document is missing world");
  }
  const world = validateWorld(record.world);
  let selection = [];
  if (record.selection !== void 0) {
    if (!Array.isArray(record.selection) || !record.selection.every((id) => typeof id === "string")) {
      throw new ValidationError("Document selection must be an array of strings");
    }
    selection = record.selection;
  }
  let meta;
  if (record.meta !== void 0) {
    if (!record.meta || typeof record.meta !== "object") {
      throw new ValidationError("Document meta must be an object");
    }
    meta = record.meta;
  }
  return { world, selection, meta };
};

const id = (prefix) => {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${suffix}`;
};

const createBoxObject = (options = {}) => {
  const {
    id: nodeId = id("box"),
    name = "Box",
    tag = "furniture",
    style = {
      color: "#b8956a",
      roughness: 0.7,
      metalness: 0.05
    },
    x = 0,
    y = 0.4,
    z = 0,
    width = 0.8,
    height = 0.8,
    depth = 0.8
  } = options;
  return {
    kind: "independent",
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
    shape: { kind: "box" }
  };
};

const createWallObject = (options = {}) => {
  const {
    id: nodeId = id("wall"),
    name = "Wall",
    tag = "wall",
    style = {
      color: "#d8cfc4",
      roughness: 0.85,
      metalness: 0.02
    },
    thickness = 0.2,
    height = 2.7,
    length = 4,
    path = {
      start: { x: -length / 2, z: 0 },
      segments: [{ kind: "line", to: { x: length / 2, z: 0 } }]
    },
    x = 0,
    y = height / 2,
    z = 0
  } = options;
  return {
    kind: "independent",
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
      kind: "wall",
      thickness,
      path
    }
  };
};

const createRoomApartment = (options = {}) => {
  const { width = 5, depth = 4, height = 2.7, wallThickness = 0.2, id: aptId = id("apt"), name = "Room" } = options;
  const halfW = width / 2;
  const halfD = depth / 2;
  const wallY = height / 2;
  const north = createWallObject({
    id: id("wall"),
    name: "North wall",
    length: width,
    height,
    thickness: wallThickness,
    x: 0,
    y: wallY,
    z: -halfD,
    path: {
      start: { x: -halfW, z: 0 },
      segments: [{ kind: "line", to: { x: halfW, z: 0 } }]
    }
  });
  const south = createWallObject({
    id: id("wall"),
    name: "South wall",
    length: width,
    height,
    thickness: wallThickness,
    x: 0,
    y: wallY,
    z: halfD,
    path: {
      start: { x: -halfW, z: 0 },
      segments: [{ kind: "line", to: { x: halfW, z: 0 } }]
    }
  });
  const west = createWallObject({
    id: id("wall"),
    name: "West wall",
    length: depth,
    height,
    thickness: wallThickness,
    x: -halfW,
    y: wallY,
    z: 0,
    path: {
      start: { x: 0, z: -halfD },
      segments: [{ kind: "line", to: { x: 0, z: halfD } }]
    }
  });
  const east = createWallObject({
    id: id("wall"),
    name: "East wall",
    length: depth,
    height,
    thickness: wallThickness,
    x: halfW,
    y: wallY,
    z: 0,
    path: {
      start: { x: 0, z: -halfD },
      segments: [{ kind: "line", to: { x: 0, z: halfD } }]
    }
  });
  const floor = createBoxObject({
    id: id("floor"),
    name: "Floor",
    tag: "floor",
    x: 0,
    y: 0.05,
    z: 0,
    width,
    height: 0.1,
    depth,
    style: {
      color: "#8b7355",
      roughness: 0.9,
      metalness: 0.02
    }
  });
  const zone = {
    kind: "zone",
    id: id("zone"),
    name: "Main",
    tag: "room",
    x: 0,
    y: 0,
    z: 0,
    width,
    height,
    depth,
    children: [floor, north, south, west, east]
  };
  return {
    kind: "apartment",
    id: aptId,
    name,
    tag: "apartment",
    x: 0,
    y: 0,
    z: 0,
    width,
    height,
    depth,
    children: [zone]
  };
};

const createDemoWorld = () => {
  const apartment = createRoomApartment({
    id: "apt-demo",
    name: "Studio loft",
    width: 6,
    depth: 4.5,
    height: 2.7,
    wallThickness: 0.18
  });
  const zone = apartment.children[0];
  if (zone && zone.kind === "zone") {
    const table = createBoxObject({
      id: id("table"),
      name: "Dining table",
      tag: "furniture",
      x: -1.2,
      y: 0.4,
      z: 0.3,
      width: 1.4,
      height: 0.75,
      depth: 0.85,
      style: {
        color: "#6b4f3a",
        roughness: 0.55,
        metalness: 0.08
      }
    });
    const sofa = createBoxObject({
      id: id("sofa"),
      name: "Sofa",
      tag: "furniture",
      x: 1.5,
      y: 0.4,
      z: -0.8,
      width: 2,
      height: 0.75,
      depth: 0.9,
      style: {
        color: "#4a5d4e",
        roughness: 0.8,
        metalness: 0.02,
        accentColor: "#2f3d32"
      }
    });
    const rug = createBoxObject({
      id: id("rug"),
      name: "Rug",
      tag: "decor",
      x: 0.4,
      y: 0.12,
      z: 0.2,
      width: 2.4,
      height: 0.04,
      depth: 1.6,
      style: {
        color: "#a65d3f",
        roughness: 0.95,
        metalness: 0
      }
    });
    const lamp = createBoxObject({
      id: id("lamp"),
      name: "Floor lamp",
      tag: "furniture",
      x: 2.4,
      y: 0.85,
      z: 1.4,
      width: 0.25,
      height: 1.6,
      depth: 0.25,
      style: {
        color: "#c9b896",
        roughness: 0.4,
        metalness: 0.35,
        accentColor: "#f0e6c8"
      }
    });
    zone.children = [...zone.children, table, sofa, rug, lamp];
  }
  return {
    kind: "world",
    id: "world-demo",
    name: "Demo apartment",
    x: 0,
    y: 0,
    z: 0,
    width: 6,
    height: 2.7,
    depth: 4.5,
    children: [apartment]
  };
};

const WALL_H = 2.47;
const WALL_T = 0.15;
const FLOOR_T = 0.08;
const FLOOR_TOP = FLOOR_T;
const OUTER_W = 6.42;
const OUTER_D = 5.935;
const DEFAULT_DOOR_W = 0.8;
const DEFAULT_DOOR_H = 2.04;
const STYLE_FLOOR = {
  color: "#020617",
  opacity: 0.45,
  outlineColor: "#64748b"
};
const STYLE_WALL = {
  color: "#09090b",
  opacity: 0.25,
  outlineColor: "#e2e8f0"
};
const STYLE_DOOR = {
  color: "#1c1917",
  opacity: 0.3,
  outlineColor: "#f59e0b"
};
const STYLE_WINDOW = {
  color: "#083344",
  opacity: 0.28,
  outlineColor: "#22d3ee"
};
const STYLE_MIRROR = {
  color: "#083344",
  opacity: 0.32,
  outlineColor: "#22d3ee"
};
const STYLE_FURNITURE = {
  color: "#1c1917",
  opacity: 0.35,
  outlineColor: "#d6d3d1"
};
const objectCenterY = (height, bottom = FLOOR_TOP) => bottom + height / 2;
const wallFromSpec = (spec) => {
  const { along, origin, position, length, cutouts = [] } = spec;
  const cx = along === "x" ? origin + length / 2 : position;
  const cz = along === "z" ? origin + length / 2 : position;
  const path = along === "x" ? {
    start: { x: -length / 2, z: 0 },
    segments: [{ kind: "line", to: { x: length / 2, z: 0 } }]
  } : {
    start: { x: 0, z: -length / 2 },
    segments: [{ kind: "line", to: { x: 0, z: length / 2 } }]
  };
  const baked = cutouts.map((c, i) => {
    const bottom = c.kind === "window" ? c.sill ?? 0.8 : 0;
    const yLocal = -WALL_H / 2 + bottom + c.height / 2;
    return {
      id: `${spec.id}-cut-${i}`,
      name: c.kind === "door" ? "Door" : "Window",
      pathOffset: c.offset,
      x: 0,
      y: yLocal,
      z: 0,
      width: c.width,
      height: c.height,
      depth: WALL_T + 0.02
    };
  });
  return {
    kind: "independent",
    id: spec.id,
    name: spec.name,
    tag: "wall",
    style: STYLE_WALL,
    x: cx,
    y: objectCenterY(WALL_H),
    z: cz,
    width: along === "x" ? length : WALL_T,
    height: WALL_H,
    depth: along === "z" ? length : WALL_T,
    shape: {
      kind: "wall",
      thickness: WALL_T,
      path
    },
    cutouts: baked.length ? baked : void 0
  };
};
const doorFill = (spec) => {
  const width = spec.width ?? DEFAULT_DOOR_W;
  const height = spec.height ?? DEFAULT_DOOR_H;
  return {
    kind: "independent",
    id: spec.id,
    name: spec.name,
    tag: "door",
    style: STYLE_DOOR,
    x: spec.x,
    y: objectCenterY(height),
    z: spec.z,
    width: spec.along === "x" ? width : WALL_T,
    height,
    depth: spec.along === "z" ? width : WALL_T,
    shape: { kind: "box" }
  };
};
const windowFill = (spec) => {
  const bottom = FLOOR_TOP + spec.sill;
  return {
    kind: "independent",
    id: spec.id,
    name: spec.name,
    tag: "window",
    style: STYLE_WINDOW,
    x: spec.x,
    y: objectCenterY(spec.height, bottom),
    z: spec.z,
    width: spec.along === "x" ? spec.width : WALL_T,
    height: spec.height,
    depth: spec.along === "z" ? spec.width : WALL_T,
    shape: { kind: "box" }
  };
};
const floorSlab = (opts) => ({
  kind: "independent",
  id: opts.id,
  name: opts.name,
  tag: "floor",
  style: STYLE_FLOOR,
  x: opts.x0 + opts.width / 2,
  y: FLOOR_T / 2,
  z: opts.z0 + opts.depth / 2,
  width: opts.width,
  height: FLOOR_T,
  depth: opts.depth,
  shape: { kind: "box" }
});
const SHELF_OUTER = 0.05;
const SHELF_INNER = 0.016;
const SHELF_CELL = 0.36;
const SHELF_DEPTH = 0.392;
const SHELF_COLS = 5;
const SHELF_ROWS = 5;
const SHELF_SPAN = SHELF_OUTER * 2 + SHELF_INNER * (SHELF_COLS - 1) + SHELF_CELL * SHELF_COLS;
const MIRROR_THICK = 4e-3;
const MIRROR_W = 0.37;
const MIRROR_LOWER_H = 0.37;
const MIRROR_UPPER_H = 0.9;
const MIRROR_LOWER_FROM_FLOOR = 0.27;
const MIRROR_GAP = 0.21;
const buildLivingShelving = (xWest, zNorth) => {
  const depth = SHELF_DEPTH;
  const span = SHELF_SPAN;
  const xCenter = xWest + depth / 2;
  const zCenter = zNorth + span / 2;
  const y0 = FLOOR_TOP;
  const parts = [];
  const pushBoard = (name, cx, cy, cz, width, height, depthBoard, style = STYLE_FURNITURE, tag = "furniture") => {
    parts.push({
      kind: "independent",
      id: id("shelf-part"),
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
      shape: { kind: "box" }
    });
  };
  const horiz = [
    { bottom: y0, thick: SHELF_OUTER, label: "\u043F\u043E\u043B\u043A\u0430 \u043D\u0438\u0437 50" }
  ];
  let yCursor = y0 + SHELF_OUTER;
  for (let row = 0; row < SHELF_ROWS - 1; row++) {
    yCursor += SHELF_CELL;
    horiz.push({ bottom: yCursor, thick: SHELF_INNER, label: `\u043F\u043E\u043B\u043A\u0430 16 #${row + 1}` });
    yCursor += SHELF_INNER;
  }
  yCursor += SHELF_CELL;
  horiz.push({ bottom: yCursor, thick: SHELF_OUTER, label: "\u043F\u043E\u043B\u043A\u0430 \u0432\u0435\u0440\u0445 50" });
  for (const h of horiz) {
    pushBoard(h.label, xCenter, h.bottom + h.thick / 2, zCenter, depth, h.thick, span);
  }
  const sideHeight = span - 2 * SHELF_OUTER;
  const sideCy = y0 + SHELF_OUTER + sideHeight / 2;
  pushBoard("\u0441\u0442\u043E\u0439\u043A\u0430 50 \u0441\u0435\u0432\u0435\u0440", xCenter, sideCy, zNorth + SHELF_OUTER / 2, depth, sideHeight, SHELF_OUTER);
  pushBoard("\u0441\u0442\u043E\u0439\u043A\u0430 50 \u044E\u0433", xCenter, sideCy, zNorth + span - SHELF_OUTER / 2, depth, sideHeight, SHELF_OUTER);
  for (let row = 0; row < SHELF_ROWS; row++) {
    const cellY0 = y0 + SHELF_OUTER + row * (SHELF_CELL + SHELF_INNER);
    const cy = cellY0 + SHELF_CELL / 2;
    for (let col = 0; col < SHELF_COLS - 1; col++) {
      const zBoard = zNorth + SHELF_OUTER + (col + 1) * SHELF_CELL + col * SHELF_INNER;
      pushBoard(
        `\u0441\u0442\u043E\u0439\u043A\u0430 16 r${row + 1}c${col + 1}`,
        xCenter,
        cy,
        zBoard + SHELF_INNER / 2,
        depth,
        SHELF_CELL,
        SHELF_INNER
      );
    }
  }
  const zSouthFace = zNorth + span;
  const mirrorCz = zSouthFace + MIRROR_THICK / 2;
  const lowerBottom = y0 + MIRROR_LOWER_FROM_FLOOR;
  const upperBottom = lowerBottom + MIRROR_LOWER_H + MIRROR_GAP;
  pushBoard(
    "\u0437\u0435\u0440\u043A\u0430\u043B\u043E \u043D\u0438\u0436\u043D\u0435\u0435",
    xCenter,
    lowerBottom + MIRROR_LOWER_H / 2,
    mirrorCz,
    MIRROR_W,
    MIRROR_LOWER_H,
    MIRROR_THICK,
    STYLE_MIRROR,
    "mirror"
  );
  pushBoard(
    "\u0437\u0435\u0440\u043A\u0430\u043B\u043E \u0432\u0435\u0440\u0445\u043D\u0435\u0435",
    xCenter,
    upperBottom + MIRROR_UPPER_H / 2,
    mirrorCz,
    MIRROR_W,
    MIRROR_UPPER_H,
    MIRROR_THICK,
    STYLE_MIRROR,
    "mirror"
  );
  return {
    kind: "composite",
    id: "furniture-shelving-living",
    name: "\u0441\u0442\u0435\u043B\u043B\u0430\u0436 \u0433\u043E\u0441\u0442\u0438\u043D\u0430\u044F",
    tag: "furniture",
    style: STYLE_FURNITURE,
    x: xCenter,
    y: y0 + span / 2,
    z: zCenter,
    width: depth,
    height: span,
    depth: span,
    objects: parts
  };
};
const WALLS = [
  { id: "wall-north", name: "\u0421\u0435\u0432\u0435\u0440", along: "x", origin: 0, position: 0.075, length: 6.42 },
  { id: "wall-south", name: "\u042E\u0433", along: "x", origin: 0, position: 5.86, length: 6.42 },
  {
    id: "wall-west-north",
    name: "\u0417\u0430\u043F\u0430\u0434 (\u043A\u043E\u0440\u0438\u0434\u043E\u0440)",
    along: "z",
    origin: 0,
    position: 0.075,
    length: 2.53,
    cutouts: [{ kind: "door", offset: 1.23, width: 0.8, height: 2.04 }]
  },
  {
    id: "wall-west-living",
    name: "\u0417\u0430\u043F\u0430\u0434 (\u0433\u043E\u0441\u0442\u0438\u043D\u0430\u044F)",
    along: "z",
    origin: 2.53,
    position: 0.075,
    length: 3.405
  },
  {
    id: "wall-east-kitchen",
    name: "\u0412\u043E\u0441\u0442\u043E\u043A (\u043A\u0443\u0445\u043D\u044F)",
    along: "z",
    origin: 0,
    position: 6.345,
    length: 2.53,
    cutouts: [{ kind: "window", offset: 0.29, width: 1.32, height: 1.46, sill: 0.8 }]
  },
  {
    id: "wall-east-living",
    name: "\u0412\u043E\u0441\u0442\u043E\u043A (\u0433\u043E\u0441\u0442\u0438\u043D\u0430\u044F)",
    along: "z",
    origin: 2.53,
    position: 6.345,
    length: 3.405,
    cutouts: [
      { kind: "window", offset: 0.585, width: 1.4, height: 1.46, sill: 0.8 },
      { kind: "door", offset: 1.985, width: 0.7, height: 2.26 }
    ]
  },
  {
    id: "wall-bath-west",
    name: "\u0421/\u0443 \u0437\u0430\u043F\u0430\u0434",
    along: "z",
    origin: 0,
    position: 1.46,
    length: 1.41
  },
  {
    id: "wall-bath-east",
    name: "\u0421/\u0443 \u0432\u043E\u0441\u0442\u043E\u043A",
    along: "z",
    origin: 0,
    position: 3.78,
    length: 1.41
  },
  {
    id: "wall-bath-south",
    name: "\u0421/\u0443 \u044E\u0433",
    along: "x",
    origin: 1.385,
    position: 1.335,
    length: 2.47,
    cutouts: [{ kind: "door", offset: 0.88, width: 0.8, height: 2.04 }]
  },
  {
    id: "wall-partition",
    name: "\u041F\u0435\u0440\u0435\u0433\u043E\u0440\u043E\u0434\u043A\u0430",
    along: "x",
    origin: 0,
    position: 2.53,
    length: 6.42,
    cutouts: [{ kind: "door", offset: 0.575, width: 0.84, height: 2.04 }]
  }
];
const DOORS = [
  { id: "door-entry", name: "\u0434\u0432\u0435\u0440\u044C", x: 0.075, z: 1.63, along: "z" },
  { id: "door-partition", name: "\u0434\u0432\u0435\u0440\u044C", x: 0.995, z: 2.53, along: "x", width: 0.84, height: 2.04 },
  { id: "door-bath", name: "\u0434\u0432\u0435\u0440\u044C", x: 2.665, z: 1.335, along: "x", width: 0.8, height: 2.04 },
  { id: "door-living-east", name: "\u0434\u0432\u0435\u0440\u044C", x: 6.345, z: 4.865, along: "z", width: 0.7, height: 2.26 }
];
const WINDOWS = [
  {
    id: "window-kitchen",
    name: "\u043E\u043A\u043D\u043E",
    x: 6.345,
    z: 0.95,
    along: "z",
    width: 1.32,
    height: 1.46,
    sill: 0.8
  },
  {
    id: "window-living",
    name: "\u043E\u043A\u043D\u043E",
    x: 6.345,
    z: 3.815,
    along: "z",
    width: 1.4,
    height: 1.46,
    sill: 0.8
  }
];
const createFlatWorld = () => {
  const walls = WALLS.map(wallFromSpec);
  const openings = [...DOORS.map(doorFill), ...WINDOWS.map(windowFill)];
  const floorCorridorA = floorSlab({
    id: "floor-corridor-a",
    name: "\u041F\u043E\u043B \u043A\u043E\u0440\u0438\u0434\u043E\u0440",
    x0: 0.15,
    z0: 0.15,
    width: 1.235,
    depth: 2.305
  });
  const floorCorridorB = floorSlab({
    id: "floor-corridor-b",
    name: "\u041F\u043E\u043B \u043A\u043E\u0440\u0438\u0434\u043E\u0440 (\u0440\u0443\u043A\u0430\u0432)",
    x0: 1.385,
    z0: 1.41,
    width: 2.47,
    depth: 1.045
  });
  const floorBath = floorSlab({
    id: "floor-bath",
    name: "\u041F\u043E\u043B \u0441/\u0443",
    x0: 1.535,
    z0: 0.15,
    width: 2.17,
    depth: 1.11
  });
  const floorKitchen = floorSlab({
    id: "floor-kitchen",
    name: "\u041F\u043E\u043B \u043A\u0443\u0445\u043D\u044F",
    x0: 3.855,
    z0: 0.15,
    width: 2.415,
    depth: 2.305
  });
  const floorLiving = floorSlab({
    id: "floor-living",
    name: "\u041F\u043E\u043B \u0433\u043E\u0441\u0442\u0438\u043D\u0430\u044F",
    x0: 0.15,
    z0: 2.605,
    width: 6.12,
    depth: 3.18
  });
  const shelving = buildLivingShelving(3.633, 2.605);
  const zoneCorridor = zoneWithLocalChildren(
    {
      kind: "zone",
      id: "zone-corridor",
      name: "\u041A\u043E\u0440\u0438\u0434\u043E\u0440",
      tag: "room",
      x: 0.15 + 1.235 / 2,
      y: 0,
      z: 0.15 + 2.305 / 2,
      width: 1.235,
      height: WALL_H,
      depth: 2.305,
      footprint: {
        kind: "polygon",
        points: [
          { x: -1.235 / 2, z: -2.305 / 2 },
          { x: 1.235 / 2, z: -2.305 / 2 },
          { x: 1.235 / 2, z: 2.305 / 2 },
          { x: -1.235 / 2, z: 2.305 / 2 }
        ]
      },
      children: []
    },
    [floorCorridorA, floorCorridorB]
  );
  const zoneBath = zoneWithLocalChildren(
    {
      kind: "zone",
      id: "zone-bath",
      name: "\u0421\u0430\u043D-\u0443\u0437\u0435\u043B",
      tag: "room",
      x: 1.535 + 2.17 / 2,
      y: 0,
      z: 0.15 + 1.11 / 2,
      width: 2.17,
      height: WALL_H,
      depth: 1.11,
      children: []
    },
    [floorBath]
  );
  const zoneKitchen = zoneWithLocalChildren(
    {
      kind: "zone",
      id: "zone-kitchen",
      name: "\u041A\u0443\u0445\u043D\u044F",
      tag: "room",
      x: 3.855 + 2.415 / 2,
      y: 0,
      z: 0.15 + 2.305 / 2,
      width: 2.415,
      height: WALL_H,
      depth: 2.305,
      children: []
    },
    [floorKitchen]
  );
  const zoneLiving = zoneWithLocalChildren(
    {
      kind: "zone",
      id: "zone-living",
      name: "\u0413\u043E\u0441\u0442\u0438\u043D\u0430\u044F",
      tag: "room",
      x: 0.15 + 6.12 / 2,
      y: 0,
      z: 2.605 + 3.18 / 2,
      width: 6.12,
      height: WALL_H,
      depth: 3.18,
      children: []
    },
    [floorLiving, shelving]
  );
  const aptX = OUTER_W / 2;
  const aptZ = OUTER_D / 2;
  const apartment = {
    kind: "apartment",
    id: "apt-flat",
    name: "\u041A\u0432\u0430\u0440\u0442\u0438\u0440\u0430",
    tag: "apartment",
    x: aptX,
    y: 0,
    z: aptZ,
    width: OUTER_W,
    height: WALL_H + FLOOR_TOP,
    depth: OUTER_D,
    footprint: {
      kind: "polygon",
      points: [
        { x: -OUTER_W / 2, z: -OUTER_D / 2 },
        { x: OUTER_W / 2, z: -OUTER_D / 2 },
        { x: OUTER_W / 2, z: OUTER_D / 2 },
        { x: -OUTER_W / 2, z: OUTER_D / 2 }
      ]
    },
    children: [
      {
        kind: "group",
        id: "group-walls",
        name: "\u0421\u0442\u0435\u043D\u044B",
        tag: "walls",
        style: STYLE_WALL,
        x: 0,
        y: 0,
        z: 0,
        width: OUTER_W,
        height: WALL_H + FLOOR_TOP,
        depth: OUTER_D,
        children: walls.map((w) => toParentLocal(w, aptX, aptZ))
      },
      {
        kind: "group",
        id: "group-openings",
        name: "\u041F\u0440\u043E\u0451\u043C\u044B",
        tag: "openings",
        x: 0,
        y: 0,
        z: 0,
        width: OUTER_W,
        height: WALL_H + FLOOR_TOP,
        depth: OUTER_D,
        children: openings.map((o) => toParentLocal(o, aptX, aptZ))
      },
      toParentLocal(zoneCorridor, aptX, aptZ),
      toParentLocal(zoneBath, aptX, aptZ),
      toParentLocal(zoneKitchen, aptX, aptZ),
      toParentLocal(zoneLiving, aptX, aptZ)
    ]
  };
  return {
    kind: "world",
    id: "world-flat",
    name: "\u041A\u0432\u0430\u0440\u0442\u0438\u0440\u0430 (~33 \u043C\xB2)",
    x: 0,
    y: 0,
    z: 0,
    width: OUTER_W,
    height: WALL_H + FLOOR_TOP,
    depth: OUTER_D,
    children: [apartment]
  };
};
const zoneWithLocalChildren = (zone, children) => ({
  ...zone,
  children: children.map((c) => toParentLocal(c, zone.x, zone.z))
});
const toParentLocal = (node, parentX, parentZ) => ({
  ...node,
  x: node.x - parentX,
  z: node.z - parentZ
});

const PlanaContext = React__namespace.createContext(null);
function PlanaProvider(props) {
  const { document: documentProp, world, children } = props;
  const [owned] = React__namespace.useState(() => createDocument(world ? { world } : void 0));
  const document = documentProp ?? owned;
  const value = React__namespace.useMemo(() => ({ document }), [document]);
  return /* @__PURE__ */ React__namespace.createElement(PlanaContext.Provider, { value }, children);
}

function usePlanaDocument() {
  const ctx = React__namespace.useContext(PlanaContext);
  if (!ctx) {
    throw new Error("usePlanaDocument must be used within a PlanaProvider");
  }
  return ctx.document;
}
function usePlanaWorld() {
  const document = usePlanaDocument();
  return React__namespace.useSyncExternalStore(
    (onStoreChange) => document.subscribe(() => onStoreChange()),
    () => document.getWorld(),
    () => document.getWorld()
  );
}
function usePlanaSelection() {
  const document = usePlanaDocument();
  return React__namespace.useSyncExternalStore(
    (onStoreChange) => document.subscribe(() => onStoreChange()),
    () => document.getSelection(),
    () => document.getSelection()
  );
}
function usePlanaDispatch() {
  const document = usePlanaDocument();
  return (command) => document.dispatch(command);
}

const toMm = (meters) => Math.round(Math.abs(meters) * 1e3);
const formatDims = (solid) => {
  const node = solid.object;
  const w = toMm(node.width);
  const h = toMm(node.height);
  const d = toMm(node.depth);
  if (node.tag === "wall" || node.shape?.kind === "wall") {
    const length = Math.max(w, d);
    const thickness = Math.min(w, d);
    return `L ${length} \xB7 H ${h} \xB7 T ${thickness}`;
  }
  return `W ${w} \xB7 H ${h} \xB7 D ${d}`;
};
function DimLabel(props) {
  const { solid, emphasis = false } = props;
  const position = React__namespace.useMemo(() => {
    const m = new THREE__namespace.Matrix4().fromArray(solid.worldMatrix);
    const origin = new THREE__namespace.Vector3().setFromMatrixPosition(m);
    return [origin.x, origin.y + solid.object.height * 0.5 + 0.12, origin.z];
  }, [solid]);
  return /* @__PURE__ */ React__namespace.createElement(drei.Html, { position, center: true, sprite: true, zIndexRange: [100, 0], style: { pointerEvents: "none" } }, /* @__PURE__ */ React__namespace.createElement("div", { className: emphasis ? "plana-dim plana-dim--emphasis" : "plana-dim" }, formatDims(solid)));
}
function PlanaDimensions(props) {
  const { world, selection, mode } = props;
  const solids = React__namespace.useMemo(() => {
    if (mode === "off") return [];
    const all = buildWorldSolids(world).filter((s) => resolveStyle(s.object).visible !== false);
    if (mode === "all") return all;
    if (selection.ids.length === 0) return [];
    const selected = new Set(selection.ids);
    return all.filter((s) => s.object.id && selected.has(s.object.id));
  }, [world, selection.ids, mode]);
  const selectedSet = React__namespace.useMemo(() => new Set(selection.ids), [selection.ids]);
  if (mode === "off") return null;
  if (mode === "selection" && solids.length === 0) {
    return /* @__PURE__ */ React__namespace.createElement(
      drei.Html,
      {
        position: [0, 0.5, 0],
        center: true,
        sprite: true,
        zIndexRange: [100, 0],
        style: { pointerEvents: "none" }
      },
      /* @__PURE__ */ React__namespace.createElement("div", { className: "plana-dim plana-dim--hint" }, "Select an object")
    );
  }
  if (solids.length === 0) return null;
  return /* @__PURE__ */ React__namespace.createElement("group", null, solids.map((solid, index) => /* @__PURE__ */ React__namespace.createElement(
    DimLabel,
    {
      key: solid.object.id ?? `dim-${index}`,
      solid,
      emphasis: !!solid.object.id && selectedSet.has(solid.object.id)
    }
  )));
}

const HATCH_STEP = 0.75;
const HATCH_EDGE_OPACITY = 0.14;
const HATCH_ELEVATIONS = false;
const pushLine = (positions, ax, ay, az, bx, by, bz) => {
  positions.push(ax, ay, az, bx, by, bz);
};
const clipUvDiagonal = (u0, u1, v0, v1, sum) => {
  const pts = [];
  const add = (u, v) => {
    if (u >= u0 - 1e-9 && u <= u1 + 1e-9 && v >= v0 - 1e-9 && v <= v1 + 1e-9) {
      const key = `${u.toFixed(5)},${v.toFixed(5)}`;
      if (!pts.some((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}` === key)) {
        pts.push([u, v]);
      }
    }
  };
  add(u0, sum - u0);
  add(u1, sum - u1);
  add(sum - v0, v0);
  add(sum - v1, v1);
  if (pts.length < 2) return null;
  return [pts[0], pts[pts.length - 1]];
};
const hatchFaceLocal = (positions, u0, u1, v0, v1, map, step) => {
  const lo = Math.min(u0, u1);
  const hi = Math.max(u0, u1);
  const vlo = Math.min(v0, v1);
  const vhi = Math.max(v0, v1);
  if (hi - lo < 1e-6 || vhi - vlo < 1e-6) return;
  const kMin = Math.floor((lo + vlo) / step);
  const kMax = Math.ceil((hi + vhi) / step);
  for (let k = kMin; k <= kMax; k++) {
    const seg = clipUvDiagonal(lo, hi, vlo, vhi, k * step);
    if (!seg) continue;
    const a = map(seg[0][0], seg[0][1]);
    const b = map(seg[1][0], seg[1][1]);
    pushLine(positions, a[0], a[1], a[2], b[0], b[1], b[2]);
  }
};
const solidElevationRects = (length, height, wallYMin, cutouts) => {
  const sorted = [...cutouts].filter((c) => c.pathOffset != null).sort((a, b) => (a.pathOffset ?? 0) - (b.pathOffset ?? 0));
  const rects = [];
  let cursor = 0;
  for (const cutout of sorted) {
    const offset = cutout.pathOffset ?? 0;
    const sill = cutout.y - cutout.height / 2 - wallYMin;
    if (offset - cursor > 1e-6) {
      rects.push({ u0: cursor, u1: offset, v0: 0, v1: height });
    }
    if (sill > 1e-6) {
      rects.push({
        u0: offset,
        u1: offset + cutout.width,
        v0: 0,
        v1: Math.min(height, sill)
      });
    }
    const top = sill + cutout.height;
    if (height - top > 1e-6) {
      rects.push({
        u0: offset,
        u1: offset + cutout.width,
        v0: Math.max(0, top),
        v1: height
      });
    }
    cursor = offset + cutout.width;
  }
  if (length - cursor > 1e-6) {
    rects.push({ u0: cursor, u1: length, v0: 0, v1: height });
  }
  return rects;
};
const appendHatchBoxLocal = (positions, bounds, tag, step, elevations) => {
  const hw = bounds.width / 2;
  const hh = bounds.height / 2;
  const hd = bounds.depth / 2;
  const x0 = -hw;
  const x1 = hw;
  const y0 = -hh;
  const y1 = hh;
  const z0 = -hd;
  const z1 = hd;
  hatchFaceLocal(positions, x0, x1, z0, z1, (u, v) => [u, y1, v], step);
  if (!elevations || tag === "floor") return;
  if (bounds.width >= bounds.depth) {
    hatchFaceLocal(positions, x0, x1, y0, y1, (u, v) => [u, v, z1], step);
    hatchFaceLocal(positions, x0, x1, y0, y1, (u, v) => [u, v, z0], step);
  } else {
    hatchFaceLocal(positions, z0, z1, y0, y1, (u, v) => [x1, v, u], step);
    hatchFaceLocal(positions, z0, z1, y0, y1, (u, v) => [x0, v, u], step);
  }
};
const appendHatchCutoutWallLocal = (positions, bounds, cutouts, step, elevations) => {
  const axis = bounds.width >= bounds.depth ? "x" : "z";
  const length = axis === "x" ? bounds.width : bounds.depth;
  const thickness = axis === "x" ? bounds.depth : bounds.width;
  const height = bounds.height;
  const hh = height / 2;
  const ht = thickness / 2;
  const wallYMin = -hh;
  if (axis === "x") {
    const x0 = -length / 2;
    const x1 = length / 2;
    hatchFaceLocal(positions, x0, x1, -ht, ht, (u, v) => [u, hh, v], step);
  } else {
    const z0 = -length / 2;
    const z1 = length / 2;
    hatchFaceLocal(positions, -ht, ht, z0, z1, (u, v) => [u, hh, v], step);
  }
  if (!elevations) return;
  const rects = solidElevationRects(length, height, wallYMin, cutouts);
  for (const rect of rects) {
    const vA = wallYMin + rect.v0;
    const vB = wallYMin + rect.v1;
    if (axis === "x") {
      const xA = -length / 2 + rect.u0;
      const xB = -length / 2 + rect.u1;
      hatchFaceLocal(positions, xA, xB, vA, vB, (u, v) => [u, v, ht], step);
      hatchFaceLocal(positions, xA, xB, vA, vB, (u, v) => [u, v, -ht], step);
    } else {
      const zA = -length / 2 + rect.u0;
      const zB = -length / 2 + rect.u1;
      hatchFaceLocal(positions, zA, zB, vA, vB, (u, v) => [ht, v, u], step);
      hatchFaceLocal(positions, zA, zB, vA, vB, (u, v) => [-ht, v, u], step);
    }
  }
};
const appendHatchLocal = (positions, bounds, tag, cutouts, stepOrOptions = HATCH_STEP) => {
  if (bounds.width < 1e-6 || bounds.height < 1e-6 || bounds.depth < 1e-6) return;
  const opts = typeof stepOrOptions === "number" ? { step: stepOrOptions } : stepOrOptions;
  const step = opts.step ?? HATCH_STEP;
  const elevations = opts.elevations ?? HATCH_ELEVATIONS;
  const pathCutouts = (cutouts ?? []).filter((c) => c.pathOffset != null);
  if (tag === "wall" && pathCutouts.length > 0) {
    appendHatchCutoutWallLocal(positions, bounds, pathCutouts, step, elevations);
    return;
  }
  appendHatchBoxLocal(positions, bounds, tag, step, elevations);
};
const buildWorldHatchGeometry = (items, stepOrOptions = HATCH_STEP) => {
  const opts = typeof stepOrOptions === "number" ? { step: stepOrOptions } : stepOrOptions;
  const positions = [];
  const colors = [];
  const color = new THREE__namespace.Color();
  for (const item of items) {
    const local = [];
    appendHatchLocal(local, item.bounds, item.tag, item.cutouts, opts);
    if (local.length === 0) continue;
    try {
      color.set(item.edgeColor);
    } catch {
      color.set("#a3a3a3");
    }
    const r = color.r;
    const g = color.g;
    const b = color.b;
    for (let i = 0; i < local.length; i += 3) {
      const p = mat4TransformPoint(item.worldMatrix, {
        x: local[i],
        y: local[i + 1],
        z: local[i + 2]
      });
      positions.push(p.x, p.y, p.z);
      colors.push(r, g, b);
    }
  }
  const geometry = new THREE__namespace.BufferGeometry();
  geometry.setAttribute("position", new THREE__namespace.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE__namespace.Float32BufferAttribute(colors, 3));
  return geometry;
};

const meshToBufferGeometry = (mesh) => {
  const geometry = new THREE__namespace.BufferGeometry();
  geometry.setAttribute("position", new THREE__namespace.Float32BufferAttribute(mesh.positions, 3));
  if (mesh.normals && mesh.normals.length === mesh.positions.length) {
    geometry.setAttribute("normal", new THREE__namespace.Float32BufferAttribute(mesh.normals, 3));
  } else {
    geometry.computeVertexNormals();
  }
  if (mesh.uvs && mesh.uvs.length > 0) {
    geometry.setAttribute("uv", new THREE__namespace.Float32BufferAttribute(mesh.uvs, 2));
  }
  if (mesh.indices && mesh.indices.length > 0) {
    geometry.setIndex(mesh.indices);
  }
  geometry.computeBoundingSphere();
  return geometry;
};

const TAG_VISUAL = {
  floor: { fill: "#020617", opacity: 0.45, edge: "#64748b" },
  wall: { fill: "#09090b", opacity: 0.25, edge: "#e2e8f0" },
  door: { fill: "#1c1917", opacity: 0.3, edge: "#f59e0b" },
  window: { fill: "#083344", opacity: 0.28, edge: "#22d3ee" },
  mirror: { fill: "#083344", opacity: 0.32, edge: "#22d3ee" },
  furniture: { fill: "#1c1917", opacity: 0.35, edge: "#d6d3d1" }
};
const RENDER_FLOOR = 0;
const RENDER_FILL = 1;
const RENDER_EDGE = 2;
const RENDER_HATCH = 3;
const FLOOR_Y_BIAS = -1e-3;
const EDGE_THRESHOLD_DEG = 30;
const brightenHex = (hex, amount = 0.35) => {
  try {
    const c = new THREE__namespace.Color(hex);
    c.offsetHSL(0, 0, amount);
    return `#${c.getHexString()}`;
  } catch {
    return hex;
  }
};
const edgeColorFor = (solid) => {
  const node = solid.object;
  const style = resolveStyle(node);
  const tagVisual = TAG_VISUAL[node.tag ?? ""];
  return node.style?.outlineColor ?? tagVisual?.edge ?? style.outlineColor;
};
const SolidMesh = React__namespace.memo(function SolidMesh2(props) {
  const { solid, selected, onSelect } = props;
  const node = solid.object;
  const style = resolveStyle(node);
  const tag = node.tag ?? "";
  const tagVisual = TAG_VISUAL[tag];
  const geometry = React__namespace.useMemo(() => meshToBufferGeometry(solid.worldSolid), [solid.worldSolid]);
  const edges = React__namespace.useMemo(
    () => new THREE__namespace.EdgesGeometry(geometry, EDGE_THRESHOLD_DEG),
    [geometry]
  );
  React__namespace.useEffect(() => {
    return () => {
      geometry.dispose();
      edges.dispose();
    };
  }, [geometry, edges]);
  if (!style.visible) return null;
  const position = geometry.getAttribute("position");
  if (!position || position.count === 0) return null;
  const color = node.style?.color ?? tagVisual?.fill ?? style.color;
  const baseOpacity = node.style?.opacity ?? tagVisual?.opacity ?? style.opacity;
  const edgeColor = edgeColorFor(solid);
  const opacity = selected ? Math.min(1, baseOpacity + 0.12) : baseOpacity;
  const outline = selected ? brightenHex(edgeColor, 0.28) : edgeColor;
  const doubleSide = tag === "wall";
  const isFloor = tag === "floor";
  const fillOrder = isFloor ? RENDER_FLOOR : RENDER_FILL;
  const handleClick = (event) => {
    event.stopPropagation();
    if (!style.selectable) return;
    onSelect(node.id, event.nativeEvent.shiftKey);
  };
  return /* @__PURE__ */ React__namespace.createElement("group", { position: isFloor ? [0, FLOOR_Y_BIAS, 0] : void 0 }, /* @__PURE__ */ React__namespace.createElement(
    "mesh",
    {
      geometry,
      onClick: handleClick,
      userData: { nodeId: node.id },
      renderOrder: fillOrder
    },
    /* @__PURE__ */ React__namespace.createElement(
      "meshBasicMaterial",
      {
        color,
        opacity,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        polygonOffset: isFloor,
        polygonOffsetFactor: isFloor ? 1 : 0,
        polygonOffsetUnits: isFloor ? 1 : 0,
        side: doubleSide ? THREE__namespace.DoubleSide : THREE__namespace.FrontSide
      }
    )
  ), /* @__PURE__ */ React__namespace.createElement("lineSegments", { geometry: edges, renderOrder: RENDER_EDGE, frustumCulled: false }, /* @__PURE__ */ React__namespace.createElement(
    "lineBasicMaterial",
    {
      color: outline,
      depthTest: true,
      polygonOffset: isFloor,
      polygonOffsetFactor: isFloor ? 1 : 0
    }
  )));
});
function WorldHatch(props) {
  const { solids } = props;
  const hatch = React__namespace.useMemo(() => {
    const items = solids.filter((s) => resolveStyle(s.object).visible !== false).map((s) => {
      const node = s.object;
      return {
        bounds: {
          width: node.width,
          height: node.height,
          depth: node.depth
        },
        worldMatrix: s.worldMatrix,
        tag: node.tag,
        cutouts: node.cutouts,
        edgeColor: edgeColorFor(s)
      };
    });
    return buildWorldHatchGeometry(items, { step: HATCH_STEP, elevations: false });
  }, [solids]);
  React__namespace.useEffect(() => () => hatch.dispose(), [hatch]);
  const count = hatch.getAttribute("position")?.count ?? 0;
  if (count === 0) return null;
  return /* @__PURE__ */ React__namespace.createElement("lineSegments", { geometry: hatch, renderOrder: RENDER_HATCH, frustumCulled: false, raycast: () => null }, /* @__PURE__ */ React__namespace.createElement(
    "lineBasicMaterial",
    {
      vertexColors: true,
      transparent: true,
      opacity: HATCH_EDGE_OPACITY,
      depthWrite: false
    }
  ));
}
function PlanaWorldMesh(props) {
  const { world, selection, onSelect, showHatch = false } = props;
  const solids = React__namespace.useMemo(() => buildWorldSolids(world), [world]);
  const selectedSet = React__namespace.useMemo(() => new Set(selection.ids), [selection.ids]);
  return /* @__PURE__ */ React__namespace.createElement("group", null, solids.map((solid, index) => {
    const sid = solid.object.id ?? `solid-${index}`;
    return /* @__PURE__ */ React__namespace.createElement(
      SolidMesh,
      {
        key: sid,
        solid,
        selected: solid.object.id ? selectedSet.has(solid.object.id) : false,
        onSelect
      }
    );
  }), showHatch ? /* @__PURE__ */ React__namespace.createElement(WorldHatch, { solids }) : null);
}

const SCENE_BG = "#09090b";
const CAM_X = 3.21;
const CAM_Z = 2.9675;
function PlanaCanvas(props) {
  const {
    className,
    showGrid = true,
    target = [CAM_X, 0.2, CAM_Z],
    dimensionsMode = "off",
    showHatch = false,
    canvasProps,
    children
  } = props;
  const world = usePlanaWorld();
  const selection = usePlanaSelection();
  const dispatch = usePlanaDispatch();
  const onSelect = React__namespace.useCallback(
    (id, additive) => {
      if (!id) {
        dispatch({ type: "setSelection", ids: [] });
        return;
      }
      const node = findNodeById(world, id);
      if (!node) return;
      if (!resolveStyle(node).selectable) return;
      if (additive) {
        const has = selection.ids.includes(id);
        const next = has ? selection.ids.filter((x) => x !== id) : [...selection.ids, id];
        dispatch({ type: "setSelection", ids: next });
      } else {
        dispatch({ type: "setSelection", ids: [id] });
      }
    },
    [dispatch, selection.ids, world]
  );
  return /* @__PURE__ */ React__namespace.createElement(
    fiber.Canvas,
    {
      className,
      shadows: false,
      dpr: 1,
      gl: {
        antialias: true,
        alpha: false,
        powerPreference: "high-performance"
      },
      camera: { position: [CAM_X, 10, CAM_Z], fov: 40, near: 0.1, far: 100 },
      onCreated: ({ gl, scene }) => {
        gl.setClearColor(new THREE__namespace.Color(SCENE_BG), 1);
        scene.background = new THREE__namespace.Color(SCENE_BG);
      },
      onPointerMissed: () => dispatch({ type: "setSelection", ids: [] }),
      style: { width: "100%", height: "100%", display: "block", background: SCENE_BG },
      ...canvasProps
    },
    /* @__PURE__ */ React__namespace.createElement("color", { attach: "background", args: [SCENE_BG] }),
    /* @__PURE__ */ React__namespace.createElement("fog", { attach: "fog", args: [SCENE_BG, 36, 70] }),
    /* @__PURE__ */ React__namespace.createElement("ambientLight", { intensity: 0.7 }),
    /* @__PURE__ */ React__namespace.createElement("directionalLight", { intensity: 0.45, position: [6, 20, 4] }),
    showGrid ? /* @__PURE__ */ React__namespace.createElement("gridHelper", { args: [10, 10, "#1f2937", "#111827"], position: [CAM_X, 1e-3, CAM_Z] }) : null,
    /* @__PURE__ */ React__namespace.createElement(
      PlanaWorldMesh,
      {
        world,
        selection,
        onSelect,
        showHatch
      }
    ),
    /* @__PURE__ */ React__namespace.createElement(PlanaDimensions, { world, selection, mode: dimensionsMode }),
    children,
    /* @__PURE__ */ React__namespace.createElement(
      drei.OrbitControls,
      {
        makeDefault: true,
        target,
        maxPolarAngle: Math.PI / 2.05,
        minDistance: 2,
        maxDistance: 24
      }
    )
  );
}

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 480;
const SIDEBAR_STORAGE_VERSION = 2;
const clampWidth = (value) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(value)));
const isSaneStored = (parsed) => {
  if (parsed.v !== SIDEBAR_STORAGE_VERSION) return false;
  if (typeof parsed.width !== "number" || !Number.isFinite(parsed.width)) return false;
  if (parsed.width < SIDEBAR_MIN || parsed.width > SIDEBAR_MAX) return false;
  if (typeof parsed.collapsed !== "boolean") return false;
  return true;
};
const readStored = (key, fallback) => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!isSaneStored(parsed)) {
      window.localStorage.removeItem(key);
      return fallback;
    }
    return {
      width: clampWidth(parsed.width),
      collapsed: parsed.collapsed,
      v: SIDEBAR_STORAGE_VERSION
    };
  } catch {
    return fallback;
  }
};
const writeStored = (key, value) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({ ...value, v: SIDEBAR_STORAGE_VERSION })
    );
  } catch {
  }
};
function useSidebarState(storageKey, defaultWidth) {
  const [state, setState] = React__namespace.useState(
    () => readStored(storageKey, {
      width: clampWidth(defaultWidth),
      collapsed: false,
      v: SIDEBAR_STORAGE_VERSION
    })
  );
  React__namespace.useEffect(() => {
    writeStored(storageKey, state);
  }, [storageKey, state]);
  const setWidth = React__namespace.useCallback((width) => {
    setState((prev) => {
      const next = clampWidth(width);
      if (prev.width === next) return prev;
      return { ...prev, width: next, collapsed: false };
    });
  }, []);
  const setCollapsed = React__namespace.useCallback((collapsed) => {
    setState((prev) => prev.collapsed === collapsed ? prev : { ...prev, collapsed });
  }, []);
  const toggleCollapsed = React__namespace.useCallback(() => {
    setState((prev) => ({ ...prev, collapsed: !prev.collapsed }));
  }, []);
  return {
    width: state.width,
    collapsed: state.collapsed,
    setWidth,
    setCollapsed,
    toggleCollapsed,
    minWidth: SIDEBAR_MIN,
    maxWidth: SIDEBAR_MAX
  };
}
function ChevronIcon() {
  return /* @__PURE__ */ React__namespace.createElement("svg", { width: "12", height: "12", viewBox: "0 0 12 12", "aria-hidden": "true" }, /* @__PURE__ */ React__namespace.createElement(
    "path",
    {
      d: "M4.5 2.5L8 6L4.5 9.5",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.5",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }
  ));
}
function EditorSidebar(props) {
  const { title, side, width, collapsed, onWidthChange, onToggleCollapsed, children } = props;
  const drag = React__namespace.useRef(null);
  React__namespace.useEffect(() => {
    const onMove = (event) => {
      const active = drag.current;
      if (!active) return;
      const delta = event.clientX - active.startX;
      const next = side === "left" ? active.startWidth + delta : active.startWidth - delta;
      onWidthChange(next);
    };
    const onUp = () => {
      drag.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [onWidthChange, side]);
  const startResize = (event) => {
    event.preventDefault();
    drag.current = { startX: event.clientX, startWidth: width };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };
  const className = ["plana-panel", collapsed ? "plana-panel--collapsed" : ""].filter(Boolean).join(" ");
  const panelStyle = collapsed ? {
    width: "var(--pe-sidebar-rail)",
    flex: "0 0 var(--pe-sidebar-rail)",
    minWidth: "var(--pe-sidebar-rail)",
    maxWidth: "var(--pe-sidebar-rail)"
  } : {
    width,
    flex: `0 0 ${width}px`,
    minWidth: width,
    maxWidth: width
  };
  return /* @__PURE__ */ React__namespace.createElement("aside", { className, style: panelStyle }, /* @__PURE__ */ React__namespace.createElement("div", { className: "plana-panel__rail", hidden: !collapsed }, /* @__PURE__ */ React__namespace.createElement(
    "button",
    {
      type: "button",
      className: "plana-btn plana-btn--icon",
      "aria-label": `Expand ${title}`,
      title: `Expand ${title}`,
      onClick: onToggleCollapsed
    },
    /* @__PURE__ */ React__namespace.createElement(ChevronIcon, null)
  ), /* @__PURE__ */ React__namespace.createElement("span", { className: "plana-panel__rail-label" }, title)), /* @__PURE__ */ React__namespace.createElement("div", { className: "plana-panel__header", hidden: collapsed }, /* @__PURE__ */ React__namespace.createElement("div", { className: "plana-panel__title" }, title), /* @__PURE__ */ React__namespace.createElement(
    "button",
    {
      type: "button",
      className: "plana-btn plana-btn--icon",
      "aria-label": `Collapse ${title}`,
      title: `Collapse ${title}`,
      onClick: onToggleCollapsed
    },
    /* @__PURE__ */ React__namespace.createElement(
      "span",
      {
        style: {
          display: "inline-flex",
          transform: side === "left" ? "scaleX(-1)" : void 0
        }
      },
      /* @__PURE__ */ React__namespace.createElement(ChevronIcon, null)
    )
  )), /* @__PURE__ */ React__namespace.createElement(
    "div",
    {
      className: collapsed ? "plana-panel__body plana-panel__body--parked" : "plana-panel__body",
      hidden: collapsed,
      "aria-hidden": collapsed
    },
    children
  ), !collapsed ? /* @__PURE__ */ React__namespace.createElement(
    "div",
    {
      className: `plana-panel__resize plana-panel__resize--${side}`,
      onPointerDown: startResize,
      role: "separator",
      "aria-orientation": "vertical",
      "aria-label": `Resize ${title}`
    }
  ) : null);
}
function CollapsibleSection(props) {
  const { title, defaultOpen = true, children } = props;
  const [open, setOpen] = React__namespace.useState(defaultOpen);
  return /* @__PURE__ */ React__namespace.createElement("section", { className: "plana-section" }, /* @__PURE__ */ React__namespace.createElement(
    "button",
    {
      type: "button",
      className: "plana-section__header",
      "aria-expanded": open,
      onClick: () => setOpen((v) => !v)
    },
    /* @__PURE__ */ React__namespace.createElement("span", { className: `plana-section__chevron${open ? " plana-section__chevron--open" : ""}` }, /* @__PURE__ */ React__namespace.createElement(ChevronIcon, null)),
    /* @__PURE__ */ React__namespace.createElement("h3", { className: "plana-section__title" }, title)
  ), open ? /* @__PURE__ */ React__namespace.createElement("div", { className: "plana-section__body" }, children) : null);
}

const DIM_MODES = [
  { id: "off", label: "Off", title: "Hide dimensions" },
  { id: "selection", label: "Selection", title: "Show sizes for the selection (mm)" },
  { id: "all", label: "All", title: "Show sizes for all objects (mm)" }
];
function EditorToolbar(props = {}) {
  const {
    dimensionsMode = "off",
    onDimensionsModeChange,
    showHatch = false,
    onToggleHatch
  } = props;
  const doc = usePlanaDocument();
  const world = usePlanaWorld();
  const selection = usePlanaSelection();
  const dispatch = usePlanaDispatch();
  const fileRef = React__namespace.useRef(null);
  const [, force] = React__namespace.useReducer((n) => n + 1, 0);
  React__namespace.useEffect(() => doc.subscribe(() => force()), [doc]);
  const findInsertParent = () => {
    const apt = world.children.find((c) => isApartment(c));
    if (apt?.id) {
      const zone = apt.children.find((c) => c.kind === "zone");
      if (zone?.id) return zone.id;
      return apt.id;
    }
    return world.id ?? null;
  };
  const onNew = () => {
    dispatch({ type: "replaceWorld", world: createEmptyWorld("world") });
    dispatch({ type: "setSelection", ids: [] });
  };
  const onExport = () => {
    const json = exportDocumentJson({
      world: doc.getWorld(),
      selection: doc.getSelection().ids,
      meta: {
        title: world.name ?? "Plana document",
        modifiedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${world.name ?? "plana-document"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const onImportFile = async (file) => {
    const text = await file.text();
    const { world: nextWorld, selection: nextSelection } = importDocumentJson(text);
    doc.replaceWorld(nextWorld);
    doc.setSelection(nextSelection, { recordHistory: false });
  };
  const onAddBox = () => {
    const parentId = findInsertParent();
    const box = createBoxObject({ name: "Box", y: 0.4 });
    dispatch({ type: "addNode", parentId, node: box });
    if (box.id) dispatch({ type: "setSelection", ids: [box.id] });
  };
  const onAddWall = () => {
    const parentId = findInsertParent();
    const wall = createWallObject({ name: "Wall", length: 3 });
    dispatch({ type: "addNode", parentId, node: wall });
    if (wall.id) dispatch({ type: "setSelection", ids: [wall.id] });
  };
  const onAddRoom = () => {
    const parentId = isWorld(world) ? world.id ?? null : null;
    const room = createRoomApartment({ name: "Room", width: 4, depth: 3.5 });
    dispatch({ type: "addNode", parentId, node: room });
    if (room.id) dispatch({ type: "setSelection", ids: [room.id] });
  };
  const onDelete = () => {
    for (const id of selection.ids) {
      const node = findNodeById(world, id);
      if (!node || isWorld(node)) continue;
      try {
        dispatch({ type: "removeNode", id });
      } catch {
      }
    }
  };
  return /* @__PURE__ */ React__namespace.createElement("header", { className: "plana-toolbar" }, /* @__PURE__ */ React__namespace.createElement("div", { className: "plana-toolbar__brand" }, "plana"), /* @__PURE__ */ React__namespace.createElement("div", { className: "plana-toolbar__group" }, /* @__PURE__ */ React__namespace.createElement("button", { type: "button", className: "plana-btn", onClick: onNew }, "New"), /* @__PURE__ */ React__namespace.createElement("button", { type: "button", className: "plana-btn", onClick: () => fileRef.current?.click() }, "Import JSON"), /* @__PURE__ */ React__namespace.createElement("button", { type: "button", className: "plana-btn", onClick: onExport }, "Export JSON"), /* @__PURE__ */ React__namespace.createElement(
    "input",
    {
      ref: fileRef,
      type: "file",
      accept: "application/json,.json",
      hidden: true,
      onChange: (e) => {
        const file = e.target.files?.[0];
        if (file) void onImportFile(file);
        e.target.value = "";
      }
    }
  )), /* @__PURE__ */ React__namespace.createElement("div", { className: "plana-toolbar__sep" }), /* @__PURE__ */ React__namespace.createElement("div", { className: "plana-toolbar__group" }, /* @__PURE__ */ React__namespace.createElement("button", { type: "button", className: "plana-btn", disabled: !doc.canUndo(), onClick: () => doc.undo() }, "Undo"), /* @__PURE__ */ React__namespace.createElement("button", { type: "button", className: "plana-btn", disabled: !doc.canRedo(), onClick: () => doc.redo() }, "Redo")), /* @__PURE__ */ React__namespace.createElement("div", { className: "plana-toolbar__sep" }), /* @__PURE__ */ React__namespace.createElement("div", { className: "plana-toolbar__group" }, /* @__PURE__ */ React__namespace.createElement("button", { type: "button", className: "plana-btn plana-btn--accent", onClick: onAddBox }, "Add Box"), /* @__PURE__ */ React__namespace.createElement("button", { type: "button", className: "plana-btn plana-btn--accent", onClick: onAddWall }, "Add Wall"), /* @__PURE__ */ React__namespace.createElement("button", { type: "button", className: "plana-btn plana-btn--accent", onClick: onAddRoom }, "Add Room"), /* @__PURE__ */ React__namespace.createElement(
    "button",
    {
      type: "button",
      className: "plana-btn plana-btn--danger",
      disabled: selection.ids.length === 0,
      onClick: onDelete
    },
    "Delete"
  )), onDimensionsModeChange ? /* @__PURE__ */ React__namespace.createElement(React__namespace.Fragment, null, /* @__PURE__ */ React__namespace.createElement("div", { className: "plana-toolbar__sep" }), /* @__PURE__ */ React__namespace.createElement("div", { className: "plana-toolbar__group", role: "group", "aria-label": "Dimensions" }, /* @__PURE__ */ React__namespace.createElement("span", { className: "plana-toolbar__label" }, "Dimensions"), /* @__PURE__ */ React__namespace.createElement("div", { className: "plana-segmented" }, DIM_MODES.map((m) => /* @__PURE__ */ React__namespace.createElement(
    "button",
    {
      key: m.id,
      type: "button",
      className: `plana-segmented__btn${dimensionsMode === m.id ? " plana-segmented__btn--active" : ""}`,
      "aria-pressed": dimensionsMode === m.id,
      title: m.title,
      onClick: () => onDimensionsModeChange(m.id)
    },
    m.label
  ))))) : null, onToggleHatch ? /* @__PURE__ */ React__namespace.createElement(React__namespace.Fragment, null, /* @__PURE__ */ React__namespace.createElement("div", { className: "plana-toolbar__sep" }), /* @__PURE__ */ React__namespace.createElement("div", { className: "plana-toolbar__group" }, /* @__PURE__ */ React__namespace.createElement(
    "button",
    {
      type: "button",
      className: `plana-btn${showHatch ? " plana-btn--active" : ""}`,
      "aria-pressed": showHatch,
      title: "Sparse plan hatch (off by default for FPS)",
      onClick: onToggleHatch
    },
    "Hatch"
  ))) : null);
}

const TreeNode = React__namespace.memo(function TreeNode2(props) {
  const { node, depth, path, expanded, selected, selectedIds, onToggle, onSelect } = props;
  const children = getChildNodes(node) ?? [];
  const hasChildren = children.length > 0;
  const key = node.id ?? path;
  const isOpen = !hasChildren || expanded.has(key);
  return /* @__PURE__ */ React__namespace.createElement("li", null, /* @__PURE__ */ React__namespace.createElement("div", { className: "plana-tree__row", style: { paddingLeft: Math.max(0, depth * 10) } }, /* @__PURE__ */ React__namespace.createElement(
    "button",
    {
      type: "button",
      className: [
        "plana-tree__chevron",
        isOpen ? "plana-tree__chevron--open" : "",
        !hasChildren ? "plana-tree__chevron--leaf" : ""
      ].filter(Boolean).join(" "),
      "aria-label": isOpen ? "Collapse" : "Expand",
      "aria-expanded": hasChildren ? isOpen : void 0,
      disabled: !hasChildren,
      onClick: (e) => {
        e.stopPropagation();
        if (hasChildren) onToggle(key);
      }
    },
    /* @__PURE__ */ React__namespace.createElement("svg", { width: "10", height: "10", viewBox: "0 0 12 12", "aria-hidden": "true" }, /* @__PURE__ */ React__namespace.createElement(
      "path",
      {
        d: "M4.5 2.5L8 6L4.5 9.5",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }
    ))
  ), /* @__PURE__ */ React__namespace.createElement(
    "button",
    {
      type: "button",
      className: `plana-tree__item${selected ? " plana-tree__item--selected" : ""}`,
      "aria-selected": selected,
      onClick: () => {
        if (node.id) onSelect(node.id);
      }
    },
    /* @__PURE__ */ React__namespace.createElement("span", { className: "plana-tree__kind" }, node.kind),
    /* @__PURE__ */ React__namespace.createElement("span", { className: "plana-tree__name" }, node.name ?? node.id ?? "(unnamed)")
  )), hasChildren && isOpen ? /* @__PURE__ */ React__namespace.createElement("ul", null, children.map((child, i) => /* @__PURE__ */ React__namespace.createElement(
    TreeNode2,
    {
      key: child.id ?? `${path}-${i}`,
      node: child,
      depth: depth + 1,
      path: `${path}/${child.id ?? i}`,
      expanded,
      selected: child.id ? selectedIds.has(child.id) : false,
      selectedIds,
      onToggle,
      onSelect
    }
  ))) : null);
});
const collectExpandableKeys = (node, path, into) => {
  const children = getChildNodes(node) ?? [];
  if (children.length === 0) return;
  into.push(node.id ?? path);
  children.forEach((child, i) => {
    collectExpandableKeys(child, `${path}/${child.id ?? i}`, into);
  });
};
const collectAncestorKeys = (node, path, selected, into) => {
  const children = getChildNodes(node) ?? [];
  const key = node.id ?? path;
  let hit = !!(node.id && selected.has(node.id));
  children.forEach((child, i) => {
    if (collectAncestorKeys(child, `${path}/${child.id ?? i}`, selected, into)) {
      hit = true;
    }
  });
  if (hit && children.length > 0) into.add(key);
  return hit;
};
function HierarchyPanel() {
  const world = usePlanaWorld();
  const selection = usePlanaSelection();
  const dispatch = usePlanaDispatch();
  const selectedIds = React__namespace.useMemo(() => new Set(selection.ids), [selection.ids]);
  const [expanded, setExpanded] = React__namespace.useState(() => {
    const keys = [];
    collectExpandableKeys(world, "root", keys);
    return new Set(keys);
  });
  const knownRef = React__namespace.useRef(new Set(expanded));
  React__namespace.useEffect(() => {
    const keys = [];
    collectExpandableKeys(world, "root", keys);
    setExpanded((prev) => {
      const next = /* @__PURE__ */ new Set();
      for (const key of keys) {
        if (prev.has(key) || !knownRef.current.has(key)) next.add(key);
      }
      knownRef.current = new Set(keys);
      return next;
    });
  }, [world]);
  React__namespace.useEffect(() => {
    if (selectedIds.size === 0) return;
    setExpanded((prev) => {
      const ancestors = /* @__PURE__ */ new Set();
      collectAncestorKeys(world, "root", selectedIds, ancestors);
      let changed = false;
      const next = new Set(prev);
      for (const key of ancestors) {
        if (!next.has(key)) {
          next.add(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [world, selectedIds]);
  const onToggle = React__namespace.useCallback((key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const onSelect = React__namespace.useCallback(
    (id) => {
      dispatch({ type: "setSelection", ids: [id] });
    },
    [dispatch]
  );
  return /* @__PURE__ */ React__namespace.createElement("ul", { className: "plana-tree" }, /* @__PURE__ */ React__namespace.createElement(
    TreeNode,
    {
      node: world,
      depth: 0,
      path: "root",
      expanded,
      selected: world.id ? selectedIds.has(world.id) : false,
      selectedIds,
      onToggle,
      onSelect
    }
  ));
}

const BOUND_KEYS = ["x", "y", "z", "width", "height", "depth"];
function NumberField(props) {
  return /* @__PURE__ */ React.createElement("div", { className: "plana-field" }, /* @__PURE__ */ React.createElement("label", null, props.label), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "number",
      step: props.step ?? 0.1,
      value: Number.isFinite(props.value) ? props.value : 0,
      onChange: (e) => props.onChange(Number(e.target.value))
    }
  ));
}
function TextField(props) {
  return /* @__PURE__ */ React.createElement("div", { className: "plana-field" }, /* @__PURE__ */ React.createElement("label", null, props.label), /* @__PURE__ */ React.createElement("input", { type: "text", value: props.value, onChange: (e) => props.onChange(e.target.value) }));
}
function ColorField(props) {
  const hex = props.value?.startsWith("#") ? props.value : "#c4a574";
  return /* @__PURE__ */ React.createElement("div", { className: "plana-field" }, /* @__PURE__ */ React.createElement("label", null, props.label), /* @__PURE__ */ React.createElement("input", { type: "color", value: hex.slice(0, 7), onChange: (e) => props.onChange(e.target.value) }));
}
function CheckField(props) {
  return /* @__PURE__ */ React.createElement("div", { className: "plana-field plana-field--check" }, /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "checkbox",
      checked: props.checked,
      onChange: (e) => props.onChange(e.target.checked),
      id: `check-${props.label}`
    }
  ), /* @__PURE__ */ React.createElement("label", { htmlFor: `check-${props.label}` }, props.label));
}
function InspectorPanel() {
  const world = usePlanaWorld();
  const selection = usePlanaSelection();
  const dispatch = usePlanaDispatch();
  const selectedId = selection.ids[0];
  const node = selectedId ? findNodeById(world, selectedId) : void 0;
  if (!node || !selectedId) {
    return /* @__PURE__ */ React.createElement("p", { className: "plana-empty" }, "Select a node to edit its properties.");
  }
  const patchNode = (patch) => {
    dispatch({ type: "updateNode", id: selectedId, patch });
  };
  const patchBounds = (key, value) => {
    dispatch({ type: "updateBounds", id: selectedId, bounds: { [key]: value } });
  };
  const patchStyle = (style2) => {
    dispatch({ type: "updateStyle", id: selectedId, style: style2 });
  };
  const style = node.style ?? {};
  const shapeKind = isIndependentObject(node) ? node.shape?.kind ?? "box" : "\u2014";
  const sphereRadius = isIndependentObject(node) && node.shape?.kind === "sphere" ? node.shape.radius : void 0;
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(CollapsibleSection, { title: "Identity" }, /* @__PURE__ */ React.createElement(TextField, { label: "Name", value: node.name ?? "", onChange: (name) => patchNode({ name }) }), /* @__PURE__ */ React.createElement(TextField, { label: "Tag", value: node.tag ?? "", onChange: (tag) => patchNode({ tag }) }), /* @__PURE__ */ React.createElement("div", { className: "plana-field" }, /* @__PURE__ */ React.createElement("label", null, "Kind"), /* @__PURE__ */ React.createElement("input", { type: "text", value: node.kind, readOnly: true })), /* @__PURE__ */ React.createElement("div", { className: "plana-field" }, /* @__PURE__ */ React.createElement("label", null, "Id"), /* @__PURE__ */ React.createElement("input", { type: "text", value: selectedId, readOnly: true }))), /* @__PURE__ */ React.createElement(CollapsibleSection, { title: "Bounds" }, /* @__PURE__ */ React.createElement("div", { className: "plana-field--row" }, BOUND_KEYS.slice(0, 3).map((key) => /* @__PURE__ */ React.createElement(
    NumberField,
    {
      key,
      label: key.toUpperCase(),
      value: node[key],
      onChange: (v) => patchBounds(key, v)
    }
  ))), /* @__PURE__ */ React.createElement("div", { className: "plana-field--row" }, BOUND_KEYS.slice(3).map((key) => /* @__PURE__ */ React.createElement(
    NumberField,
    {
      key,
      label: key,
      value: node[key],
      onChange: (v) => patchBounds(key, v)
    }
  )))), /* @__PURE__ */ React.createElement(CollapsibleSection, { title: "Shape" }, /* @__PURE__ */ React.createElement("div", { className: "plana-field" }, /* @__PURE__ */ React.createElement("label", null, "Shape kind"), /* @__PURE__ */ React.createElement("input", { type: "text", value: shapeKind, readOnly: true })), sphereRadius !== void 0 ? /* @__PURE__ */ React.createElement(
    NumberField,
    {
      label: "Radius",
      value: sphereRadius,
      onChange: (radius) => {
        if (!isIndependentObject(node)) return;
        dispatch({
          type: "updateIndependent",
          id: selectedId,
          patch: { shape: { kind: "sphere", radius } }
        });
      }
    }
  ) : null), /* @__PURE__ */ React.createElement(CollapsibleSection, { title: "Style" }, /* @__PURE__ */ React.createElement(
    ColorField,
    {
      label: "Color",
      value: style.color ?? "#c4a574",
      onChange: (color) => patchStyle({ color })
    }
  ), /* @__PURE__ */ React.createElement(
    ColorField,
    {
      label: "Accent",
      value: style.accentColor ?? "#8b6914",
      onChange: (accentColor) => patchStyle({ accentColor })
    }
  ), /* @__PURE__ */ React.createElement(
    NumberField,
    {
      label: "Opacity",
      value: style.opacity ?? 1,
      step: 0.05,
      onChange: (opacity) => patchStyle({ opacity })
    }
  ), /* @__PURE__ */ React.createElement(
    NumberField,
    {
      label: "Metalness",
      value: style.metalness ?? 0.05,
      step: 0.05,
      onChange: (metalness) => patchStyle({ metalness })
    }
  ), /* @__PURE__ */ React.createElement(
    NumberField,
    {
      label: "Roughness",
      value: style.roughness ?? 0.75,
      step: 0.05,
      onChange: (roughness) => patchStyle({ roughness })
    }
  ), /* @__PURE__ */ React.createElement(
    ColorField,
    {
      label: "Outline",
      value: style.outlineColor ?? "#2a241c",
      onChange: (outlineColor) => patchStyle({ outlineColor })
    }
  ), /* @__PURE__ */ React.createElement(
    NumberField,
    {
      label: "Outline width",
      value: style.outlineWidth ?? 0.01,
      step: 5e-3,
      onChange: (outlineWidth) => patchStyle({ outlineWidth })
    }
  ), /* @__PURE__ */ React.createElement(
    CheckField,
    {
      label: "Visible",
      checked: style.visible !== false,
      onChange: (visible) => patchStyle({ visible })
    }
  ), /* @__PURE__ */ React.createElement(
    CheckField,
    {
      label: "Selectable",
      checked: style.selectable !== false,
      onChange: (selectable) => patchStyle({ selectable })
    }
  )));
}

const editorStyles = (
  /* css */
  `
.plana-editor {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --card: 240 10% 3.9%;
  --card-foreground: 0 0% 98%;
  --popover: 240 10% 3.9%;
  --popover-foreground: 0 0% 98%;
  --primary: 0 0% 98%;
  --primary-foreground: 240 5.9% 10%;
  --secondary: 240 3.7% 15.9%;
  --secondary-foreground: 0 0% 98%;
  --muted: 240 3.7% 15.9%;
  --muted-foreground: 240 5% 64.9%;
  --accent: 240 3.7% 15.9%;
  --accent-foreground: 0 0% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 0 0% 98%;
  --border: 240 3.7% 15.9%;
  --input: 240 3.7% 15.9%;
  --ring: 240 4.9% 83.9%;
  --radius: 0.5rem;

  --pe-bg: hsl(var(--background));
  --pe-panel: hsl(var(--card));
  --pe-panel-2: hsl(var(--secondary));
  --pe-ink: hsl(var(--background));
  --pe-border: hsl(var(--border));
  --pe-border-strong: hsl(240 3.7% 22%);
  --pe-text: hsl(var(--foreground));
  --pe-muted: hsl(var(--muted-foreground));
  --pe-accent: hsl(var(--primary));
  --pe-accent-2: hsl(var(--muted-foreground));
  --pe-accent-soft: hsl(var(--secondary));
  --pe-danger: hsl(0 72% 51%);
  --pe-input: hsl(var(--input));
  --pe-radius: var(--radius);
  --pe-font: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --pe-display: var(--pe-font);
  --pe-sidebar-rail: 28px;

  box-sizing: border-box;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--pe-bg);
  color: var(--pe-text);
  font-family: var(--pe-font);
  font-size: 13px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

.plana-editor *,
.plana-editor *::before,
.plana-editor *::after {
  box-sizing: border-box;
}

/* Hide scrollbars on panel bodies only; scrolling still works */
.plana-panel__body {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.plana-panel__body::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.plana-editor__body {
  display: flex;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.plana-editor__viewport {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: #09090b;
  border-left: 1px solid var(--pe-border);
  border-right: 1px solid var(--pe-border);
}

.plana-editor__viewport > div {
  width: 100% !important;
  height: 100% !important;
}

.plana-editor__viewport canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

.plana-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 48px;
  padding: 0 8px;
  background: hsl(var(--background) / 0.95);
  border-bottom: 1px solid var(--pe-border);
  backdrop-filter: blur(8px);
}

.plana-toolbar__brand {
  display: grid;
  place-items: center;
  padding: 0 14px;
  margin-right: 4px;
  font-family: var(--pe-display);
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--pe-text);
  border-right: 1px solid var(--pe-border);
  user-select: none;
}

.plana-toolbar__group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 4px;
}

.plana-toolbar__label {
  color: var(--pe-muted);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0 4px;
  user-select: none;
}

.plana-segmented {
  display: inline-flex;
  align-items: stretch;
  border: 1px solid var(--pe-border);
  border-radius: calc(var(--pe-radius) - 1px);
  overflow: hidden;
  background: hsl(var(--secondary));
}

.plana-segmented__btn {
  appearance: none;
  border: 0;
  margin: 0;
  padding: 4px 10px;
  background: transparent;
  color: var(--pe-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.plana-segmented__btn + .plana-segmented__btn {
  border-left: 1px solid var(--pe-border);
}

.plana-segmented__btn:hover {
  color: var(--pe-text);
  background: hsl(var(--accent));
}

.plana-segmented__btn--active {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.plana-segmented__btn--active:hover {
  background: hsl(0 0% 90%);
  color: hsl(var(--primary-foreground));
}

.plana-toolbar__sep {
  width: 1px;
  align-self: stretch;
  min-height: 24px;
  margin: 8px 4px;
  background: var(--pe-border);
}

.plana-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--pe-border);
  border-radius: calc(var(--pe-radius) - 2px);
  background: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease, opacity 120ms ease;
}

.plana-btn:hover:not(:disabled) {
  background: hsl(240 3.7% 20%);
  color: var(--pe-text);
}

.plana-btn:active:not(:disabled) {
  background: hsl(240 3.7% 18%);
}

.plana-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.plana-btn--accent {
  background: hsl(var(--primary));
  border-color: transparent;
  color: hsl(var(--primary-foreground));
}

.plana-btn--accent:hover:not(:disabled) {
  background: hsl(0 0% 90%);
  color: hsl(var(--primary-foreground));
}

.plana-btn--danger:hover:not(:disabled) {
  background: hsl(0 62.8% 30.6% / 0.25);
  border-color: hsl(0 62.8% 30.6% / 0.5);
  color: hsl(0 86% 70%);
}

.plana-btn--active {
  background: hsl(var(--primary));
  border-color: transparent;
  color: hsl(var(--primary-foreground));
}

.plana-btn--active:hover:not(:disabled) {
  background: hsl(0 0% 90%);
  color: hsl(var(--primary-foreground));
}

.plana-btn--icon {
  width: 28px;
  height: 28px;
  padding: 0;
  flex-shrink: 0;
}

.plana-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  width: var(--pe-panel-width, 260px);
  min-width: var(--pe-sidebar-rail);
  min-height: 0;
  height: 100%;
  background: var(--pe-panel);
  border: 0;
  /* No mount fade \u2014 restarting pe-fade-in was flashing both sidebars to opacity 0. */
  contain: layout paint;
}

.plana-panel--collapsed {
  width: var(--pe-sidebar-rail);
  min-width: var(--pe-sidebar-rail);
  max-width: var(--pe-sidebar-rail);
  flex: 0 0 var(--pe-sidebar-rail);
}

.plana-panel__header {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  min-height: 40px;
  padding: 4px 6px 4px 10px;
  border-bottom: 1px solid var(--pe-border);
}

.plana-panel__header[hidden] {
  display: none !important;
}

.plana-panel__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--pe-display);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--pe-muted);
}

.plana-panel__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 8px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.plana-panel__body--parked,
.plana-panel__body[hidden] {
  display: none !important;
}

.plana-panel__rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  height: 100%;
  padding: 8px 0;
}

/* Author display:flex beats the UA [hidden] rule \u2014 force hide. */
.plana-panel__rail[hidden] {
  display: none !important;
}

.plana-panel__rail-label {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pe-muted);
  user-select: none;
}

.plana-panel__resize {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 4px;
  z-index: 2;
  cursor: col-resize;
  touch-action: none;
  background: transparent;
}

.plana-panel__resize:hover,
.plana-panel__resize:active {
  background: hsl(var(--ring) / 0.35);
}

.plana-panel__resize--left {
  right: -2px;
}

.plana-panel__resize--right {
  left: -2px;
}

.plana-tree {
  list-style: none;
  margin: 0;
  padding: 0;
}

.plana-tree ul {
  list-style: none;
  margin: 0;
  padding-left: 12px;
  border-left: 1px solid var(--pe-border);
}

.plana-tree__row {
  display: flex;
  align-items: center;
  gap: 2px;
  width: 100%;
}

.plana-tree__chevron {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  padding: 0;
  border: 0;
  border-radius: calc(var(--pe-radius) - 4px);
  background: transparent;
  color: var(--pe-muted);
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, transform 120ms ease;
}

.plana-tree__chevron:hover {
  background: hsl(var(--accent));
  color: var(--pe-text);
}

.plana-tree__chevron--open {
  transform: rotate(90deg);
}

.plana-tree__chevron--leaf {
  visibility: hidden;
  pointer-events: none;
}

.plana-tree__item {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  text-align: left;
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  font: inherit;
  padding: 6px 8px;
  border-radius: calc(var(--pe-radius) - 2px);
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}

.plana-tree__item:hover {
  background: hsl(var(--accent));
}

.plana-tree__item--selected {
  background: hsl(240 5% 32%);
  border-color: hsl(var(--ring) / 0.7);
  box-shadow: inset 3px 0 0 hsl(0 0% 98%);
  color: var(--pe-text);
}

.plana-tree__item--selected .plana-tree__kind {
  color: hsl(var(--foreground) / 0.72);
}

.plana-tree__kind {
  color: var(--pe-muted);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  min-width: 58px;
}

.plana-tree__name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plana-field {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
}

.plana-field label {
  color: var(--pe-muted);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.plana-field input[type='text'],
.plana-field input[type='number'],
.plana-field input[type='color'] {
  width: 100%;
  height: 32px;
  background: hsl(var(--background));
  border: 1px solid var(--pe-border);
  border-radius: calc(var(--pe-radius) - 2px);
  color: var(--pe-text);
  padding: 6px 10px;
  font: inherit;
  font-size: 0.8125rem;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}

.plana-field input[type='color'] {
  padding: 2px;
  cursor: pointer;
}

.plana-field input:focus {
  outline: none;
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.25);
}

.plana-field--row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.plana-field--check {
  display: flex;
  align-items: center;
  gap: 8px;
}

.plana-field--check input {
  accent-color: hsl(var(--foreground));
}

.plana-section {
  margin-top: 2px;
  margin-bottom: 8px;
  border: 1px solid transparent;
  border-radius: calc(var(--pe-radius) - 2px);
}

.plana-section__header {
  appearance: none;
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  margin: 0;
  padding: 8px 6px;
  border: 0;
  border-radius: calc(var(--pe-radius) - 2px);
  background: transparent;
  color: var(--pe-text);
  font: inherit;
  cursor: pointer;
  transition: background 120ms ease;
}

.plana-section__header:hover {
  background: hsl(var(--accent));
}

.plana-section__chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--pe-muted);
  transition: transform 120ms ease;
}

.plana-section__chevron--open {
  transform: rotate(90deg);
}

.plana-section__title {
  flex: 1;
  text-align: left;
  font-family: var(--pe-display);
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--pe-text);
  margin: 0;
}

.plana-section__body {
  padding: 2px 6px 8px;
}

.plana-empty {
  color: var(--pe-muted);
  padding: 18px 10px;
  text-align: left;
}

.plana-dim {
  pointer-events: none;
  white-space: nowrap;
  padding: 5px 9px;
  border-radius: calc(var(--pe-radius) - 2px);
  border: 1px solid hsl(var(--border));
  background: hsl(var(--background) / 0.94);
  color: hsl(var(--foreground));
  font-family: var(--pe-font);
  font-size: 12px;
  font-weight: 560;
  letter-spacing: 0.02em;
  line-height: 1.25;
  box-shadow: 0 1px 3px hsl(0 0% 0% / 0.45);
  backdrop-filter: blur(6px);
}

.plana-dim--emphasis {
  border-color: hsl(var(--ring));
  background: hsl(0 0% 98% / 0.95);
  color: hsl(240 10% 3.9%);
  font-size: 13px;
  font-weight: 600;
}

.plana-dim--hint {
  opacity: 0.85;
  font-weight: 500;
  color: var(--pe-muted);
  border-style: dashed;
}

@media (max-width: 960px) {
  .plana-editor {
    min-height: 0;
    height: 100%;
  }

  .plana-editor__body {
    flex-direction: column;
    min-height: 0;
    flex: 1 1 auto;
  }

  .plana-panel {
    width: 100% !important;
    height: auto;
    max-height: min(28dvh, 220px);
    order: 2;
  }

  .plana-panel--truncated {
    width: 100% !important;
    max-height: 44px;
  }

  .plana-panel__resize {
    display: none;
  }

  .plana-editor__viewport {
    flex: 1 1 auto;
    order: 1;
    min-height: min(48dvh, 420px);
    border-left: 0;
    border-right: 0;
    border-top: 0;
    border-bottom: 1px solid var(--pe-border);
  }

  .plana-toolbar {
    flex-wrap: wrap;
    gap: 0.35rem;
    padding: 0.4rem 0.5rem;
  }

  .plana-toolbar .plana-btn {
    min-height: 36px;
  }
}

@media (max-width: 640px) {
  .plana-editor__viewport {
    min-height: min(52dvh, 480px);
  }

  .plana-panel {
    max-height: min(24dvh, 180px);
  }

  .plana-panel__header,
  .plana-section__header {
    padding-inline: 0.65rem;
  }
}
`
);

function EditorKeyboard() {
  const doc = usePlanaDocument();
  const world = usePlanaWorld();
  const selection = usePlanaSelection();
  const dispatch = usePlanaDispatch();
  React__namespace.useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) doc.redo();
        else doc.undo();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (selection.ids.length === 0) return;
        event.preventDefault();
        for (const id of [...selection.ids]) {
          const node = findNodeById(world, id);
          if (!node || isWorld(node)) continue;
          try {
            dispatch({ type: "removeNode", id });
          } catch {
          }
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch, doc, selection.ids, world]);
  return null;
}
const EditorViewport = React__namespace.memo(function EditorViewport2(props) {
  return /* @__PURE__ */ React__namespace.createElement("div", { className: "plana-editor__viewport" }, /* @__PURE__ */ React__namespace.createElement(PlanaCanvas, { dimensionsMode: props.dimensionsMode, showHatch: props.showHatch }));
});
function EditorShell(props) {
  const left = useSidebarState("plana.editor.hierarchy", 260);
  const right = useSidebarState("plana.editor.inspector", 300);
  const [dimensionsMode, setDimensionsMode] = React__namespace.useState("selection");
  const [showHatch, setShowHatch] = React__namespace.useState(false);
  return /* @__PURE__ */ React__namespace.createElement("div", { className: ["plana-editor", props.className].filter(Boolean).join(" ") }, /* @__PURE__ */ React__namespace.createElement(EditorKeyboard, null), /* @__PURE__ */ React__namespace.createElement(
    EditorToolbar,
    {
      dimensionsMode,
      onDimensionsModeChange: setDimensionsMode,
      showHatch,
      onToggleHatch: () => setShowHatch((v) => !v)
    }
  ), /* @__PURE__ */ React__namespace.createElement("div", { className: "plana-editor__body" }, /* @__PURE__ */ React__namespace.createElement(
    EditorSidebar,
    {
      title: "Hierarchy",
      side: "left",
      width: left.width,
      collapsed: left.collapsed,
      onWidthChange: left.setWidth,
      onToggleCollapsed: left.toggleCollapsed
    },
    /* @__PURE__ */ React__namespace.createElement(HierarchyPanel, null)
  ), /* @__PURE__ */ React__namespace.createElement(EditorViewport, { dimensionsMode, showHatch }), /* @__PURE__ */ React__namespace.createElement(
    EditorSidebar,
    {
      title: "Inspector",
      side: "right",
      width: right.width,
      collapsed: right.collapsed,
      onWidthChange: right.setWidth,
      onToggleCollapsed: right.toggleCollapsed
    },
    /* @__PURE__ */ React__namespace.createElement(InspectorPanel, null)
  )));
}
function PlanaEditor(props = {}) {
  const { document, world = createDemoWorld(), className, injectStyles = true } = props;
  return /* @__PURE__ */ React__namespace.createElement(React__namespace.Fragment, null, injectStyles ? /* @__PURE__ */ React__namespace.createElement("style", { "data-plana-editor-styles": true }, editorStyles) : null, /* @__PURE__ */ React__namespace.createElement(PlanaProvider, { document, world: document ? void 0 : world }, /* @__PURE__ */ React__namespace.createElement(EditorShell, { className })));
}

exports.CommandError = CommandError;
exports.Document = Document;
exports.EditorToolbar = EditorToolbar;
exports.GeometryError = GeometryError;
exports.HierarchyPanel = HierarchyPanel;
exports.History = History;
exports.InspectorPanel = InspectorPanel;
exports.NotFoundError = NotFoundError;
exports.PLANA_DOCUMENT_FORMAT = PLANA_DOCUMENT_FORMAT;
exports.PLANA_DOCUMENT_VERSION = PLANA_DOCUMENT_VERSION;
exports.PlanaCanvas = PlanaCanvas;
exports.PlanaContext = PlanaContext;
exports.PlanaDimensions = PlanaDimensions;
exports.PlanaEditor = PlanaEditor;
exports.PlanaError = PlanaError;
exports.PlanaProvider = PlanaProvider;
exports.PlanaWorldMesh = PlanaWorldMesh;
exports.ValidationError = ValidationError;
exports.add2 = add2;
exports.add3 = add3;
exports.addChildToParent = addChildToParent;
exports.applyCommand = applyCommand;
exports.boundsSize = boundsSize;
exports.buildBoxMesh = buildBoxMesh;
exports.buildCapsuleMesh = buildCapsuleMesh;
exports.buildCutoutMesh = buildCutoutMesh;
exports.buildCylinderMesh = buildCylinderMesh;
exports.buildExtrudeMesh = buildExtrudeMesh;
exports.buildIndependentGeometry = buildIndependentGeometry;
exports.buildShapeMesh = buildShapeMesh;
exports.buildSphereMesh = buildSphereMesh;
exports.buildWallMesh = buildWallMesh;
exports.buildWorldSolids = buildWorldSolids;
exports.canParentChild = canParentChild;
exports.cloneWorldShallow = cloneWorldShallow;
exports.composeMatrices = composeMatrices;
exports.computeVertexNormals = computeVertexNormals;
exports.contourToRing = contourToRing;
exports.createBoxObject = createBoxObject;
exports.createDemoWorld = createDemoWorld;
exports.createDocument = createDocument;
exports.createEmptyWorld = createEmptyWorld;
exports.createFlatWorld = createFlatWorld;
exports.createHistorySnapshot = createHistorySnapshot;
exports.createRoomApartment = createRoomApartment;
exports.createSelection = createSelection;
exports.createWallObject = createWallObject;
exports.cross3 = cross3;
exports.cutoutToHoleRings = cutoutToHoleRings;
exports.cutoutsToWallGaps = cutoutsToWallGaps;
exports.defaultStyle = defaultStyle;
exports.editorStyles = editorStyles;
exports.emptyMesh = emptyMesh;
exports.emptySelection = emptySelection;
exports.exportDocumentJson = exportDocumentJson;
exports.exportDocumentObject = exportDocumentObject;
exports.findNodeById = findNodeById;
exports.flattenPath = flattenPath;
exports.getChildNodes = getChildNodes;
exports.id = id;
exports.importDocumentJson = importDocumentJson;
exports.isApartment = isApartment;
exports.isCompositeObject = isCompositeObject;
exports.isGroup = isGroup;
exports.isIndependentObject = isIndependentObject;
exports.isSelected = isSelected;
exports.isWorld = isWorld;
exports.isZone = isZone;
exports.length2 = length2;
exports.length3 = length3;
exports.mat4Identity = mat4Identity;
exports.mat4Multiply = mat4Multiply;
exports.mat4TransformDirection = mat4TransformDirection;
exports.mat4TransformPoint = mat4TransformPoint;
exports.mat4Translate = mat4Translate;
exports.mergeMeshes = mergeMeshes;
exports.mergeStyle = mergeStyle;
exports.meshToBufferGeometry = meshToBufferGeometry;
exports.nodeLocalMatrix = nodeLocalMatrix;
exports.normalize2 = normalize2;
exports.normalize3 = normalize3;
exports.perp2 = perp2;
exports.pushQuad = pushQuad;
exports.removeNodeById = removeNodeById;
exports.requireId = requireId;
exports.requireNodeById = requireNodeById;
exports.resolveStyle = resolveStyle;
exports.scale2 = scale2;
exports.scale3 = scale3;
exports.selectionEquals = selectionEquals;
exports.sub2 = sub2;
exports.sub3 = sub3;
exports.transformMesh = transformMesh;
exports.updateNodeById = updateNodeById;
exports.usePlanaDispatch = usePlanaDispatch;
exports.usePlanaDocument = usePlanaDocument;
exports.usePlanaSelection = usePlanaSelection;
exports.usePlanaWorld = usePlanaWorld;
exports.validateNodeTree = validateNodeTree;
exports.validateWorld = validateWorld;
exports.vec2 = vec2;
exports.vec3 = vec3;
exports.walkWorld = walkWorld;
