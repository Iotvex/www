import * as React from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import {
    buildWorldSolids,
    resolveStyle,
    type Selection,
    type World,
    type WorldSolid,
} from '../../engine'
import { buildWorldHatchGeometry, HATCH_EDGE_OPACITY, HATCH_STEP } from './hatch-utils'
import { meshToBufferGeometry } from './mesh-utils'

type TagVisual = {
    fill: string
    opacity: number
    edge: string
}

const TAG_VISUAL: Record<string, TagVisual> = {
    floor: { fill: '#020617', opacity: 0.45, edge: '#64748b' },
    wall: { fill: '#09090b', opacity: 0.25, edge: '#e2e8f0' },
    door: { fill: '#1c1917', opacity: 0.3, edge: '#f59e0b' },
    window: { fill: '#083344', opacity: 0.28, edge: '#22d3ee' },
    mirror: { fill: '#083344', opacity: 0.32, edge: '#22d3ee' },
    furniture: { fill: '#1c1917', opacity: 0.35, edge: '#d6d3d1' },
}

/** Floors draw first and sit slightly below wall bottoms to avoid coplanar z-fight. */
const RENDER_FLOOR = 0
const RENDER_FILL = 1
const RENDER_EDGE = 2
const RENDER_HATCH = 3
/** Nudge floor slabs down so their top face is not coplanar with wall bottoms. */
const FLOOR_Y_BIAS = -0.001
/** Only draw silhouette edges (skip near-coplanar triangulation seams). */
const EDGE_THRESHOLD_DEG = 30

const brightenHex = (hex: string, amount = 0.35): string => {
    try {
        const c = new THREE.Color(hex)
        c.offsetHSL(0, 0, amount)
        return `#${c.getHexString()}`
    } catch {
        return hex
    }
}

const edgeColorFor = (solid: WorldSolid): string => {
    const node = solid.object
    const style = resolveStyle(node)
    const tagVisual = TAG_VISUAL[node.tag ?? '']
    return node.style?.outlineColor ?? tagVisual?.edge ?? style.outlineColor
}

type SolidMeshProps = {
    solid: WorldSolid
    selected: boolean
    onSelect: (id: string | undefined, additive: boolean) => void
}

/** Per-solid fill + edges only — hatch is a single world-level pass. */
const SolidMesh = React.memo(function SolidMesh(props: SolidMeshProps) {
    const { solid, selected, onSelect } = props
    const node = solid.object
    const style = resolveStyle(node)
    const tag = node.tag ?? ''
    const tagVisual = TAG_VISUAL[tag]
    const geometry = React.useMemo(() => meshToBufferGeometry(solid.worldSolid), [solid.worldSolid])
    const edges = React.useMemo(
        () => new THREE.EdgesGeometry(geometry, EDGE_THRESHOLD_DEG),
        [geometry]
    )

    React.useEffect(() => {
        return () => {
            geometry.dispose()
            edges.dispose()
        }
    }, [geometry, edges])

    if (!style.visible) return null

    const position = geometry.getAttribute('position')
    if (!position || position.count === 0) return null

    const color = node.style?.color ?? tagVisual?.fill ?? style.color
    const baseOpacity = node.style?.opacity ?? tagVisual?.opacity ?? style.opacity
    const edgeColor = edgeColorFor(solid)
    const opacity = selected ? Math.min(1, baseOpacity + 0.12) : baseOpacity
    const outline = selected ? brightenHex(edgeColor, 0.28) : edgeColor
    const doubleSide = tag === 'wall'
    const isFloor = tag === 'floor'
    const fillOrder = isFloor ? RENDER_FLOOR : RENDER_FILL

    const handleClick = (event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        if (!style.selectable) return
        onSelect(node.id, event.nativeEvent.shiftKey)
    }

    return (
        <group position={isFloor ? [0, FLOOR_Y_BIAS, 0] : undefined}>
            <mesh
                geometry={geometry}
                onClick={handleClick}
                userData={{ nodeId: node.id }}
                renderOrder={fillOrder}
            >
                <meshBasicMaterial
                    color={color}
                    opacity={opacity}
                    transparent
                    depthWrite={false}
                    depthTest
                    polygonOffset={isFloor}
                    polygonOffsetFactor={isFloor ? 1 : 0}
                    polygonOffsetUnits={isFloor ? 1 : 0}
                    side={doubleSide ? THREE.DoubleSide : THREE.FrontSide}
                />
            </mesh>
            <lineSegments geometry={edges} renderOrder={RENDER_EDGE} frustumCulled={false}>
                <lineBasicMaterial
                    color={outline}
                    depthTest
                    polygonOffset={isFloor}
                    polygonOffsetFactor={isFloor ? 1 : 0}
                />
            </lineSegments>
        </group>
    )
})

function WorldHatch(props: { solids: WorldSolid[] }) {
    const { solids } = props

    const hatch = React.useMemo(() => {
        const items = solids
            .filter((s) => resolveStyle(s.object).visible !== false)
            .map((s) => {
                const node = s.object
                return {
                    bounds: {
                        width: node.width,
                        height: node.height,
                        depth: node.depth,
                    },
                    worldMatrix: s.worldMatrix,
                    tag: node.tag,
                    cutouts: node.cutouts,
                    edgeColor: edgeColorFor(s),
                }
            })
        // Top/plan faces only — elevation hatch dominated LineSegments cost.
        return buildWorldHatchGeometry(items, { step: HATCH_STEP, elevations: false })
    }, [solids])

    React.useEffect(() => () => hatch.dispose(), [hatch])

    const count = hatch.getAttribute('position')?.count ?? 0
    if (count === 0) return null

    return (
        <lineSegments geometry={hatch} renderOrder={RENDER_HATCH} frustumCulled={false} raycast={() => null}>
            <lineBasicMaterial
                vertexColors
                transparent
                opacity={HATCH_EDGE_OPACITY}
                depthWrite={false}
            />
        </lineSegments>
    )
}

/**
 * Props for {@link PlanaWorldMesh}.
 *
 * Pass world/selection from outside {@link Canvas} — React context does not
 * reliably cross the R3F reconciler boundary in all hosts (e.g. Next.js).
 */
export type PlanaWorldMeshProps = {
    /** Current world tree. */
    world: World
    /** Current selection snapshot. */
    selection: Selection
    /** Selection handler (node id, shift-additive). */
    onSelect: (id: string | undefined, additive: boolean) => void
    /** When true, draw sparse plan hatch. Defaults to `false`. */
    showHatch?: boolean
}

/**
 * Renders world solids as draft meshes (fill + edges) plus optional world hatch.
 *
 * @param props - World, selection, and click handler from the host (outside Canvas).
 * @returns A group of meshes for the active world.
 */
export function PlanaWorldMesh(props: PlanaWorldMeshProps) {
    const { world, selection, onSelect, showHatch = false } = props

    const solids = React.useMemo(() => buildWorldSolids(world), [world])
    const selectedSet = React.useMemo(() => new Set(selection.ids), [selection.ids])

    return (
        <group>
            {solids.map((solid, index) => {
                const sid = solid.object.id ?? `solid-${index}`
                return (
                    <SolidMesh
                        key={sid}
                        solid={solid}
                        selected={solid.object.id ? selectedSet.has(solid.object.id) : false}
                        onSelect={onSelect}
                    />
                )
            })}
            {showHatch ? <WorldHatch solids={solids} /> : null}
        </group>
    )
}

/**
 * @deprecated Prefer explicit {@link PlanaWorldMeshProps}; kept for typing helpers.
 */
export type { WorldSolid }
