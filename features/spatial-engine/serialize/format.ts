import type { SceneNode } from "../scene/node"
import type { Layer } from "../scene/layers"
import type { CameraBookmark } from "../camera/camera"

export const SPATIAL_DOC_VERSION = 1

export type SpatialDocument = {
  version: number
  nodes: SceneNode[]
  layers: Layer[]
  cameraBookmarks: CameraBookmark[]
  meta?: Record<string, unknown>
}

export type Importer = {
  id: string
  label: string
  extensions: string[]
  import(data: ArrayBuffer | string): Promise<Partial<SpatialDocument>>
}

export type Exporter = {
  id: string
  label: string
  extension: string
  export(doc: SpatialDocument): Promise<Blob | string>
}

/** Codec + registry ports for future glTF/OBJ/DXF without baking formats into core. */
export class SerializeService {
  private importers = new Map<string, Importer>()
  private exporters = new Map<string, Exporter>()

  registerImporter(importer: Importer): void {
    this.importers.set(importer.id, importer)
  }

  registerExporter(exporter: Exporter): void {
    this.exporters.set(exporter.id, exporter)
  }

  listImporters(): Importer[] {
    return [...this.importers.values()]
  }

  listExporters(): Exporter[] {
    return [...this.exporters.values()]
  }

  toJSON(doc: SpatialDocument): string {
    return JSON.stringify(doc)
  }

  fromJSON(raw: string): SpatialDocument {
    const parsed = JSON.parse(raw) as SpatialDocument
    if (!parsed.version) throw new Error("Invalid spatial document")
    return parsed
  }
}
