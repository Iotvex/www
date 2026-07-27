import type { EventBus } from "../core/events"
import type { LayerId, NodeId, NodeMetadata, TransformTRS } from "../core/types"
import { createSceneNode, type SceneNode } from "./node"

/**
 * Authoritative hierarchical scene. Renderer syncs from this; never the reverse.
 */
export class SceneGraph {
  private nodes = new Map<NodeId, SceneNode>()
  readonly rootId: NodeId

  constructor(private readonly bus: EventBus) {
    const root = createSceneNode({
      id: "root",
      name: "Root",
      geometry: { kind: "none" },
      localBounds: null,
    })
    this.rootId = root.id
    this.nodes.set(root.id, root)
  }

  get(id: NodeId): SceneNode | undefined {
    return this.nodes.get(id)
  }

  list(): SceneNode[] {
    return [...this.nodes.values()]
  }

  children(id: NodeId): SceneNode[] {
    const n = this.nodes.get(id)
    if (!n) return []
    return n.childIds.map((cid) => this.nodes.get(cid)!).filter(Boolean)
  }

  add(
    partial: Partial<SceneNode> & { name?: string },
    parentId: NodeId = this.rootId,
  ): SceneNode {
    const parent = this.nodes.get(parentId)
    if (!parent) throw new Error(`Parent ${parentId} not found`)
    const node = createSceneNode({ ...partial, parentId })
    this.nodes.set(node.id, node)
    parent.childIds.push(node.id)
    this.bus.emit("scene:node-added", { id: node.id })
    this.bus.emit("scene:structure-changed", { reason: "add" })
    return node
  }

  remove(id: NodeId): boolean {
    if (id === this.rootId) return false
    const node = this.nodes.get(id)
    if (!node) return false
    for (const child of [...node.childIds]) this.remove(child)
    if (node.parentId) {
      const parent = this.nodes.get(node.parentId)
      if (parent) parent.childIds = parent.childIds.filter((c) => c !== id)
    }
    this.nodes.delete(id)
    this.bus.emit("scene:node-removed", { id })
    this.bus.emit("scene:structure-changed", { reason: "remove" })
    return true
  }

  setTransform(id: NodeId, transform: TransformTRS): void {
    const node = this.nodes.get(id)
    if (!node || node.locked) return
    node.transform = structuredClone(transform)
    this.bus.emit("scene:node-changed", { id, fields: ["transform"] })
  }

  setMetadata(id: NodeId, metadata: NodeMetadata, merge = true): void {
    const node = this.nodes.get(id)
    if (!node) return
    node.metadata = merge ? { ...node.metadata, ...metadata } : { ...metadata }
    this.bus.emit("scene:node-changed", { id, fields: ["metadata"] })
  }

  setVisible(id: NodeId, visible: boolean): void {
    const node = this.nodes.get(id)
    if (!node) return
    node.visible = visible
    this.bus.emit("scene:node-changed", { id, fields: ["visible"] })
  }

  setLayer(id: NodeId, layerId: LayerId): void {
    const node = this.nodes.get(id)
    if (!node) return
    node.layerId = layerId
    this.bus.emit("scene:node-changed", { id, fields: ["layerId"] })
  }

  reparent(id: NodeId, newParentId: NodeId): void {
    if (id === this.rootId) return
    const node = this.nodes.get(id)
    const newParent = this.nodes.get(newParentId)
    if (!node || !newParent) return
    if (this.isDescendant(id, newParentId)) return
    if (node.parentId) {
      const old = this.nodes.get(node.parentId)
      if (old) old.childIds = old.childIds.filter((c) => c !== id)
    }
    node.parentId = newParentId
    newParent.childIds.push(id)
    this.bus.emit("scene:structure-changed", { reason: "reparent" })
  }

  private isDescendant(ancestorId: NodeId, maybeChildId: NodeId): boolean {
    let cur: NodeId | null = maybeChildId
    while (cur) {
      if (cur === ancestorId) return true
      cur = this.nodes.get(cur)?.parentId ?? null
    }
    return false
  }

  clearContent(): void {
    for (const id of [...this.nodes.keys()]) {
      if (id !== this.rootId) this.remove(id)
    }
  }

  toJSON(): SceneNode[] {
    return this.list().map((n) => structuredClone(n))
  }

  loadJSON(nodes: SceneNode[]): void {
    this.nodes.clear()
    for (const n of nodes) this.nodes.set(n.id, structuredClone(n))
    if (!this.nodes.has(this.rootId)) {
      const root = createSceneNode({
        id: this.rootId,
        name: "Root",
        geometry: { kind: "none" },
        localBounds: null,
      })
      this.nodes.set(root.id, root)
    }
    this.bus.emit("scene:structure-changed", { reason: "load" })
  }
}
