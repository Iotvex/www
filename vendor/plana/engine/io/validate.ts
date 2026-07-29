import type { Node, World } from '../types/nodes'
import { ValidationError } from '../errors'
import { getChildNodes } from '../commands/tree'

const KNOWN_KINDS = new Set(['world', 'apartment', 'zone', 'group', 'composite', 'independent'])

/**
 * Light recursive validation that node kinds look sane.
 *
 * @param node - Node to validate.
 * @param path - Dot path for error messages.
 * @throws {@link ValidationError} When a kind is missing or unknown.
 */
export const validateNodeTree = (node: unknown, path = 'world'): void => {
    if (!node || typeof node !== 'object') {
        throw new ValidationError(`Invalid node at ${path}: expected an object`)
    }
    const record = node as Record<string, unknown>
    if (typeof record.kind !== 'string' || !KNOWN_KINDS.has(record.kind)) {
        throw new ValidationError(`Invalid node kind at ${path}: ${String(record.kind)}`)
    }

    const asNode = node as Node
    const children = getChildNodes(asNode)
    if (children) {
        for (let i = 0; i < children.length; i++) {
            validateNodeTree(children[i], `${path}.children[${i}]`)
        }
    }
}

/**
 * Ensure a value is a {@link World} with a sane tree.
 *
 * @param value - Candidate world.
 * @returns The validated world.
 * @throws {@link ValidationError} When validation fails.
 */
export const validateWorld = (value: unknown): World => {
    if (!value || typeof value !== 'object') {
        throw new ValidationError('Document world must be an object')
    }
    if ((value as { kind?: string }).kind !== 'world') {
        throw new ValidationError('Document world.kind must be "world"')
    }
    validateNodeTree(value, 'world')
    return value as World
}
