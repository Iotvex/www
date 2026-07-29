import { PlanaError } from './plana-error'

/**
 * Thrown when a document command cannot be applied (illegal parent, unsupported kind, etc.).
 *
 * @example
 * ```ts
 * throw new CommandError('Cannot add an apartment under a zone')
 * ```
 */
export class CommandError extends PlanaError {
    /**
     * @param message - Description of why the command failed.
     * @param options - Standard `Error` options (e.g. `cause`).
     */
    constructor(message: string, options?: ErrorOptions) {
        super(message, options)
        this.name = 'CommandError'
    }
}
