import type { EventBus } from "../core/events"
import type { NodeId } from "../core/types"

export class SelectionModel {
  private ids = new Set<NodeId>()

  constructor(private readonly bus: EventBus) {}

  get selected(): NodeId[] {
    return [...this.ids]
  }

  isSelected(id: NodeId): boolean {
    return this.ids.has(id)
  }

  set(ids: NodeId[]): void {
    this.ids = new Set(ids)
    this.bus.emit("selection:changed", { ids: this.selected })
  }

  clear(): void {
    this.set([])
  }

  toggle(id: NodeId, multi = false): void {
    if (!multi) {
      this.set(this.ids.has(id) && this.ids.size === 1 ? [] : [id])
      return
    }
    if (this.ids.has(id)) this.ids.delete(id)
    else this.ids.add(id)
    this.bus.emit("selection:changed", { ids: this.selected })
  }
}
