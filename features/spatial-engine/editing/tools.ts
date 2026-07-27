import type { EventBus } from "../core/events"

export type EditorToolId = "select" | "translate" | "rotate" | "scale" | "measure" | "place"

export type SnapSettings = {
  enabled: boolean
  grid: number
  angleDeg: number
}

export class ToolService {
  active: EditorToolId = "select"
  snap: SnapSettings = { enabled: true, grid: 0.25, angleDeg: 15 }

  constructor(private readonly bus: EventBus) {}

  setTool(tool: EditorToolId): void {
    this.active = tool
    this.bus.emit("tool:changed", { tool })
  }

  snapValue(v: number): number {
    if (!this.snap.enabled || this.snap.grid <= 0) return v
    return Math.round(v / this.snap.grid) * this.snap.grid
  }
}
