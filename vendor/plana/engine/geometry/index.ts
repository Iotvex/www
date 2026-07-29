export { buildBoxMesh } from './box'
export { buildExtrudeMesh, contourToRing } from './extrude'
export { buildWallMesh, flattenPath } from './wall'
export type { WallGap } from './wall'
export { buildCapsuleMesh, buildCylinderMesh, buildSphereMesh } from './primitives'
export {
    buildCutoutMesh,
    buildShapeMesh,
    cutoutToHoleRings,
    cutoutsToWallGaps,
} from './build-shape'
export { buildIndependentGeometry } from './build-independent'
export type { IndependentGeometry } from './build-independent'
export { buildWorldSolids } from './build-world'
export type { WorldSolid } from './build-world'
export {
    computeVertexNormals,
    emptyMesh,
    mergeMeshes,
    pushQuad,
    transformMesh,
} from './mesh'
