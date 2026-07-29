import * as React from 'react'
import type { Document, World } from '../../engine'
import { createDemoWorld, findNodeById, isWorld } from '../../engine'
import { PlanaProvider } from '../provider'
import { usePlanaDispatch, usePlanaDocument, usePlanaSelection, usePlanaWorld } from '../hooks'
import { PlanaCanvas } from '../scene'
import type { DimensionsMode } from '../scene/PlanaDimensions'
import { EditorSidebar, useSidebarState } from './EditorSidebar'
import { EditorToolbar } from './EditorToolbar'
import { HierarchyPanel } from './HierarchyPanel'
import { InspectorPanel } from './InspectorPanel'
import { editorStyles } from './styles'

/**
 * Props for {@link PlanaEditor}.
 */
export type PlanaEditorProps = {
    /**
     * Existing document to edit. When omitted, a document is created from
     * {@link PlanaEditorProps.world} (or {@link createDemoWorld}).
     */
    document?: Document
    /** Initial world used only when `document` is not passed. */
    world?: World
    /** Optional class name on the root editor element. */
    className?: string
    /** Inject the built-in editor stylesheet. Defaults to `true`. */
    injectStyles?: boolean
}

function EditorKeyboard() {
    const doc = usePlanaDocument()
    const world = usePlanaWorld()
    const selection = usePlanaSelection()
    const dispatch = usePlanaDispatch()

    React.useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                return
            }

            const mod = event.metaKey || event.ctrlKey
            if (mod && event.key.toLowerCase() === 'z') {
                event.preventDefault()
                if (event.shiftKey) doc.redo()
                else doc.undo()
                return
            }

            if (event.key === 'Delete' || event.key === 'Backspace') {
                if (selection.ids.length === 0) return
                event.preventDefault()
                for (const id of [...selection.ids]) {
                    const node = findNodeById(world, id)
                    if (!node || isWorld(node)) continue
                    try {
                        dispatch({ type: 'removeNode', id })
                    } catch {
                        // ignore
                    }
                }
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [dispatch, doc, selection.ids, world])

    return null
}

/** Isolates R3F from sidebar width/collapse re-renders. */
const EditorViewport = React.memo(function EditorViewport(props: {
    dimensionsMode: DimensionsMode
    showHatch: boolean
}) {
    return (
        <div className='plana-editor__viewport'>
            <PlanaCanvas dimensionsMode={props.dimensionsMode} showHatch={props.showHatch} />
        </div>
    )
})

function EditorShell(props: { className?: string }) {
    const left = useSidebarState('plana.editor.hierarchy', 260)
    const right = useSidebarState('plana.editor.inspector', 300)
    const [dimensionsMode, setDimensionsMode] = React.useState<DimensionsMode>('selection')
    const [showHatch, setShowHatch] = React.useState(false)

    return (
        <div className={['plana-editor', props.className].filter(Boolean).join(' ')}>
            <EditorKeyboard />
            <EditorToolbar
                dimensionsMode={dimensionsMode}
                onDimensionsModeChange={setDimensionsMode}
                showHatch={showHatch}
                onToggleHatch={() => setShowHatch((v) => !v)}
            />
            <div className='plana-editor__body'>
                <EditorSidebar
                    title='Hierarchy'
                    side='left'
                    width={left.width}
                    collapsed={left.collapsed}
                    onWidthChange={left.setWidth}
                    onToggleCollapsed={left.toggleCollapsed}
                >
                    <HierarchyPanel />
                </EditorSidebar>
                <EditorViewport dimensionsMode={dimensionsMode} showHatch={showHatch} />
                <EditorSidebar
                    title='Inspector'
                    side='right'
                    width={right.width}
                    collapsed={right.collapsed}
                    onWidthChange={right.setWidth}
                    onToggleCollapsed={right.toggleCollapsed}
                >
                    <InspectorPanel />
                </EditorSidebar>
            </div>
        </div>
    )
}

/**
 * Full-screen Plana apartment plan editor.
 *
 * Layout: top toolbar, left hierarchy, center 3D canvas, right inspector.
 * Keyboard: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo, Delete remove selection.
 *
 * @param props - Optional document/world and presentation options.
 * @returns The editor root element wrapped in {@link PlanaProvider}.
 *
 * @example
 * ```tsx
 * import { PlanaEditor, createDemoWorld } from 'plana'
 *
 * export function App() {
 *   return <PlanaEditor world={createDemoWorld()} />
 * }
 * ```
 */
export function PlanaEditor(props: PlanaEditorProps = {}) {
    const { document, world = createDemoWorld(), className, injectStyles = true } = props

    return (
        <>
            {injectStyles ? <style data-plana-editor-styles>{editorStyles}</style> : null}
            <PlanaProvider document={document} world={document ? undefined : world}>
                <EditorShell className={className} />
            </PlanaProvider>
        </>
    )
}
