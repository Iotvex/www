import * as React from 'react'

const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 480
/** Bumped when stored shape / defaults change — drops stuck collapsed / zero-width prefs. */
const SIDEBAR_STORAGE_VERSION = 2

type Side = 'left' | 'right'

type StoredSidebar = {
    width: number
    collapsed: boolean
    v?: number
}

const clampWidth = (value: number) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(value)))

const isSaneStored = (parsed: Partial<StoredSidebar>): boolean => {
    if (parsed.v !== SIDEBAR_STORAGE_VERSION) return false
    if (typeof parsed.width !== 'number' || !Number.isFinite(parsed.width)) return false
    if (parsed.width < SIDEBAR_MIN || parsed.width > SIDEBAR_MAX) return false
    if (typeof parsed.collapsed !== 'boolean') return false
    return true
}

const readStored = (key: string, fallback: StoredSidebar): StoredSidebar => {
    if (typeof window === 'undefined') return fallback
    try {
        const raw = window.localStorage.getItem(key)
        if (!raw) return fallback
        const parsed = JSON.parse(raw) as Partial<StoredSidebar>
        if (!isSaneStored(parsed)) {
            // Migrate away from pre-v2 / corrupted prefs (width 0, stuck collapsed, etc.).
            window.localStorage.removeItem(key)
            return fallback
        }
        return {
            width: clampWidth(parsed.width as number),
            collapsed: parsed.collapsed as boolean,
            v: SIDEBAR_STORAGE_VERSION,
        }
    } catch {
        return fallback
    }
}

const writeStored = (key: string, value: StoredSidebar) => {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(
            key,
            JSON.stringify({ ...value, v: SIDEBAR_STORAGE_VERSION })
        )
    } catch {
        // ignore quota / private mode
    }
}

/**
 * Persistable width + collapse state for an editor sidebar.
 *
 * @param storageKey - `localStorage` key.
 * @param defaultWidth - Initial width when nothing is stored.
 * @returns Width, collapsed flag, and setters.
 */
export function useSidebarState(storageKey: string, defaultWidth: number) {
    const [state, setState] = React.useState<StoredSidebar>(() =>
        readStored(storageKey, {
            width: clampWidth(defaultWidth),
            collapsed: false,
            v: SIDEBAR_STORAGE_VERSION,
        })
    )

    React.useEffect(() => {
        writeStored(storageKey, state)
    }, [storageKey, state])

    const setWidth = React.useCallback((width: number) => {
        setState((prev) => {
            const next = clampWidth(width)
            if (prev.width === next) return prev
            return { ...prev, width: next, collapsed: false }
        })
    }, [])

    const setCollapsed = React.useCallback((collapsed: boolean) => {
        setState((prev) => (prev.collapsed === collapsed ? prev : { ...prev, collapsed }))
    }, [])

    const toggleCollapsed = React.useCallback(() => {
        setState((prev) => ({ ...prev, collapsed: !prev.collapsed }))
    }, [])

    return {
        width: state.width,
        collapsed: state.collapsed,
        setWidth,
        setCollapsed,
        toggleCollapsed,
        minWidth: SIDEBAR_MIN,
        maxWidth: SIDEBAR_MAX,
    }
}

function ChevronIcon() {
    return (
        <svg width='12' height='12' viewBox='0 0 12 12' aria-hidden='true'>
            <path
                d='M4.5 2.5L8 6L4.5 9.5'
                fill='none'
                stroke='currentColor'
                strokeWidth='1.5'
                strokeLinecap='round'
                strokeLinejoin='round'
            />
        </svg>
    )
}

/**
 * Props for {@link EditorSidebar}.
 */
export type EditorSidebarProps = {
    /** Panel title shown in the header / collapsed rail. */
    title: string
    /** Which edge hosts the resize handle. */
    side: Side
    /** Current width in pixels. */
    width: number
    /** Whether the panel content is collapsed to a rail. */
    collapsed: boolean
    /** Called while the user drags the resize handle. */
    onWidthChange: (width: number) => void
    /** Toggle collapse / expand. */
    onToggleCollapsed: () => void
    /** Panel body content. */
    children: React.ReactNode
}

/**
 * Resizable, collapsible editor sidebar (Hierarchy / Inspector).
 *
 * Content stays mounted while collapsed (hidden via CSS) so scroll position and
 * React state survive collapse / expand. Width uses flex-basis so panels cannot
 * shrink to zero under canvas resize thrashing.
 *
 * @param props - Layout and content props.
 * @returns Aside element with drag-resize and collapse controls.
 */
export function EditorSidebar(props: EditorSidebarProps) {
    const { title, side, width, collapsed, onWidthChange, onToggleCollapsed, children } = props
    const drag = React.useRef<{ startX: number; startWidth: number } | null>(null)

    React.useEffect(() => {
        const onMove = (event: PointerEvent) => {
            const active = drag.current
            if (!active) return
            const delta = event.clientX - active.startX
            const next = side === 'left' ? active.startWidth + delta : active.startWidth - delta
            onWidthChange(next)
        }
        const onUp = () => {
            drag.current = null
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        return () => {
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
        }
    }, [onWidthChange, side])

    const startResize = (event: React.PointerEvent) => {
        event.preventDefault()
        drag.current = { startX: event.clientX, startWidth: width }
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
    }

    const className = ['plana-panel', collapsed ? 'plana-panel--collapsed' : '']
        .filter(Boolean)
        .join(' ')

    const panelStyle: React.CSSProperties = collapsed
        ? {
              width: 'var(--pe-sidebar-rail)',
              flex: '0 0 var(--pe-sidebar-rail)',
              minWidth: 'var(--pe-sidebar-rail)',
              maxWidth: 'var(--pe-sidebar-rail)',
          }
        : {
              width,
              flex: `0 0 ${width}px`,
              minWidth: width,
              maxWidth: width,
          }

    return (
        <aside className={className} style={panelStyle}>
            <div className='plana-panel__rail' hidden={!collapsed}>
                <button
                    type='button'
                    className='plana-btn plana-btn--icon'
                    aria-label={`Expand ${title}`}
                    title={`Expand ${title}`}
                    onClick={onToggleCollapsed}
                >
                    <ChevronIcon />
                </button>
                <span className='plana-panel__rail-label'>{title}</span>
            </div>
            <div className='plana-panel__header' hidden={collapsed}>
                <div className='plana-panel__title'>{title}</div>
                <button
                    type='button'
                    className='plana-btn plana-btn--icon'
                    aria-label={`Collapse ${title}`}
                    title={`Collapse ${title}`}
                    onClick={onToggleCollapsed}
                >
                    <span
                        style={{
                            display: 'inline-flex',
                            transform: side === 'left' ? 'scaleX(-1)' : undefined,
                        }}
                    >
                        <ChevronIcon />
                    </span>
                </button>
            </div>
            <div
                className={
                    collapsed ? 'plana-panel__body plana-panel__body--parked' : 'plana-panel__body'
                }
                hidden={collapsed}
                aria-hidden={collapsed}
            >
                {children}
            </div>
            {!collapsed ? (
                <div
                    className={`plana-panel__resize plana-panel__resize--${side}`}
                    onPointerDown={startResize}
                    role='separator'
                    aria-orientation='vertical'
                    aria-label={`Resize ${title}`}
                />
            ) : null}
        </aside>
    )
}

/**
 * Props for {@link CollapsibleSection}.
 */
export type CollapsibleSectionProps = {
    /** Section heading. */
    title: string
    /** Whether the section starts open. Defaults to `true`. */
    defaultOpen?: boolean
    /** Section body. */
    children: React.ReactNode
}

/**
 * Figma-like collapsible inspector section with a chevron header.
 *
 * @param props - Title and body.
 * @returns A section element.
 */
export function CollapsibleSection(props: CollapsibleSectionProps) {
    const { title, defaultOpen = true, children } = props
    const [open, setOpen] = React.useState(defaultOpen)

    return (
        <section className='plana-section'>
            <button
                type='button'
                className='plana-section__header'
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
            >
                <span className={`plana-section__chevron${open ? ' plana-section__chevron--open' : ''}`}>
                    <ChevronIcon />
                </span>
                <h3 className='plana-section__title'>{title}</h3>
            </button>
            {open ? <div className='plana-section__body'>{children}</div> : null}
        </section>
    )
}
