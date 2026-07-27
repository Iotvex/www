import type { Aabb, NodeId, Vec3 } from "../core/types"
import type { SceneGraph } from "../scene/graph"
import type { SceneNode } from "../scene/node"

type Entry = { id: NodeId; aabb: Aabb }

/**
 * Simple flat AABB index — adequate for first iteration; replaceable with BVH later.
 */
export class SpatialIndex {
  private entries: Entry[] = []

  rebuild(graph: SceneGraph): void {
    this.entries = []
    for (const node of graph.list()) {
      if (node.id === graph.rootId || !node.visible || !node.localBounds) continue
      this.entries.push({ id: node.id, aabb: worldAabb(node) })
    }
  }

  queryPoint(p: Vec3): NodeId[] {
    return this.entries
      .filter((e) => pointInAabb(p, e.aabb))
      .map((e) => e.id)
  }

  queryAabb(box: Aabb): NodeId[] {
    return this.entries.filter((e) => aabbOverlap(box, e.aabb)).map((e) => e.id)
  }

  all(): Entry[] {
    return this.entries
  }
}

function worldAabb(node: SceneNode): Aabb {
  const b = node.localBounds!
  const p = node.transform.position
  const s = node.transform.scale
  // Approximate: ignore rotation for index (CAD refinement later)
  const corners = [
    { x: b.min.x * s.x + p.x, y: b.min.y * s.y + p.y, z: b.min.z * s.z + p.z },
    { x: b.max.x * s.x + p.x, y: b.max.y * s.y + p.y, z: b.max.z * s.z + p.z },
  ]
  return {
    min: {
      x: Math.min(corners[0].x, corners[1].x),
      y: Math.min(corners[0].y, corners[1].y),
      z: Math.min(corners[0].z, corners[1].z),
    },
    max: {
      x: Math.max(corners[0].x, corners[1].x),
      y: Math.max(corners[0].y, corners[1].y),
      z: Math.max(corners[0].z, corners[1].z),
    },
  }
}

function pointInAabb(p: Vec3, b: Aabb): boolean {
  return (
    p.x >= b.min.x &&
    p.x <= b.max.x &&
    p.y >= b.min.y &&
    p.y <= b.max.y &&
    p.z >= b.min.z &&
    p.z <= b.max.z
  )
}

function aabbOverlap(a: Aabb, b: Aabb): boolean {
  return (
    a.min.x <= b.max.x &&
    a.max.x >= b.min.x &&
    a.min.y <= b.max.y &&
    a.max.y >= b.min.y &&
    a.min.z <= b.max.z &&
    a.max.z >= b.min.z
  )
}
