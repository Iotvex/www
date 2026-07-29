import * as React from 'react'
import {
    createBoxObject,
    createEmptyWorld,
    createRoomApartment,
    createWallObject,
    exportDocumentJson,
    findNodeById,
    importDocumentJson,
    isApartment,
    isWorld,
} from '../../engine'
import { usePlanaDispatch, usePlanaDocument, usePlanaSelection, usePlanaWorld } from '../hooks'
import type { DimensionsMode } from '../scene/PlanaDimensions'

/**
 * Props for {@link EditorToolbar}.
 */
export type EditorToolbarProps = {
    /** Dimension overlay mode. */
    dimensionsMode?: DimensionsMode
    /** Set dimension overlay mode. */
    onDimensionsModeChange?: (mode: DimensionsMode) => void
    /** Whether sparse plan hatch is drawn. */
    showHatch?: boolean
    /** Toggle hatch. */
    onToggleHatch?: () => void
}

const DIM_MODES: Array<{ id: DimensionsMode; label: string; title: string }> = [
    { id: 'off', label: 'Off', title: 'Hide dimensions' },
    { id: 'selection', label: 'Selection', title: 'Show sizes for the selection (mm)' },
    { id: 'all', label: 'All', title: 'Show sizes for all objects (mm)' },
]

/**
 * Top toolbar for the Plana editor: file ops, history, and add primitives.
 *
 * @param props - Optional dimensions / hatch wiring.
 * @returns Toolbar element.
 */
export function EditorToolbar(props: EditorToolbarProps = {}) {
    const {
        dimensionsMode = 'off',
        onDimensionsModeChange,
        showHatch = false,
        onToggleHatch,
    } = props
    const doc = usePlanaDocument()
    const world = usePlanaWorld()
    const selection = usePlanaSelection()
    const dispatch = usePlanaDispatch()
    const fileRef = React.useRef<HTMLInputElement>(null)
    const [, force] = React.useReducer((n: number) => n + 1, 0)

    React.useEffect(() => doc.subscribe(() => force()), [doc])

    const findInsertParent = (): string | null => {
        const apt = world.children.find((c) => isApartment(c))
        if (apt?.id) {
            const zone = apt.children.find((c) => c.kind === 'zone')
            if (zone?.id) return zone.id
            return apt.id
        }
        return world.id ?? null
    }

    const onNew = () => {
        dispatch({ type: 'replaceWorld', world: createEmptyWorld('world') })
        dispatch({ type: 'setSelection', ids: [] })
    }

    const onExport = () => {
        const json = exportDocumentJson({
            world: doc.getWorld(),
            selection: doc.getSelection().ids,
            meta: {
                title: world.name ?? 'Plana document',
                modifiedAt: new Date().toISOString(),
            },
        })
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${world.name ?? 'plana-document'}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    const onImportFile = async (file: File) => {
        const text = await file.text()
        const { world: nextWorld, selection: nextSelection } = importDocumentJson(text)
        doc.replaceWorld(nextWorld)
        doc.setSelection(nextSelection, { recordHistory: false })
    }

    const onAddBox = () => {
        const parentId = findInsertParent()
        const box = createBoxObject({ name: 'Box', y: 0.4 })
        dispatch({ type: 'addNode', parentId, node: box })
        if (box.id) dispatch({ type: 'setSelection', ids: [box.id] })
    }

    const onAddWall = () => {
        const parentId = findInsertParent()
        const wall = createWallObject({ name: 'Wall', length: 3 })
        dispatch({ type: 'addNode', parentId, node: wall })
        if (wall.id) dispatch({ type: 'setSelection', ids: [wall.id] })
    }

    const onAddRoom = () => {
        const parentId = isWorld(world) ? (world.id ?? null) : null
        const room = createRoomApartment({ name: 'Room', width: 4, depth: 3.5 })
        dispatch({ type: 'addNode', parentId, node: room })
        if (room.id) dispatch({ type: 'setSelection', ids: [room.id] })
    }

    const onDelete = () => {
        for (const id of selection.ids) {
            const node = findNodeById(world, id)
            if (!node || isWorld(node)) continue
            try {
                dispatch({ type: 'removeNode', id })
            } catch {
                // ignore nodes that cannot be removed
            }
        }
    }

    return (
        <header className='plana-toolbar'>
            <div className='plana-toolbar__brand'>plana</div>
            <div className='plana-toolbar__group'>
                <button type='button' className='plana-btn' onClick={onNew}>
                    New
                </button>
                <button type='button' className='plana-btn' onClick={() => fileRef.current?.click()}>
                    Import JSON
                </button>
                <button type='button' className='plana-btn' onClick={onExport}>
                    Export JSON
                </button>
                <input
                    ref={fileRef}
                    type='file'
                    accept='application/json,.json'
                    hidden
                    onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void onImportFile(file)
                        e.target.value = ''
                    }}
                />
            </div>
            <div className='plana-toolbar__sep' />
            <div className='plana-toolbar__group'>
                <button type='button' className='plana-btn' disabled={!doc.canUndo()} onClick={() => doc.undo()}>
                    Undo
                </button>
                <button type='button' className='plana-btn' disabled={!doc.canRedo()} onClick={() => doc.redo()}>
                    Redo
                </button>
            </div>
            <div className='plana-toolbar__sep' />
            <div className='plana-toolbar__group'>
                <button type='button' className='plana-btn plana-btn--accent' onClick={onAddBox}>
                    Add Box
                </button>
                <button type='button' className='plana-btn plana-btn--accent' onClick={onAddWall}>
                    Add Wall
                </button>
                <button type='button' className='plana-btn plana-btn--accent' onClick={onAddRoom}>
                    Add Room
                </button>
                <button
                    type='button'
                    className='plana-btn plana-btn--danger'
                    disabled={selection.ids.length === 0}
                    onClick={onDelete}
                >
                    Delete
                </button>
            </div>
            {onDimensionsModeChange ? (
                <>
                    <div className='plana-toolbar__sep' />
                    <div className='plana-toolbar__group' role='group' aria-label='Dimensions'>
                        <span className='plana-toolbar__label'>Dimensions</span>
                        <div className='plana-segmented'>
                            {DIM_MODES.map((m) => (
                                <button
                                    key={m.id}
                                    type='button'
                                    className={`plana-segmented__btn${
                                        dimensionsMode === m.id ? ' plana-segmented__btn--active' : ''
                                    }`}
                                    aria-pressed={dimensionsMode === m.id}
                                    title={m.title}
                                    onClick={() => onDimensionsModeChange(m.id)}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            ) : null}
            {onToggleHatch ? (
                <>
                    <div className='plana-toolbar__sep' />
                    <div className='plana-toolbar__group'>
                        <button
                            type='button'
                            className={`plana-btn${showHatch ? ' plana-btn--active' : ''}`}
                            aria-pressed={showHatch}
                            title='Sparse plan hatch (off by default for FPS)'
                            onClick={onToggleHatch}
                        >
                            Hatch
                        </button>
                    </div>
                </>
            ) : null}
        </header>
    )
}
