import * as React from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Selection, World, WorldSolid } from '../../engine'
import { buildWorldSolids, resolveStyle } from '../../engine'

/** Dimension overlay mode for the editor / canvas. */
export type DimensionsMode = 'off' | 'selection' | 'all'

const toMm = (meters: number) => Math.round(Math.abs(meters) * 1000)

const formatDims = (solid: WorldSolid): string => {
    const node = solid.object
    const w = toMm(node.width)
    const h = toMm(node.height)
    const d = toMm(node.depth)
    if (node.tag === 'wall' || node.shape?.kind === 'wall') {
        const length = Math.max(w, d)
        const thickness = Math.min(w, d)
        return `L ${length} · H ${h} · T ${thickness}`
    }
    return `W ${w} · H ${h} · D ${d}`
}

type DimLabelProps = {
    solid: WorldSolid
    emphasis?: boolean
}

function DimLabel(props: DimLabelProps) {
    const { solid, emphasis = false } = props
    const position = React.useMemo((): [number, number, number] => {
        const m = new THREE.Matrix4().fromArray(solid.worldMatrix)
        const origin = new THREE.Vector3().setFromMatrixPosition(m)
        return [origin.x, origin.y + solid.object.height * 0.5 + 0.12, origin.z]
    }, [solid])

    return (
        <Html position={position} center sprite zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
            <div className={emphasis ? 'plana-dim plana-dim--emphasis' : 'plana-dim'}>{formatDims(solid)}</div>
        </Html>
    )
}

/**
 * Props for {@link PlanaDimensions}.
 */
export type PlanaDimensionsProps = {
    /** Current world tree. */
    world: World
    /** Current selection snapshot. */
    selection: Selection
    /**
     * Overlay mode: `off` | `selection` | `all`.
     * Legacy `visible` boolean is accepted via callers that map it.
     */
    mode: DimensionsMode
}

/**
 * Figma-like size labels (mm) as HTML overlays.
 *
 * - `selection` — selected solids only (hint when nothing selected)
 * - `all` — every visible independent solid
 *
 * @param props - World, selection, and mode.
 * @returns Dimension overlays, or `null` when off / empty.
 */
export function PlanaDimensions(props: PlanaDimensionsProps) {
    const { world, selection, mode } = props

    const solids = React.useMemo(() => {
        if (mode === 'off') return [] as WorldSolid[]
        const all = buildWorldSolids(world).filter((s) => resolveStyle(s.object).visible !== false)
        if (mode === 'all') return all
        if (selection.ids.length === 0) return [] as WorldSolid[]
        const selected = new Set(selection.ids)
        return all.filter((s) => s.object.id && selected.has(s.object.id))
    }, [world, selection.ids, mode])

    const selectedSet = React.useMemo(() => new Set(selection.ids), [selection.ids])

    if (mode === 'off') return null

    if (mode === 'selection' && solids.length === 0) {
        return (
            <Html
                position={[0, 0.5, 0]}
                center
                sprite
                zIndexRange={[100, 0]}
                style={{ pointerEvents: 'none' }}
            >
                <div className='plana-dim plana-dim--hint'>Select an object</div>
            </Html>
        )
    }

    if (solids.length === 0) return null

    return (
        <group>
            {solids.map((solid, index) => (
                <DimLabel
                    key={solid.object.id ?? `dim-${index}`}
                    solid={solid}
                    emphasis={!!solid.object.id && selectedSet.has(solid.object.id)}
                />
            ))}
        </group>
    )
}
