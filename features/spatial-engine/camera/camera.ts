import type { EventBus } from "../core/events"
import type { CameraBookmarkId, Vec3 } from "../core/types"
import { newId, vec3 } from "../core/types"

export type CameraMode = "orbit" | "fly" | "walk" | "ortho-top" | "ortho-front" | "ortho-side"

export type CameraBookmark = {
  id: CameraBookmarkId
  name: string
  mode: CameraMode
  position: Vec3
  target: Vec3
  fov: number
  orthographic: boolean
}

export class CameraService {
  mode: CameraMode = "orbit"
  position: Vec3 = vec3(6, 5, 8)
  target: Vec3 = vec3(0, 0, 0)
  fov = 50
  orthographic = false
  orthoSize = 8
  private bookmarks = new Map<CameraBookmarkId, CameraBookmark>()

  constructor(private readonly bus: EventBus) {}

  setMode(mode: CameraMode): void {
    this.mode = mode
    this.orthographic = mode.startsWith("ortho")
    if (mode === "ortho-top") {
      this.position = vec3(0, 12, 0.01)
      this.target = vec3(0, 0, 0)
    } else if (mode === "ortho-front") {
      this.position = vec3(0, 2, 12)
      this.target = vec3(0, 2, 0)
    } else if (mode === "ortho-side") {
      this.position = vec3(12, 2, 0)
      this.target = vec3(0, 2, 0)
    }
    this.bus.emit("camera:mode-changed", { mode })
  }

  setLook(position: Vec3, target: Vec3): void {
    this.position = { ...position }
    this.target = { ...target }
  }

  saveBookmark(name: string): CameraBookmark {
    const bm: CameraBookmark = {
      id: newId("cam"),
      name,
      mode: this.mode,
      position: { ...this.position },
      target: { ...this.target },
      fov: this.fov,
      orthographic: this.orthographic,
    }
    this.bookmarks.set(bm.id, bm)
    this.bus.emit("camera:bookmark", { id: bm.id })
    return bm
  }

  restoreBookmark(id: CameraBookmarkId): boolean {
    const bm = this.bookmarks.get(id)
    if (!bm) return false
    this.mode = bm.mode
    this.position = { ...bm.position }
    this.target = { ...bm.target }
    this.fov = bm.fov
    this.orthographic = bm.orthographic
    this.bus.emit("camera:mode-changed", { mode: this.mode })
    return true
  }

  listBookmarks(): CameraBookmark[] {
    return [...this.bookmarks.values()]
  }
}
