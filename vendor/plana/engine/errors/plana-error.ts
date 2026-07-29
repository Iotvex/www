/**
 * Base error for all Plana engine failures.
 *
 * Prefer throwing a more specific subclass ({@link ValidationError},
 * {@link NotFoundError}, {@link CommandError}, {@link GeometryError}) so
 * callers can discriminate with `instanceof`.
 *
 * @example
 * ```ts
 * throw new PlanaError('Unexpected engine failure')
 * ```
 */
export class PlanaError extends Error {
    /**
     * @param message - Human-readable description of the failure.
     * @param options - Standard `Error` options (e.g. `cause`).
     */
    constructor(message: string, options?: ErrorOptions) {
        super(message, options)
        this.name = 'PlanaError'
        Object.setPrototypeOf(this, new.target.prototype)
    }
}
