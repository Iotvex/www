import type { Mesh as PlanaMesh } from '../../engine'
import * as THREE from 'three'

/**
 * Convert a Plana {@link PlanaMesh} into a Three.js `BufferGeometry`.
 *
 * @param mesh - Engine mesh buffers (positions required; indices/normals optional).
 * @returns A new `THREE.BufferGeometry`.
 */
export const meshToBufferGeometry = (mesh: PlanaMesh): THREE.BufferGeometry => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.positions, 3))
    if (mesh.normals && mesh.normals.length === mesh.positions.length) {
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(mesh.normals, 3))
    } else {
        geometry.computeVertexNormals()
    }
    if (mesh.uvs && mesh.uvs.length > 0) {
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(mesh.uvs, 2))
    }
    if (mesh.indices && mesh.indices.length > 0) {
        geometry.setIndex(mesh.indices)
    }
    geometry.computeBoundingSphere()
    return geometry
}
