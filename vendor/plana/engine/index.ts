/**
 * Plana calculation engine (no React).
 *
 * @packageDocumentation
 */

export { isApartment, isCompositeObject, isGroup, isIndependentObject, isWorld, isZone } from './types/nodes'
export type {
    Apartment,
    Bounds,
    CompositeObject,
    Contour,
    Cutout,
    FloorArc,
    FloorLine,
    FloorPath,
    FloorSegment,
    Group,
    IndependentObject,
    Mesh,
    Node,
    NodeBase,
    NodeKind,
    NodeStyle,
    Shape,
    Tag,
    Vec2,
    Vec3,
    World,
    Zone,
} from './types/nodes'

export type { Mat4, WorldNode } from './math'
export {
    add2,
    add3,
    boundsSize,
    composeMatrices,
    cross3,
    length2,
    length3,
    mat4Identity,
    mat4Multiply,
    mat4TransformDirection,
    mat4TransformPoint,
    mat4Translate,
    nodeLocalMatrix,
    normalize2,
    normalize3,
    perp2,
    scale2,
    scale3,
    sub2,
    sub3,
    vec2,
    vec3,
    walkWorld,
} from './math'

export type { IndependentGeometry, WallGap, WorldSolid } from './geometry'
export {
    buildBoxMesh,
    buildCapsuleMesh,
    buildCutoutMesh,
    buildCylinderMesh,
    buildExtrudeMesh,
    buildIndependentGeometry,
    buildShapeMesh,
    buildSphereMesh,
    buildWallMesh,
    buildWorldSolids,
    computeVertexNormals,
    contourToRing,
    cutoutToHoleRings,
    cutoutsToWallGaps,
    emptyMesh,
    flattenPath,
    mergeMeshes,
    pushQuad,
    transformMesh,
} from './geometry'

export { CommandError, GeometryError, NotFoundError, PlanaError, ValidationError } from './errors'

export type { Selection } from './selection'
export { createSelection, emptySelection, isSelected, selectionEquals } from './selection'

export type { HistorySnapshot } from './history'
export { createHistorySnapshot, History } from './history'

export type {
    AddNodeCommand,
    ApplyCommandResult,
    Command,
    RemoveNodeCommand,
    ReplaceWorldCommand,
    SetSelectionCommand,
    UpdateBoundsCommand,
    UpdateIndependentCommand,
    UpdateNodeCommand,
    UpdateStyleCommand,
} from './commands'
export {
    addChildToParent,
    applyCommand,
    canParentChild,
    cloneWorldShallow,
    createEmptyWorld,
    findNodeById,
    getChildNodes,
    removeNodeById,
    requireId,
    requireNodeById,
    updateNodeById,
} from './commands'

export type { DocumentChange, DocumentChangeReason, DocumentListener, DocumentOptions } from './document'
export { createDocument, Document } from './document'

export type { ResolvedNodeStyle } from './style'
export { defaultStyle, mergeStyle, resolveStyle } from './style'

export {
    PLANA_DOCUMENT_FORMAT,
    PLANA_DOCUMENT_VERSION,
    exportDocumentJson,
    exportDocumentObject,
    importDocumentJson,
    validateNodeTree,
    validateWorld,
} from './io'
export type { ExportDocumentInput, ImportDocumentResult, PlanaDocumentFile, PlanaDocumentMeta } from './io'

export { createBoxObject, createDemoWorld, createFlatWorld, createRoomApartment, createWallObject, id } from './presets'
export type { CreateBoxObjectOptions, CreateRoomApartmentOptions, CreateWallObjectOptions } from './presets'
