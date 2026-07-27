import type { SpatialEngine } from "../core/engine"

export type SpatialPluginContext = {
  engine: SpatialEngine
}

export type SpatialPlugin = {
  id: string
  name: string
  setup(ctx: SpatialPluginContext): void | (() => void)
}

export class PluginHost {
  private disposers = new Map<string, () => void>()

  constructor(private readonly getEngine: () => SpatialEngine) {}

  register(plugin: SpatialPlugin): void {
    if (this.disposers.has(plugin.id)) this.unregister(plugin.id)
    const dispose = plugin.setup({ engine: this.getEngine() })
    this.disposers.set(plugin.id, typeof dispose === "function" ? dispose : () => undefined)
  }

  unregister(id: string): void {
    const d = this.disposers.get(id)
    if (d) {
      d()
      this.disposers.delete(id)
    }
  }

  clear(): void {
    for (const id of [...this.disposers.keys()]) this.unregister(id)
  }
}
