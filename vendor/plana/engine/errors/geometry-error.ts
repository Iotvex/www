import { PlanaError } from './plana-error'

/**
 * Thrown when mesh or solid construction fails (degenerate contour, unsupported shape, etc.).
 *
 * @example
 * ```ts
 * throw new GeometryError('Contour must contain at least 3 points')
 * ```
 */
export class GeometryError extends PlanaError {
    /**
     * @param message - Description of the geometry failure.
     * @param options - Standard `Error` options (e.g. `cause`).
     */
    constructor(message: string, options?: ErrorOptions) {
        super(message, options)
        this.name = 'GeometryError'
    }
}
