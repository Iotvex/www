/**
 * Document JSON import / export.
 *
 * @packageDocumentation
 */

/** Schema version written by {@link exportDocumentObject}. */
export const PLANA_DOCUMENT_VERSION = 1 as const

/** Format discriminator for Plana document files. */
export const PLANA_DOCUMENT_FORMAT = 'plana' as const

/**
 * Optional metadata stored alongside a document file.
 */
export type PlanaDocumentMeta = {
    /** Human-readable title. */
    title?: string
    /** ISO-8601 creation timestamp. */
    createdAt?: string
    /** ISO-8601 last-modified timestamp. */
    modifiedAt?: string
    /** Author name or identifier. */
    author?: string
}

/**
 * On-disk / interchange shape for a Plana document.
 */
export type PlanaDocumentFile = {
    /** Always `'plana'`. */
    format: typeof PLANA_DOCUMENT_FORMAT
    /** Schema version; currently {@link PLANA_DOCUMENT_VERSION}. */
    version: typeof PLANA_DOCUMENT_VERSION
    /** Optional file metadata. */
    meta?: PlanaDocumentMeta
    /** Scene root. */
    world: import('../types/nodes').World
    /** Optional selection ids. */
    selection?: string[]
}

/**
 * Input accepted by export helpers (a full document or world + selection).
 */
export type ExportDocumentInput =
    | {
          world: import('../types/nodes').World
          selection?: readonly string[]
          meta?: PlanaDocumentMeta
      }
    | {
          getWorld: () => import('../types/nodes').World
          getSelection: () => { ids: readonly string[] }
      }

/**
 * Result of a successful JSON import.
 */
export type ImportDocumentResult = {
    /** Validated world tree. */
    world: import('../types/nodes').World
    /** Selection ids from the file (empty when omitted). */
    selection: string[]
    /** Optional metadata from the file. */
    meta?: PlanaDocumentMeta
}
