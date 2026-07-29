import * as React from 'react'
import type { Node } from '../../engine'
import { getChildNodes } from '../../engine'
import { usePlanaDispatch, usePlanaSelection, usePlanaWorld } from '../hooks'

type TreeNodeProps = {
    node: Node
    depth: number
    path: string
    expanded: Set<string>
    selected: boolean
    onToggle: (key: string) => void
    onSelect: (id: string) => void
    selectedIds: ReadonlySet<string>
}

const TreeNode = React.memo(function TreeNode(props: TreeNodeProps) {
    const { node, depth, path, expanded, selected, selectedIds, onToggle, onSelect } = props
    const children = getChildNodes(node) ?? []
    const hasChildren = children.length > 0
    const key = node.id ?? path
    const isOpen = !hasChildren || expanded.has(key)

    return (
        <li>
            <div className='plana-tree__row' style={{ paddingLeft: Math.max(0, depth * 10) }}>
                <button
                    type='button'
                    className={[
                        'plana-tree__chevron',
                        isOpen ? 'plana-tree__chevron--open' : '',
                        !hasChildren ? 'plana-tree__chevron--leaf' : '',
                    ]
                        .filter(Boolean)
                        .join(' ')}
                    aria-label={isOpen ? 'Collapse' : 'Expand'}
                    aria-expanded={hasChildren ? isOpen : undefined}
                    disabled={!hasChildren}
                    onClick={(e) => {
                        e.stopPropagation()
                        if (hasChildren) onToggle(key)
                    }}
                >
                    <svg width='10' height='10' viewBox='0 0 12 12' aria-hidden='true'>
                        <path
                            d='M4.5 2.5L8 6L4.5 9.5'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth='1.5'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                        />
                    </svg>
                </button>
                <button
                    type='button'
                    className={`plana-tree__item${selected ? ' plana-tree__item--selected' : ''}`}
                    aria-selected={selected}
                    onClick={() => {
                        if (node.id) onSelect(node.id)
                    }}
                >
                    <span className='plana-tree__kind'>{node.kind}</span>
                    <span className='plana-tree__name'>{node.name ?? node.id ?? '(unnamed)'}</span>
                </button>
            </div>
            {hasChildren && isOpen ? (
                <ul>
                    {children.map((child, i) => (
                        <TreeNode
                            key={child.id ?? `${path}-${i}`}
                            node={child}
                            depth={depth + 1}
                            path={`${path}/${child.id ?? i}`}
                            expanded={expanded}
                            selected={child.id ? selectedIds.has(child.id) : false}
                            selectedIds={selectedIds}
                            onToggle={onToggle}
                            onSelect={onSelect}
                        />
                    ))}
                </ul>
            ) : null}
        </li>
    )
})

const collectExpandableKeys = (node: Node, path: string, into: string[]) => {
    const children = getChildNodes(node) ?? []
    if (children.length === 0) return
    into.push(node.id ?? path)
    children.forEach((child, i) => {
        collectExpandableKeys(child, `${path}/${child.id ?? i}`, into)
    })
}

/** Ancestor expand-keys for every selected id (so the row stays visible). */
const collectAncestorKeys = (node: Node, path: string, selected: ReadonlySet<string>, into: Set<string>): boolean => {
    const children = getChildNodes(node) ?? []
    const key = node.id ?? path
    let hit = !!(node.id && selected.has(node.id))
    children.forEach((child, i) => {
        if (collectAncestorKeys(child, `${path}/${child.id ?? i}`, selected, into)) {
            hit = true
        }
    })
    if (hit && children.length > 0) into.add(key)
    return hit
}

/**
 * Hierarchy panel listing the world tree by name / kind / id.
 *
 * Tree groups are collapsible via chevrons (Figma-like). Selection highlight
 * stays in sync with the inspector / 3D selection.
 *
 * @returns Scrollable tree content (wrap in {@link EditorSidebar}).
 */
export function HierarchyPanel() {
    const world = usePlanaWorld()
    const selection = usePlanaSelection()
    const dispatch = usePlanaDispatch()
    const selectedIds = React.useMemo(() => new Set(selection.ids), [selection.ids])

    const [expanded, setExpanded] = React.useState<Set<string>>(() => {
        const keys: string[] = []
        collectExpandableKeys(world, 'root', keys)
        return new Set(keys)
    })
    const knownRef = React.useRef<Set<string>>(new Set(expanded))

    React.useEffect(() => {
        const keys: string[] = []
        collectExpandableKeys(world, 'root', keys)
        setExpanded((prev) => {
            const next = new Set<string>()
            for (const key of keys) {
                if (prev.has(key) || !knownRef.current.has(key)) next.add(key)
            }
            knownRef.current = new Set(keys)
            return next
        })
    }, [world])

    React.useEffect(() => {
        if (selectedIds.size === 0) return
        setExpanded((prev) => {
            const ancestors = new Set<string>()
            collectAncestorKeys(world, 'root', selectedIds, ancestors)
            let changed = false
            const next = new Set(prev)
            for (const key of ancestors) {
                if (!next.has(key)) {
                    next.add(key)
                    changed = true
                }
            }
            return changed ? next : prev
        })
    }, [world, selectedIds])

    const onToggle = React.useCallback((key: string) => {
        setExpanded((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }, [])

    const onSelect = React.useCallback(
        (id: string) => {
            dispatch({ type: 'setSelection', ids: [id] })
        },
        [dispatch]
    )

    return (
        <ul className='plana-tree'>
            <TreeNode
                node={world}
                depth={0}
                path='root'
                expanded={expanded}
                selected={world.id ? selectedIds.has(world.id) : false}
                selectedIds={selectedIds}
                onToggle={onToggle}
                onSelect={onSelect}
            />
        </ul>
    )
}
