import type { IndependentObject, Node, World } from '../types/nodes'
import { isIndependentObject, isWorld } from '../types/nodes'
import { CommandError, NotFoundError, ValidationError } from '../errors'
import { mergeStyle } from '../style'
import type { ApplyCommandResult, Command } from './types'
import { addChildToParent, findNodeById, removeNodeById, requireId, updateNodeById } from './tree'

/**
 * Apply a command to a world, returning a new world (immutable update).
 *
 * Selection-only commands (`setSelection`) leave the world unchanged and
 * return `selectionIds` for the document layer to apply.
 *
 * @param world - Current world.
 * @param command - Command to apply.
 * @returns Updated world and optional selection override.
 * @throws {@link ValidationError} On invalid input (missing ids, illegal parent/child).
 * @throws {@link NotFoundError} When a referenced node id cannot be found.
 * @throws {@link CommandError} When the command cannot be applied for other reasons.
 *
 * @example
 * ```ts
 * const { world: next } = applyCommand(world, {
 *   type: 'addNode',
 *   parentId: 'apartment-1',
 *   node: {
 *     kind: 'group',
 *     id: 'g1',
 *     x: 0, y: 0, z: 0,
 *     width: 1, height: 1, depth: 1,
 *     children: [],
 *   },
 * })
 * ```
 */
export const applyCommand = (world: World, command: Command): ApplyCommandResult => {
    switch (command.type) {
        case 'replaceWorld': {
            if (!isWorld(command.world)) {
                throw new ValidationError('replaceWorld requires a node with kind "world"')
            }
            return { world: command.world }
        }

        case 'setSelection': {
            return { world, selectionIds: command.ids }
        }

        case 'addNode': {
            requireId(command.node)
            const nodeId = command.node.id!
            if (findNodeById(world, nodeId)) {
                throw new ValidationError(`Node id already exists: ${nodeId}`)
            }

            const next = addChildToParent(world, command.parentId, command.node)
            if (!next || !isWorld(next)) {
                const id = command.parentId ?? world.id
                throw new NotFoundError(`Parent not found: ${id ?? '(world root)'}`, id ?? undefined)
            }
            return { world: next }
        }

        case 'removeNode': {
            if (world.id === command.id) {
                throw new CommandError('Cannot remove the world root')
            }
            const result = removeNodeById(world, command.id)
            if (!result || !isWorld(result.root)) {
                throw new NotFoundError(`Node not found: ${command.id}`, command.id)
            }
            return { world: result.root }
        }

        case 'updateIndependent': {
            const existing = findNodeById(world, command.id)
            if (!existing) {
                throw new NotFoundError(`Node not found: ${command.id}`, command.id)
            }
            if (!isIndependentObject(existing)) {
                throw new CommandError(`updateIndependent requires an independent node (got ${existing.kind})`)
            }
            const next = updateNodeById(world, command.id, (node) => {
                const patched: IndependentObject = {
                    ...(node as IndependentObject),
                    ...command.patch,
                    kind: 'independent',
                    id: command.id,
                }
                return patched
            })
            if (!next || !isWorld(next)) {
                throw new NotFoundError(`Node not found: ${command.id}`, command.id)
            }
            return { world: next }
        }

        case 'updateBounds': {
            if (!findNodeById(world, command.id)) {
                throw new NotFoundError(`Node not found: ${command.id}`, command.id)
            }
            const next = updateNodeById(world, command.id, (node) => ({
                ...node,
                ...command.bounds,
            }))
            if (!next || !isWorld(next)) {
                throw new NotFoundError(`Node not found: ${command.id}`, command.id)
            }
            return { world: next }
        }

        case 'updateStyle': {
            if (!findNodeById(world, command.id)) {
                throw new NotFoundError(`Node not found: ${command.id}`, command.id)
            }
            const next = updateNodeById(world, command.id, (node) => ({
                ...node,
                style: mergeStyle(node.style, command.style),
            }))
            if (!next || !isWorld(next)) {
                throw new NotFoundError(`Node not found: ${command.id}`, command.id)
            }
            return { world: next }
        }

        case 'updateNode': {
            if (!findNodeById(world, command.id)) {
                throw new NotFoundError(`Node not found: ${command.id}`, command.id)
            }
            const next = updateNodeById(world, command.id, (node) => {
                const {
                    kind: _kind,
                    id: _id,
                    ...safePatch
                } = command.patch as Partial<Node> & {
                    kind?: Node['kind']
                    id?: string
                }
                void _kind
                void _id
                return {
                    ...node,
                    ...safePatch,
                    kind: node.kind,
                    id: command.id,
                } as typeof node
            })
            if (!next || !isWorld(next)) {
                throw new NotFoundError(`Node not found: ${command.id}`, command.id)
            }
            return { world: next }
        }

        default: {
            const _exhaustive: never = command
            throw new CommandError(`Unknown command: ${JSON.stringify(_exhaustive)}`)
        }
    }
}
