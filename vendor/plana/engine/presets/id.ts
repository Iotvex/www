/**
 * Simple id generator for factory helpers.
 *
 * @param prefix - Prefix string (e.g. `'wall'`).
 * @returns A unique id like `wall-a1b2c3`.
 *
 * @example
 * ```ts
 * const id = id('box') // 'box-x7k2m9'
 * ```
 */
export const id = (prefix: string): string => {
    const suffix = Math.random().toString(36).slice(2, 8)
    return `${prefix}-${suffix}`
}
