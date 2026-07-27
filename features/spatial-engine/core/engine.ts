import { Clock } from "./clock"
import { EventBus } from "./events"
import { AnimationService } from "../animation/animation"
import { AssetRegistry } from "../assets/registry"
import { CameraService } from "../camera/camera"
import { ToolService } from "../editing/tools"
import { createBoxMesh, GeometryStore } from "../geometry/mesh-data"
import { HistoryStack, type Command } from "../history/history"
import { SelectionModel } from "../interaction/selection"
import { PluginHost, type SpatialPlugin } from "../plugins/plugin"
import { ThreeRenderer } from "../render/three-renderer"
import { SerializeService, SPATIAL_DOC_VERSION, type SpatialDocument } from "../serialize/format"
import { SceneGraph } from "../scene/graph"
import { LayerStack } from "../scene/layers"
import { SpatialIndex } from "../spatial/index"
import type { NodeId, NodeMetadata, TransformTRS, Vec3 } from "./types"
import { newId, vec3 } from "./types"
import { seedDemoApartment } from "../demo/apartment"

export type SpatialEngineOptions = {
  /** Seed demo geometry for empty scenes. */
  seedDemo?: boolean
}

/**
 * Kernel facade — host applications only need this + viewport binding.
 */
export class SpatialEngine {
  readonly bus = new EventBus()
  readonly clock = new Clock()
  readonly scene: SceneGraph
  readonly layers = new LayerStack()
  readonly geometry = new GeometryStore()
  readonly assets = new AssetRegistry()
  readonly index = new SpatialIndex()
  readonly camera: CameraService
  readonly selection: SelectionModel
  readonly tools: ToolService
  readonly history = new HistoryStack()
  readonly serialize = new SerializeService()
  readonly animation = new AnimationService()
  readonly plugins: PluginHost

  private renderer: ThreeRenderer | null = null
  private raf = 0
  private disposed = false
  private structureUnsub: (() => void) | null = null

  private constructor() {
    this.scene = new SceneGraph(this.bus)
    this.camera = new CameraService(this.bus)
    this.selection = new SelectionModel(this.bus)
    this.tools = new ToolService(this.bus)
    this.plugins = new PluginHost(() => this)
  }

  static create(options: SpatialEngineOptions = {}): SpatialEngine {
    const engine = new SpatialEngine()
    if (options.seedDemo !== false) engine.seedDemoScene()
    engine.bus.emit("engine:ready", { timestamp: Date.now() })
    return engine
  }

  /** Bind a canvas — call once from the host viewport. */
  mount(canvas: HTMLCanvasElement): void {
    this.unmount()
    this.renderer = new ThreeRenderer(canvas, this.scene, this.layers, this.camera, this.selection)
    this.structureUnsub = this.bus.on("scene:structure-changed", () => {
      this.index.rebuild(this.scene)
      this.renderer?.markDirty()
    })
    this.bus.on("scene:node-changed", () => this.renderer?.markDirty())
    this.bus.on("selection:changed", () => this.renderer?.markDirty())
    this.index.rebuild(this.scene)
    this.renderer.markDirty()
    this.clock.startClock()
    const loop = () => {
      if (this.disposed || !this.renderer) return
      const { dt, elapsed } = this.clock.tick()
      this.animation.tick(dt)
      this.bus.emit("engine:tick", { dt, elapsed })
      this.renderer.render()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  unmount(): void {
    cancelAnimationFrame(this.raf)
    this.structureUnsub?.()
    this.structureUnsub = null
    this.renderer?.dispose()
    this.renderer = null
  }

  resize(width: number, height: number): void {
    this.renderer?.resize(width, height)
  }

  dispose(): void {
    this.disposed = true
    this.unmount()
    this.plugins.clear()
    this.bus.emit("engine:dispose", { timestamp: Date.now() })
    this.bus.clear()
  }

  // ── Host-facing scene API ──────────────────────────────────────────

  addBox(name: string, position?: Vec3, metadata?: NodeMetadata): NodeId {
    const mesh = this.geometry.add(createBoxMesh())
    let id = ""
    this.runCommand({
      id: newId("cmd"),
      label: `Add ${name}`,
      do: () => {
        const node = this.scene.add({
          name,
          geometry: { kind: "primitive", primitive: "box" },
          transform: {
            position: position ?? vec3(0, 0.5, 0),
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 },
          },
          metadata: metadata ?? {},
        })
        id = node.id
        void mesh
      },
      undo: () => {
        if (id) this.scene.remove(id)
      },
    })
    return id
  }

  addPrimitive(
    primitive: "box" | "plane" | "cylinder" | "sphere",
    name: string,
    position?: Vec3,
    metadata?: NodeMetadata,
  ): NodeId {
    let id = ""
    this.runCommand({
      id: newId("cmd"),
      label: `Add ${name}`,
      do: () => {
        const node = this.scene.add({
          name,
          geometry: { kind: "primitive", primitive },
          transform: {
            position: position ?? vec3(0, 0.5, 0),
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 },
          },
          metadata: metadata ?? {},
        })
        id = node.id
      },
      undo: () => {
        if (id) this.scene.remove(id)
      },
    })
    return id
  }

  removeNode(id: NodeId): void {
    const snapshot = this.scene.get(id)
    if (!snapshot || id === this.scene.rootId) return
    const clone = structuredClone(snapshot)
    this.runCommand({
      id: newId("cmd"),
      label: `Remove ${snapshot.name}`,
      do: () => this.scene.remove(id),
      undo: () => {
        this.scene.add(clone, clone.parentId ?? this.scene.rootId)
      },
    })
  }

  setNodeMetadata(id: NodeId, metadata: NodeMetadata, merge = true): void {
    this.scene.setMetadata(id, metadata, merge)
  }

  getNodeMetadata(id: NodeId): NodeMetadata | undefined {
    return this.scene.get(id)?.metadata
  }

  setNodeTransform(id: NodeId, transform: TransformTRS): void {
    const prev = this.scene.get(id)?.transform
    if (!prev) return
    const before = structuredClone(prev)
    const after = structuredClone(transform)
    this.runCommand({
      id: newId("cmd"),
      label: "Transform",
      do: () => this.scene.setTransform(id, after),
      undo: () => this.scene.setTransform(id, before),
    })
  }

  pickAt(clientX: number, clientY: number, rect: DOMRect): NodeId | null {
    const id = this.renderer?.pick(clientX, clientY, rect) ?? null
    this.bus.emit("pick:hit", { id: id ?? null })
    return id
  }

  select(ids: NodeId[], additive = false): void {
    if (additive) {
      const set = new Set([...this.selection.selected, ...ids])
      this.selection.set([...set])
    } else {
      this.selection.set(ids)
    }
  }

  exportDocument(meta?: Record<string, unknown>): SpatialDocument {
    return {
      version: SPATIAL_DOC_VERSION,
      nodes: this.scene.toJSON(),
      layers: this.layers.list().map((l) => ({ ...l })),
      cameraBookmarks: this.camera.listBookmarks(),
      meta,
    }
  }

  importDocument(doc: SpatialDocument): void {
    this.scene.loadJSON(doc.nodes)
    this.index.rebuild(this.scene)
    this.renderer?.markDirty()
  }

  registerPlugin(plugin: SpatialPlugin): void {
    this.plugins.register(plugin)
  }

  undo(): void {
    if (this.history.undo()) this.emitHistory()
  }

  redo(): void {
    if (this.history.redo()) this.emitHistory()
  }

  private runCommand(cmd: Command): void {
    this.history.execute(cmd)
    this.emitHistory()
    this.index.rebuild(this.scene)
    this.renderer?.markDirty()
  }

  private emitHistory(): void {
    this.bus.emit("history:changed", {
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
    })
  }

  private seedDemoScene(): void {
    seedDemoApartment(this.scene, this.camera)
  }
}
