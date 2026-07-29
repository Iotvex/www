/**
 * Visual and interaction style attached to scene nodes.
 *
 * @packageDocumentation
 */

/**
 * Optional appearance and interaction hints for a node.
 *
 * Viewers and editors may interpret these as PBR material parameters,
 * plan-view outline styling, or selection/visibility flags.
 */
export type NodeStyle = {
    /** CSS/hex color for fill/material, e.g. `#c4a574`. */
    color?: string
    /** Optional emissive / accent color. */
    accentColor?: string
    /** Opacity 0–1. */
    opacity?: number
    /** Metalness 0–1 (PBR hint for viewers). */
    metalness?: number
    /** Roughness 0–1. */
    roughness?: number
    /** Whether the node is visible in the editor/viewer. */
    visible?: boolean
    /** Whether the node can be selected. */
    selectable?: boolean
    /** Optional CSS-like border/outline color for plan view. */
    outlineColor?: string
    /**
     * Outline width in meters for 3D viewers
     * (2D overlays may interpret the same value in pixels).
     */
    outlineWidth?: number
    /** Free-form app metadata. */
    extras?: Record<string, unknown>
}
