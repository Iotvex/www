import type { LayerId } from "../core/types"
import { newId } from "../core/types"

export type Layer = {
  id: LayerId
  name: string
  visible: boolean
  locked: boolean
  opacity: number
}

export class LayerStack {
  private layers = new Map<LayerId, Layer>()

  constructor() {
    this.add({ id: "default", name: "Default", visible: true, locked: false, opacity: 1 })
  }

  add(partial?: Partial<Layer> & { name?: string }): Layer {
    const layer: Layer = {
      id: partial?.id ?? newId("layer"),
      name: partial?.name ?? "Layer",
      visible: partial?.visible ?? true,
      locked: partial?.locked ?? false,
      opacity: partial?.opacity ?? 1,
    }
    this.layers.set(layer.id, layer)
    return layer
  }

  get(id: LayerId): Layer | undefined {
    return this.layers.get(id)
  }

  list(): Layer[] {
    return [...this.layers.values()]
  }

  setVisible(id: LayerId, visible: boolean): void {
    const l = this.layers.get(id)
    if (l) l.visible = visible
  }

  remove(id: LayerId): boolean {
    if (id === "default") return false
    return this.layers.delete(id)
  }
}
