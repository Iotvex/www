import type { Bounds, Node, NodeStyle } from '../../engine'
import { findNodeById, isIndependentObject } from '../../engine'
import { usePlanaDispatch, usePlanaSelection, usePlanaWorld } from '../hooks'
import { CollapsibleSection } from './EditorSidebar'

const BOUND_KEYS: (keyof Bounds)[] = ['x', 'y', 'z', 'width', 'height', 'depth']

function NumberField(props: { label: string; value: number; step?: number; onChange: (value: number) => void }) {
    return (
        <div className='plana-field'>
            <label>{props.label}</label>
            <input
                type='number'
                step={props.step ?? 0.1}
                value={Number.isFinite(props.value) ? props.value : 0}
                onChange={(e) => props.onChange(Number(e.target.value))}
            />
        </div>
    )
}

function TextField(props: { label: string; value: string; onChange: (value: string) => void }) {
    return (
        <div className='plana-field'>
            <label>{props.label}</label>
            <input type='text' value={props.value} onChange={(e) => props.onChange(e.target.value)} />
        </div>
    )
}

function ColorField(props: { label: string; value: string; onChange: (value: string) => void }) {
    const hex = props.value?.startsWith('#') ? props.value : '#c4a574'
    return (
        <div className='plana-field'>
            <label>{props.label}</label>
            <input type='color' value={hex.slice(0, 7)} onChange={(e) => props.onChange(e.target.value)} />
        </div>
    )
}

function CheckField(props: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
    return (
        <div className='plana-field plana-field--check'>
            <input
                type='checkbox'
                checked={props.checked}
                onChange={(e) => props.onChange(e.target.checked)}
                id={`check-${props.label}`}
            />
            <label htmlFor={`check-${props.label}`}>{props.label}</label>
        </div>
    )
}

/**
 * Inspector for the primary selected node: identity, bounds, and style.
 *
 * Sections are collapsible. Wrap in {@link EditorSidebar} for chrome.
 *
 * @returns Inspector content element.
 */
export function InspectorPanel() {
    const world = usePlanaWorld()
    const selection = usePlanaSelection()
    const dispatch = usePlanaDispatch()

    const selectedId = selection.ids[0]
    const node: Node | undefined = selectedId ? findNodeById(world, selectedId) : undefined

    if (!node || !selectedId) {
        return <p className='plana-empty'>Select a node to edit its properties.</p>
    }

    const patchNode = (patch: Partial<Omit<Node, 'kind' | 'id'>>) => {
        dispatch({ type: 'updateNode', id: selectedId, patch })
    }

    const patchBounds = (key: keyof Bounds, value: number) => {
        dispatch({ type: 'updateBounds', id: selectedId, bounds: { [key]: value } })
    }

    const patchStyle = (style: Partial<NodeStyle>) => {
        dispatch({ type: 'updateStyle', id: selectedId, style })
    }

    const style = node.style ?? {}
    const shapeKind = isIndependentObject(node) ? (node.shape?.kind ?? 'box') : '—'
    const sphereRadius = isIndependentObject(node) && node.shape?.kind === 'sphere' ? node.shape.radius : undefined

    return (
        <>
            <CollapsibleSection title='Identity'>
                <TextField label='Name' value={node.name ?? ''} onChange={(name) => patchNode({ name })} />
                <TextField label='Tag' value={node.tag ?? ''} onChange={(tag) => patchNode({ tag })} />
                <div className='plana-field'>
                    <label>Kind</label>
                    <input type='text' value={node.kind} readOnly />
                </div>
                <div className='plana-field'>
                    <label>Id</label>
                    <input type='text' value={selectedId} readOnly />
                </div>
            </CollapsibleSection>

            <CollapsibleSection title='Bounds'>
                <div className='plana-field--row'>
                    {BOUND_KEYS.slice(0, 3).map((key) => (
                        <NumberField
                            key={key}
                            label={key.toUpperCase()}
                            value={node[key]}
                            onChange={(v) => patchBounds(key, v)}
                        />
                    ))}
                </div>
                <div className='plana-field--row'>
                    {BOUND_KEYS.slice(3).map((key) => (
                        <NumberField
                            key={key}
                            label={key}
                            value={node[key]}
                            onChange={(v) => patchBounds(key, v)}
                        />
                    ))}
                </div>
            </CollapsibleSection>

            <CollapsibleSection title='Shape'>
                <div className='plana-field'>
                    <label>Shape kind</label>
                    <input type='text' value={shapeKind} readOnly />
                </div>
                {sphereRadius !== undefined ? (
                    <NumberField
                        label='Radius'
                        value={sphereRadius}
                        onChange={(radius) => {
                            if (!isIndependentObject(node)) return
                            dispatch({
                                type: 'updateIndependent',
                                id: selectedId,
                                patch: { shape: { kind: 'sphere', radius } },
                            })
                        }}
                    />
                ) : null}
            </CollapsibleSection>

            <CollapsibleSection title='Style'>
                <ColorField
                    label='Color'
                    value={style.color ?? '#c4a574'}
                    onChange={(color) => patchStyle({ color })}
                />
                <ColorField
                    label='Accent'
                    value={style.accentColor ?? '#8b6914'}
                    onChange={(accentColor) => patchStyle({ accentColor })}
                />
                <NumberField
                    label='Opacity'
                    value={style.opacity ?? 1}
                    step={0.05}
                    onChange={(opacity) => patchStyle({ opacity })}
                />
                <NumberField
                    label='Metalness'
                    value={style.metalness ?? 0.05}
                    step={0.05}
                    onChange={(metalness) => patchStyle({ metalness })}
                />
                <NumberField
                    label='Roughness'
                    value={style.roughness ?? 0.75}
                    step={0.05}
                    onChange={(roughness) => patchStyle({ roughness })}
                />
                <ColorField
                    label='Outline'
                    value={style.outlineColor ?? '#2a241c'}
                    onChange={(outlineColor) => patchStyle({ outlineColor })}
                />
                <NumberField
                    label='Outline width'
                    value={style.outlineWidth ?? 0.01}
                    step={0.005}
                    onChange={(outlineWidth) => patchStyle({ outlineWidth })}
                />
                <CheckField
                    label='Visible'
                    checked={style.visible !== false}
                    onChange={(visible) => patchStyle({ visible })}
                />
                <CheckField
                    label='Selectable'
                    checked={style.selectable !== false}
                    onChange={(selectable) => patchStyle({ selectable })}
                />
            </CollapsibleSection>
        </>
    )
}
