import type { Vec3 } from "../core/types"
import { newId } from "../core/types"

/** Editable triangle mesh in engine space (not Three BufferGeometry). */
export type MeshData = {
  id: string
  name: string
  positions: Float32Array
  normals?: Float32Array
  uvs?: Float32Array
  indices?: Uint32Array
}

export type PrimitiveKind = "box" | "plane" | "cylinder" | "sphere" | "grid"

export function createBoxMesh(size: Vec3 = { x: 1, y: 1, z: 1 }): MeshData {
  const hx = size.x / 2
  const hy = size.y / 2
  const hz = size.z / 2
  // 24 unique verts for flat normals (6 faces * 4)
  const positions = new Float32Array([
    // +z
    -hx, -hy, hz, hx, -hy, hz, hx, hy, hz, -hx, hy, hz,
    // -z
    hx, -hy, -hz, -hx, -hy, -hz, -hx, hy, -hz, hx, hy, -hz,
    // +y
    -hx, hy, hz, hx, hy, hz, hx, hy, -hz, -hx, hy, -hz,
    // -y
    -hx, -hy, -hz, hx, -hy, -hz, hx, -hy, hz, -hx, -hy, hz,
    // +x
    hx, -hy, hz, hx, -hy, -hz, hx, hy, -hz, hx, hy, hz,
    // -x
    -hx, -hy, -hz, -hx, -hy, hz, -hx, hy, hz, -hx, hy, -hz,
  ])
  const indices = new Uint32Array([
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16,
    18, 19, 20, 21, 22, 20, 22, 23,
  ])
  return {
    id: newId("mesh"),
    name: "Box",
    positions,
    indices,
  }
}

export class GeometryStore {
  private meshes = new Map<string, MeshData>()

  add(mesh: MeshData): MeshData {
    this.meshes.set(mesh.id, mesh)
    return mesh
  }

  get(id: string): MeshData | undefined {
    return this.meshes.get(id)
  }

  remove(id: string): boolean {
    return this.meshes.delete(id)
  }

  list(): MeshData[] {
    return [...this.meshes.values()]
  }
}
