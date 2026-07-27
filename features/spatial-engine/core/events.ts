import type { CameraBookmarkId, NodeId } from "./types"

export type SpatialEventMap = {
  "engine:ready": { timestamp: number }
  "engine:dispose": { timestamp: number }
  "engine:tick": { dt: number; elapsed: number }
  "scene:node-added": { id: NodeId }
  "scene:node-removed": { id: NodeId }
  "scene:node-changed": { id: NodeId; fields: string[] }
  "scene:structure-changed": { reason: string }
  "selection:changed": { ids: NodeId[] }
  "camera:mode-changed": { mode: string }
  "camera:bookmark": { id: CameraBookmarkId }
  "tool:changed": { tool: string }
  "history:changed": { canUndo: boolean; canRedo: boolean }
  "pointer:down": { x: number; y: number; button: number }
  "pointer:up": { x: number; y: number; button: number }
  "pointer:move": { x: number; y: number }
  "pick:hit": { id: NodeId | null; point?: { x: number; y: number; z: number } }
}

export type SpatialEventName = keyof SpatialEventMap

type Handler<K extends SpatialEventName> = (payload: SpatialEventMap[K]) => void

/** Tiny typed event bus — no framework dependency. */
export class EventBus {
  private listeners = new Map<SpatialEventName, Set<Handler<SpatialEventName>>>()

  on<K extends SpatialEventName>(event: K, handler: Handler<K>): () => void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(handler as Handler<SpatialEventName>)
    return () => set!.delete(handler as Handler<SpatialEventName>)
  }

  emit<K extends SpatialEventName>(event: K, payload: SpatialEventMap[K]): void {
    const set = this.listeners.get(event)
    if (!set) return
    for (const handler of set) {
      try {
        ;(handler as Handler<K>)(payload)
      } catch (err) {
        console.error(`[spatial-engine] handler error for ${event}`, err)
      }
    }
  }

  clear(): void {
    this.listeners.clear()
  }
}
