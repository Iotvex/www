import * as THREE from "three"
import type { CameraService } from "../camera/camera"
import type { SceneGraph } from "../scene/graph"
import type { LayerStack } from "../scene/layers"
import type { SelectionModel } from "../interaction/selection"
import type { NodeId } from "../core/types"

/**
 * Three.js render adapter. Owns GPU objects; scene graph remains source of truth.
 */
export class ThreeRenderer {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly perspective: THREE.PerspectiveCamera
  readonly orthographic: THREE.OrthographicCamera
  private objects = new Map<NodeId, THREE.Object3D>()
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private grid: THREE.GridHelper
  private dirty = true
  private orbit = {
    dragging: false,
    lastX: 0,
    lastY: 0,
    spherical: new THREE.Spherical(12, 1.0, 0.6),
  }

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly graph: SceneGraph,
    private readonly layers: LayerStack,
    private readonly camera: CameraService,
    private readonly selection: SelectionModel,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0f1218)

    this.perspective = new THREE.PerspectiveCamera(50, 1, 0.05, 2000)
    this.orthographic = new THREE.OrthographicCamera(-8, 8, 8, -8, 0.05, 2000)

    const hemi = new THREE.HemisphereLight(0xc8d6e5, 0x1a1e26, 0.85)
    const dir = new THREE.DirectionalLight(0xffffff, 0.75)
    dir.position.set(5, 10, 4)
    this.scene.add(hemi, dir)

    this.grid = new THREE.GridHelper(40, 40, 0x3a4555, 0x232a35)
    this.grid.position.y = 0
    this.scene.add(this.grid)

    this.syncFromCameraService()
    this.bindPointer()
  }

  markDirty(): void {
    this.dirty = true
  }

  resize(width: number, height: number): void {
    const w = Math.max(1, width)
    const h = Math.max(1, height)
    this.renderer.setSize(w, h, false)
    this.perspective.aspect = w / h
    this.perspective.updateProjectionMatrix()
    const aspect = w / h
    const size = this.camera.orthoSize
    this.orthographic.left = -size * aspect
    this.orthographic.right = size * aspect
    this.orthographic.top = size
    this.orthographic.bottom = -size
    this.orthographic.updateProjectionMatrix()
    this.markDirty()
  }

  syncGraph(): void {
    const live = new Set<NodeId>()
    for (const node of this.graph.list()) {
      if (node.id === this.graph.rootId) continue
      live.add(node.id)
      let obj = this.objects.get(node.id)
      if (!obj) {
        const role =
          typeof node.metadata.role === "string" ? node.metadata.role : undefined
        obj = this.createObject(
          node.geometry.kind === "primitive" ? node.geometry.primitive : "box",
          role,
        )
        obj.name = node.id
        this.objects.set(node.id, obj)
        this.scene.add(obj)
      }
      const layer = this.layers.get(node.layerId)
      obj.visible = node.visible && (layer?.visible ?? true)
      obj.position.set(node.transform.position.x, node.transform.position.y, node.transform.position.z)
      obj.scale.set(node.transform.scale.x, node.transform.scale.y, node.transform.scale.z)
      obj.quaternion.set(
        node.transform.rotation.x,
        node.transform.rotation.y,
        node.transform.rotation.z,
        node.transform.rotation.w,
      )
      this.applySelectionStyle(node.id, obj)
    }
    for (const [id, obj] of this.objects) {
      if (!live.has(id)) {
        this.scene.remove(obj)
        disposeObject(obj)
        this.objects.delete(id)
      }
    }
    this.dirty = false
  }

  syncFromCameraService(): void {
    const cam = this.activeCamera()
    cam.position.set(this.camera.position.x, this.camera.position.y, this.camera.position.z)
    cam.lookAt(this.camera.target.x, this.camera.target.y, this.camera.target.z)
    if (cam instanceof THREE.PerspectiveCamera) {
      cam.fov = this.camera.fov
      cam.updateProjectionMatrix()
    }
    this.orbit.spherical.setFromVector3(
      new THREE.Vector3().subVectors(cam.position, new THREE.Vector3(this.camera.target.x, this.camera.target.y, this.camera.target.z)),
    )
  }

  activeCamera(): THREE.Camera {
    return this.camera.orthographic ? this.orthographic : this.perspective
  }

  render(): void {
    if (this.dirty) this.syncGraph()
    this.syncFromCameraService()
    this.renderer.render(this.scene, this.activeCamera())
  }

  pick(clientX: number, clientY: number, rect: DOMRect): NodeId | null {
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.activeCamera())
    const hits = this.raycaster.intersectObjects([...this.objects.values()], true)
    for (const hit of hits) {
      let o: THREE.Object3D | null = hit.object
      while (o) {
        if (this.objects.has(o.name as NodeId)) return o.name as NodeId
        o = o.parent
      }
    }
    return null
  }

  dispose(): void {
    for (const obj of this.objects.values()) {
      this.scene.remove(obj)
      disposeObject(obj)
    }
    this.objects.clear()
    this.scene.remove(this.grid)
    disposeObject(this.grid)
    this.renderer.dispose()
  }

  private createObject(primitive: string, role?: string): THREE.Object3D {
    let geom: THREE.BufferGeometry
    switch (primitive) {
      case "plane":
        geom = new THREE.PlaneGeometry(2, 2)
        break
      case "cylinder":
        geom = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 24)
        break
      case "sphere":
        geom = new THREE.SphereGeometry(0.55, 24, 16)
        break
      case "grid":
        return new THREE.GridHelper(4, 8, 0x6688aa, 0x334455)
      case "box":
      default:
        geom = new THREE.BoxGeometry(1, 1, 1)
    }
    const mat = new THREE.MeshStandardMaterial({
      color: colorForRole(role),
      metalness: role === "light" ? 0.35 : 0.12,
      roughness: role === "floor" ? 0.85 : 0.55,
    })
    return new THREE.Mesh(geom, mat)
  }

  private applySelectionStyle(id: NodeId, obj: THREE.Object3D): void {
    const selected = this.selection.isSelected(id)
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        child.material.emissive = new THREE.Color(selected ? 0x224466 : 0x000000)
        child.material.emissiveIntensity = selected ? 0.45 : 0
      }
    })
  }

  private bindPointer(): void {
    const el = this.canvas
    el.addEventListener("pointerdown", (e) => {
      if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) {
        this.orbit.dragging = true
        this.orbit.lastX = e.clientX
        this.orbit.lastY = e.clientY
      }
    })
    window.addEventListener("pointerup", () => {
      this.orbit.dragging = false
    })
    window.addEventListener("pointermove", (e) => {
      if (!this.orbit.dragging) return
      const dx = e.clientX - this.orbit.lastX
      const dy = e.clientY - this.orbit.lastY
      this.orbit.lastX = e.clientX
      this.orbit.lastY = e.clientY
      this.orbit.spherical.theta -= dx * 0.005
      this.orbit.spherical.phi = THREE.MathUtils.clamp(this.orbit.spherical.phi + dy * 0.005, 0.05, Math.PI - 0.05)
      const offset = new THREE.Vector3().setFromSpherical(this.orbit.spherical)
      const target = new THREE.Vector3(this.camera.target.x, this.camera.target.y, this.camera.target.z)
      const pos = target.clone().add(offset)
      this.camera.setLook({ x: pos.x, y: pos.y, z: pos.z }, this.camera.target)
    })
    el.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault()
        this.orbit.spherical.radius = THREE.MathUtils.clamp(
          this.orbit.spherical.radius * (e.deltaY > 0 ? 1.08 : 0.92),
          0.5,
          200,
        )
        const offset = new THREE.Vector3().setFromSpherical(this.orbit.spherical)
        const target = new THREE.Vector3(this.camera.target.x, this.camera.target.y, this.camera.target.z)
        const pos = target.clone().add(offset)
        this.camera.setLook({ x: pos.x, y: pos.y, z: pos.z }, this.camera.target)
        if (this.camera.orthographic) {
          this.camera.orthoSize = THREE.MathUtils.clamp(
            this.camera.orthoSize * (e.deltaY > 0 ? 1.08 : 0.92),
            0.5,
            200,
          )
        }
      },
      { passive: false },
    )
    el.addEventListener("contextmenu", (e) => e.preventDefault())
  }
}

function colorForRole(role?: string): number {
  switch (role) {
    case "floor":
      return 0x2a3038
    case "wall":
      return 0x8a939e
    case "furniture":
      return 0x5c6d7e
    case "light":
      return 0xd45a4a
    case "sensor":
      return 0x4a9e6e
    default:
      return 0x6b8cae
  }
}

function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose()
      const mat = child.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat?.dispose()
    }
  })
}
