import type { Apartment, CompositeObject, Group, IndependentObject, Node, World, Zone } from '../types/nodes'
import { isApartment, isCompositeObject, isGroup, isIndependentObject, isWorld, isZone } from '../types/nodes'
import { NotFoundError } from '../errors'
import { ValidationError } from '../errors'

/**
 * Ensure a node has a defined string `id`.
 *
 * @param node - Node that must identify itself.
 * @returns The node id.
 * @throws {@link ValidationError} When `node.id` is missing or empty.
 *
 * @example
 * ```ts
 * const id = requireId(node)
 * ```
 */
export const requireId = (node: { id?: string }): string => {
    if (!node.id) {
        throw new ValidationError('Node is missing a required id')
    }
    return node.id
}

/**
 * Depth-first search for a node with the given id.
 *
 * @param root - Scene node to search under (usually a {@link World}).
 * @param id - Target node id.
 * @returns The matching node, or `undefined` if not found.
 *
 * @example
 * ```ts
 * const wall = findNodeById(world, 'wall-1')
 * ```
 */
export const findNodeById = (root: Node, id: string): Node | undefined => {
    if (root.id === id) return root

    if (isIndependentObject(root)) return undefined

    if (isCompositeObject(root)) {
        for (const child of root.objects) {
            const found = findNodeById(child, id)
            if (found) return found
        }
        return undefined
    }

    if (isGroup(root) || isZone(root) || isApartment(root) || isWorld(root)) {
        for (const child of root.children) {
            const found = findNodeById(child, id)
            if (found) return found
        }
    }

    return undefined
}

/**
 * Find a node by id or throw.
 *
 * @param root - Scene node to search under.
 * @param id - Target node id.
 * @returns The matching node.
 * @throws {@link NotFoundError} When no node with `id` exists under `root`.
 *
 * @example
 * ```ts
 * const node = requireNodeById(world, 'zone-kitchen')
 * ```
 */
export const requireNodeById = (root: Node, id: string): Node => {
    const found = findNodeById(root, id)
    if (!found) {
        throw new NotFoundError(`Node not found: ${id}`, id)
    }
    return found
}

/**
 * Shallow-clone a world (new root object, same child references).
 *
 * Useful when replacing top-level fields without deep-copying the tree.
 *
 * @param world - World to clone.
 * @returns A new {@link World} object with copied top-level fields.
 *
 * @example
 * ```ts
 * const next = cloneWorldShallow(world)
 * next.name = 'Copy'
 * ```
 */
export const cloneWorldShallow = (world: World): World => ({
    ...world,
    children: [...world.children],
})

/**
 * Return the direct children collection for a container node.
 *
 * @param node - Potential parent node.
 * @returns Child array reference, or `null` for leaf/independent nodes.
 */
export const getChildNodes = (node: Node): Node[] | null => {
    if (isCompositeObject(node)) return node.objects
    if (isGroup(node) || isZone(node) || isApartment(node) || isWorld(node)) return node.children
    return null
}

type ContainerNode = World | Apartment | Zone | Group | CompositeObject

const isContainer = (node: Node): node is ContainerNode => !isIndependentObject(node)

/**
 * Whether `child` may be parented under `parent` given node-kind rules.
 *
 * @param parent - Prospective parent.
 * @param child - Prospective child.
 * @returns `true` when the pairing is allowed.
 */
export const canParentChild = (parent: Node, child: Node): boolean => {
    if (isWorld(parent)) {
        return child.kind === 'apartment' || child.kind === 'group'
    }
    if (isApartment(parent)) {
        return child.kind === 'zone' || child.kind === 'group'
    }
    if (isZone(parent)) {
        return child.kind === 'independent' || child.kind === 'composite' || child.kind === 'group'
    }
    if (isGroup(parent)) {
        return (
            child.kind === 'independent' ||
            child.kind === 'composite' ||
            child.kind === 'zone' ||
            child.kind === 'group'
        )
    }
    if (isCompositeObject(parent)) {
        return child.kind === 'independent'
    }
    return false
}

/**
 * Immutably replace the node with `id` by applying `updater`.
 *
 * Walks from `root` and shallow-clones only the path to the target.
 *
 * @param root - Root of the subtree.
 * @param id - Id of the node to update.
 * @param updater - Function that returns the replacement node.
 * @returns A new root with the update applied, or `null` if `id` was not found.
 */
export const updateNodeById = (root: Node, id: string, updater: (node: Node) => Node): Node | null => {
    if (root.id === id) {
        return updater(root)
    }

    if (!isContainer(root)) return null

    if (isCompositeObject(root)) {
        let changed = false
        const objects: IndependentObject[] = []
        for (const child of root.objects) {
            const next = updateNodeById(child, id, updater)
            if (next) {
                changed = true
                objects.push(next as IndependentObject)
            } else {
                objects.push(child)
            }
        }
        return changed ? { ...root, objects } : null
    }

    let changed = false
    const children: Node[] = []
    for (const child of root.children) {
        const next = updateNodeById(child, id, updater)
        if (next) {
            changed = true
            children.push(next)
        } else {
            children.push(child)
        }
    }

    if (!changed) return null

    if (isWorld(root)) {
        return { ...root, children: children as World['children'] }
    }
    if (isApartment(root)) {
        return { ...root, children: children as Apartment['children'] }
    }
    if (isZone(root)) {
        return { ...root, children: children as Zone['children'] }
    }
    if (isGroup(root)) {
        return { ...root, children: children as Group['children'] }
    }

    return null
}

/**
 * Immutably remove the node with `id` from the tree.
 *
 * @param root - Root of the subtree.
 * @param id - Id of the node to remove.
 * @returns New root and the removed node, or `null` if not found / cannot remove root.
 */
export const removeNodeById = (root: Node, id: string): { root: Node; removed: Node } | null => {
    if (root.id === id) {
        return null
    }

    if (!isContainer(root)) return null

    if (isCompositeObject(root)) {
        const index = root.objects.findIndex((c) => c.id === id)
        if (index >= 0) {
            const removed = root.objects[index]
            const objects = [...root.objects.slice(0, index), ...root.objects.slice(index + 1)]
            return { root: { ...root, objects }, removed }
        }

        for (let i = 0; i < root.objects.length; i++) {
            const result = removeNodeById(root.objects[i], id)
            if (result) {
                const objects = [...root.objects]
                objects[i] = result.root as IndependentObject
                return { root: { ...root, objects }, removed: result.removed }
            }
        }
        return null
    }

    const index = root.children.findIndex((c) => c.id === id)
    if (index >= 0) {
        const removed = root.children[index]
        const children = [...root.children.slice(0, index), ...root.children.slice(index + 1)]
        return { root: withChildren(root, children), removed }
    }

    for (let i = 0; i < root.children.length; i++) {
        const result = removeNodeById(root.children[i], id)
        if (result) {
            const children: Node[] = [...root.children]
            children[i] = result.root
            return { root: withChildren(root, children), removed: result.removed }
        }
    }

    return null
}

const withChildren = (parent: Exclude<ContainerNode, CompositeObject>, children: Node[]): Node => {
    if (isWorld(parent)) return { ...parent, children: children as World['children'] }
    if (isApartment(parent)) return { ...parent, children: children as Apartment['children'] }
    if (isZone(parent)) return { ...parent, children: children as Zone['children'] }
    return { ...parent, children: children as Group['children'] }
}

/**
 * Immutably append `child` under the parent with `parentId`.
 *
 * @param root - Root of the subtree (usually the world).
 * @param parentId - Id of the parent container, or `null` to attach under the world root.
 * @param child - Node to insert.
 * @returns New root with the child added, or `null` if the parent was not found.
 * @throws {@link ValidationError} When the parent cannot accept the child kind.
 */
export const addChildToParent = (root: Node, parentId: string | null, child: Node): Node | null => {
    const matchesParent = parentId === null ? isWorld(root) : root.id !== undefined && root.id === parentId

    if (matchesParent) {
        if (!canParentChild(root, child)) {
            throw new ValidationError(`Cannot add ${child.kind} under parent kind ${root.kind}`)
        }
        return appendChild(root, child)
    }

    if (!isContainer(root)) return null

    if (isCompositeObject(root)) {
        let changed: Node | null = null
        const objects = root.objects.map((c) => {
            if (changed) return c
            const next = addChildToParent(c, parentId, child)
            if (next) {
                changed = next
                return next as IndependentObject
            }
            return c
        })
        return changed ? { ...root, objects } : null
    }

    let changed: Node | null = null
    const children = root.children.map((c) => {
        if (changed) return c
        const next = addChildToParent(c, parentId, child)
        if (next) {
            changed = next
            return next
        }
        return c
    })

    return changed ? withChildren(root, children) : null
}

const appendChild = (parent: Node, child: Node): Node => {
    if (isCompositeObject(parent)) {
        return { ...parent, objects: [...parent.objects, child as IndependentObject] }
    }
    if (isWorld(parent)) {
        return { ...parent, children: [...parent.children, child as World['children'][number]] }
    }
    if (isApartment(parent)) {
        return {
            ...parent,
            children: [...parent.children, child as Apartment['children'][number]],
        }
    }
    if (isZone(parent)) {
        return { ...parent, children: [...parent.children, child as Zone['children'][number]] }
    }
    if (isGroup(parent)) {
        return { ...parent, children: [...parent.children, child as Group['children'][number]] }
    }
    throw new ValidationError(`Cannot append children to kind ${parent.kind}`)
}

/**
 * Create an empty world suitable as a document starting point.
 *
 * @param id - Optional world id. Defaults to `'world'`.
 * @returns A new empty {@link World}.
 *
 * @example
 * ```ts
 * const world = createEmptyWorld()
 * ```
 */
export const createEmptyWorld = (id = 'world'): World => ({
    kind: 'world',
    id,
    x: 0,
    y: 0,
    z: 0,
    width: 0,
    height: 0,
    depth: 0,
    children: [],
})
