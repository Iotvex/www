import * as React from 'react'
import { Canvas } from '@react-three/fiber'
import type { CanvasProps } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { findNodeById, resolveStyle } from '../../engine'
import { usePlanaDispatch, usePlanaSelection, usePlanaWorld } from '../hooks'
import { PlanaDimensions, type DimensionsMode } from './PlanaDimensions'
import { PlanaWorldMesh } from './PlanaWorldMesh'

/**
 * Props for {@link PlanaCanvas}.
 */
export type PlanaCanvasProps = {
    /** Optional class name on the canvas container. */
    className?: string
    /** Show a ground grid. Defaults to `true`. */
    showGrid?: boolean
    /**
     * Orbit target in world meters. Defaults to a point above the flat center.
     */
    target?: [number, number, number]
    /** Dimension overlay mode. Defaults to `'off'`. */
    dimensionsMode?: DimensionsMode
    /** When true, draw sparse plan hatch. Defaults to `false`. */
    showHatch?: boolean
    /** Extra Canvas props (camera, etc.). */
    canvasProps?: Omit<CanvasProps, 'children' | 'className'>
    /** Additional scene children rendered after world meshes. */
    children?: React.ReactNode
}

const SCENE_BG = '#09090b'
const CAM_X = 3.21
const CAM_Z = 2.9675

/**
 * React Three Fiber canvas with lights, orbit controls, grid, and Plana solids.
 *
 * Document state is read **outside** the Canvas and passed in as props so hosts
 * like Next.js do not lose React context across the R3F boundary.
 *
 * @param props - Canvas presentation options.
 * @returns A full-size R3F canvas element.
 *
 * @example
 * ```tsx
 * <PlanaProvider world={createFlatWorld()}>
 *   <PlanaCanvas />
 * </PlanaProvider>
 * ```
 */
export function PlanaCanvas(props: PlanaCanvasProps) {
    const {
        className,
        showGrid = true,
        target = [CAM_X, 0.2, CAM_Z],
        dimensionsMode = 'off',
        showHatch = false,
        canvasProps,
        children,
    } = props
    const world = usePlanaWorld()
    const selection = usePlanaSelection()
    const dispatch = usePlanaDispatch()

    const onSelect = React.useCallback(
        (id: string | undefined, additive: boolean) => {
            if (!id) {
                dispatch({ type: 'setSelection', ids: [] })
                return
            }
            const node = findNodeById(world, id)
            if (!node) return
            if (!resolveStyle(node).selectable) return

            if (additive) {
                const has = selection.ids.includes(id)
                const next = has ? selection.ids.filter((x) => x !== id) : [...selection.ids, id]
                dispatch({ type: 'setSelection', ids: next })
            } else {
                dispatch({ type: 'setSelection', ids: [id] })
            }
        },
        [dispatch, selection.ids, world]
    )

    return (
        <Canvas
            className={className}
            shadows={false}
            dpr={1}
            gl={{
                antialias: true,
                alpha: false,
                powerPreference: 'high-performance',
            }}
            camera={{ position: [CAM_X, 10, CAM_Z], fov: 40, near: 0.1, far: 100 }}
            onCreated={({ gl, scene }) => {
                gl.setClearColor(new THREE.Color(SCENE_BG), 1)
                scene.background = new THREE.Color(SCENE_BG)
            }}
            onPointerMissed={() => dispatch({ type: 'setSelection', ids: [] })}
            style={{ width: '100%', height: '100%', display: 'block', background: SCENE_BG }}
            {...canvasProps}
        >
            <color attach='background' args={[SCENE_BG]} />
            <fog attach='fog' args={[SCENE_BG, 36, 70]} />
            <ambientLight intensity={0.7} />
            <directionalLight intensity={0.45} position={[6, 20, 4]} />
            {showGrid ? (
                <gridHelper args={[10, 10, '#1f2937', '#111827']} position={[CAM_X, 0.001, CAM_Z]} />
            ) : null}
            <PlanaWorldMesh
                world={world}
                selection={selection}
                onSelect={onSelect}
                showHatch={showHatch}
            />
            <PlanaDimensions world={world} selection={selection} mode={dimensionsMode} />
            {children}
            <OrbitControls
                makeDefault
                target={target}
                maxPolarAngle={Math.PI / 2.05}
                minDistance={2}
                maxDistance={24}
            />
        </Canvas>
    )
}
