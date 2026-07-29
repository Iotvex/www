import { PlanaError } from './plana-error'

/**
 * Thrown when a requested node or resource cannot be found in the document tree.
 *
 * @example
 * ```ts
 * throw new NotFoundError(`Node not found: ${id}`)
 * ```
 */
export class NotFoundError extends PlanaError {
    /**
     * Identifier that could not be resolved, when applicable.
     */
    readonly id?: string

    /**
     * @param message - Description of what was missing.
     * @param id - Optional resource id that was looked up.
     * @param options - Standard `Error` options (e.g. `cause`).
     */
    constructor(message: string, id?: string, options?: ErrorOptions) {
        super(message, options)
        this.name = 'NotFoundError'
        this.id = id
    }
}
