import { PlanaError } from './plana-error'

/**
 * Thrown when input data violates engine invariants (missing id, wrong node kind, etc.).
 *
 * @example
 * ```ts
 * throw new ValidationError('Node is missing a required id')
 * ```
 */
export class ValidationError extends PlanaError {
    /**
     * @param message - Description of the validation failure.
     * @param options - Standard `Error` options (e.g. `cause`).
     */
    constructor(message: string, options?: ErrorOptions) {
        super(message, options)
        this.name = 'ValidationError'
    }
}
