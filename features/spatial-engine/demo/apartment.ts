import type { SceneGraph } from "../scene/graph"
import type { NodeMetadata, Quat, Vec3 } from "../core/types"
import { vec3 } from "../core/types"
import type { CameraService } from "../camera/camera"

const IDENTITY: Quat = { x: 0, y: 0, z: 0, w: 1 }
/** PlaneGeometry lies in XY; -90° around X puts it on the floor (XZ). */
const FLOOR_ROT: Quat = { x: -Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }

const WALL_H = 2.4
const WALL_T = 0.12

function addBox(
  scene: SceneGraph,
  name: string,
  position: Vec3,
  scale: Vec3,
  metadata: NodeMetadata = {},
) {
  scene.add({
    name,
    geometry: { kind: "primitive", primitive: "box" },
    transform: { position, rotation: IDENTITY, scale },
    metadata,
  })
}

/**
 * Pre-built studio apartment for Spatial Engine smoke tests.
 * Opaque metadata only — host apps may later bind real entities via these keys.
 */
export function seedDemoApartment(scene: SceneGraph, camera?: CameraService): void {
  // Floor slab ~10×8 m (PlaneGeometry is 2×2 → scale 5 / 4)
  scene.add({
    name: "Floor",
    geometry: { kind: "primitive", primitive: "plane" },
    transform: {
      position: vec3(0, 0, 0),
      rotation: FLOOR_ROT,
      scale: { x: 5, y: 4, z: 1 },
    },
    metadata: { role: "floor", demo: "apartment" },
  })

  // Outer shell
  addBox(scene, "Wall N", vec3(0, WALL_H / 2, -4), { x: 10, y: WALL_H, z: WALL_T }, {
    role: "wall",
  })
  addBox(scene, "Wall S", vec3(0, WALL_H / 2, 4), { x: 10, y: WALL_H, z: WALL_T }, {
    role: "wall",
  })
  addBox(scene, "Wall W", vec3(-5, WALL_H / 2, 0), { x: WALL_T, y: WALL_H, z: 8 }, {
    role: "wall",
  })
  addBox(scene, "Wall E", vec3(5, WALL_H / 2, 0), { x: WALL_T, y: WALL_H, z: 8 }, {
    role: "wall",
  })

  // Interior: living | bedroom split + kitchen / bath
  addBox(scene, "Partition Living–Bedroom", vec3(0, WALL_H / 2, -1.2), {
    x: WALL_T,
    y: WALL_H,
    z: 5.6,
  }, { role: "wall", room: "divider" })
  addBox(scene, "Partition Kitchen", vec3(-2.5, WALL_H / 2, 1.2), {
    x: 5,
    y: WALL_H,
    z: WALL_T,
  }, { role: "wall", room: "kitchen" })
  addBox(scene, "Partition Bath", vec3(2.6, WALL_H / 2, 1.0), {
    x: 4.6,
    y: WALL_H,
    z: WALL_T,
  }, { role: "wall", room: "bath" })
  addBox(scene, "Bath Wall", vec3(2.5, WALL_H / 2, 2.5), {
    x: WALL_T,
    y: WALL_H,
    z: 3,
  }, { role: "wall", room: "bath" })

  // Living room furniture
  addBox(scene, "Sofa", vec3(-2.6, 0.35, -2.6), { x: 2.2, y: 0.7, z: 0.9 }, {
    role: "furniture",
    room: "living",
  })
  addBox(scene, "Coffee Table", vec3(-2.6, 0.2, -1.5), { x: 1.0, y: 0.4, z: 0.55 }, {
    role: "furniture",
    room: "living",
  })
  addBox(scene, "TV Stand", vec3(-2.6, 0.25, -3.6), { x: 1.6, y: 0.5, z: 0.4 }, {
    role: "furniture",
    room: "living",
  })

  // Kitchen
  addBox(scene, "Kitchen Counter", vec3(-3.6, 0.45, 2.6), { x: 2.4, y: 0.9, z: 0.6 }, {
    role: "furniture",
    room: "kitchen",
  })
  addBox(scene, "Fridge", vec3(-1.2, 0.9, 2.8), { x: 0.7, y: 1.8, z: 0.7 }, {
    role: "furniture",
    room: "kitchen",
  })

  // Bedroom
  addBox(scene, "Bed", vec3(2.8, 0.3, -2.4), { x: 1.6, y: 0.55, z: 2.0 }, {
    role: "furniture",
    room: "bedroom",
  })
  addBox(scene, "Nightstand", vec3(1.6, 0.25, -1.5), { x: 0.45, y: 0.5, z: 0.45 }, {
    role: "furniture",
    room: "bedroom",
  })

  // Bath
  addBox(scene, "Vanity", vec3(3.6, 0.4, 2.6), { x: 1.2, y: 0.8, z: 0.5 }, {
    role: "furniture",
    room: "bath",
  })

  // Living-room LED strips (placeholders — bind real entities later via metadata)
  addBox(scene, "Left Strip", vec3(-3.8, 2.15, -2.0), { x: 0.08, y: 0.08, z: 2.4 }, {
    role: "light",
    room: "living",
    hint: "left_strip",
    demo: "apartment",
  })
  addBox(scene, "Right Strip", vec3(-1.4, 2.15, -2.0), { x: 0.08, y: 0.08, z: 2.4 }, {
    role: "light",
    room: "living",
    hint: "right_strip",
    demo: "apartment",
  })

  // Weather station placeholder
  addBox(scene, "Living Room Weather", vec3(-4.2, 1.1, -0.4), { x: 0.25, y: 0.35, z: 0.12 }, {
    role: "sensor",
    room: "living",
    hint: "weather_station",
    demo: "apartment",
  })

  camera?.setLook(vec3(7.5, 6.5, 9.5), vec3(-0.5, 0.8, -0.5))
  camera?.saveBookmark("Demo apartment")
}
