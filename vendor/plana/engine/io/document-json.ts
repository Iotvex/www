import type { World } from '../types/nodes'
import { ValidationError } from '../errors'
import {
    PLANA_DOCUMENT_FORMAT,
    PLANA_DOCUMENT_VERSION,
    type ExportDocumentInput,
    type ImportDocumentResult,
    type PlanaDocumentFile,
    type PlanaDocumentMeta,
} from './types'
import { validateWorld } from './validate'

const resolveExportInput = (
    input: ExportDocumentInput
): { world: World; selection?: readonly string[]; meta?: PlanaDocumentMeta } => {
    if ('getWorld' in input) {
        return {
            world: input.getWorld(),
            selection: input.getSelection().ids,
        }
    }
    return input
}

/**
 * Build a {@link PlanaDocumentFile} object from a document or world snapshot.
 *
 * @param input - Document-like object or `{ world, selection?, meta? }`.
 * @returns A serializable document file object.
 *
 * @example
 * ```ts
 * const file = exportDocumentObject({ world: doc.getWorld(), selection: doc.getSelection().ids })
 * ```
 */
export const exportDocumentObject = (input: ExportDocumentInput): PlanaDocumentFile => {
    const { world, selection, meta } = resolveExportInput(input)
    const file: PlanaDocumentFile = {
        format: PLANA_DOCUMENT_FORMAT,
        version: PLANA_DOCUMENT_VERSION,
        world,
    }
    if (meta) file.meta = meta
    if (selection && selection.length > 0) file.selection = [...selection]
    return file
}

/**
 * Serialize a document to pretty-printed JSON.
 *
 * @param input - Document-like object or `{ world, selection?, meta? }`.
 * @returns Pretty-printed JSON string (2-space indent).
 *
 * @example
 * ```ts
 * const json = exportDocumentJson(doc)
 * ```
 */
export const exportDocumentJson = (input: ExportDocumentInput): string => {
    return `${JSON.stringify(exportDocumentObject(input), null, 2)}\n`
}

/**
 * Parse and validate a Plana document JSON string.
 *
 * @param text - Raw JSON text.
 * @returns Validated world and selection.
 * @throws {@link ValidationError} On invalid JSON, format, version, or world tree.
 *
 * @example
 * ```ts
 * const { world, selection } = importDocumentJson(fileText)
 * doc.replaceWorld(world)
 * doc.setSelection(selection)
 * ```
 */
export const importDocumentJson = (text: string): ImportDocumentResult => {
    let parsed: unknown
    try {
        parsed = JSON.parse(text)
    } catch (cause) {
        throw new ValidationError('Invalid JSON', { cause })
    }

    if (!parsed || typeof parsed !== 'object') {
        throw new ValidationError('Document must be a JSON object')
    }

    const record = parsed as Record<string, unknown>

    if (record.format !== PLANA_DOCUMENT_FORMAT) {
        throw new ValidationError(`Unsupported document format: ${String(record.format)}`)
    }
    if (record.version !== PLANA_DOCUMENT_VERSION) {
        throw new ValidationError(`Unsupported document version: ${String(record.version)}`)
    }
    if (!('world' in record)) {
        throw new ValidationError('Document is missing world')
    }

    const world = validateWorld(record.world)

    let selection: string[] = []
    if (record.selection !== undefined) {
        if (!Array.isArray(record.selection) || !record.selection.every((id) => typeof id === 'string')) {
            throw new ValidationError('Document selection must be an array of strings')
        }
        selection = record.selection as string[]
    }

    let meta: PlanaDocumentMeta | undefined
    if (record.meta !== undefined) {
        if (!record.meta || typeof record.meta !== 'object') {
            throw new ValidationError('Document meta must be an object')
        }
        meta = record.meta as PlanaDocumentMeta
    }

    return { world, selection, meta }
}
