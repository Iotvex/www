# Spatial Engine — Architecture

Universal, domain-agnostic spatial editing runtime for IoTVex www.
The host app owns business meaning; the engine only owns space, geometry, interaction and persistence hooks.

## Design principles

- **Composition over inheritance** — subsystems are services wired by the kernel.
- **Renderer is a port** — Three.js is an adapter; scene data is renderer-agnostic.
- **Opaque metadata** — every node may carry `Record<string, unknown>` the engine never interprets.
- **CAD feel** — precision tools, snapping, orthographic views, measurements; not game loops as product UX.
- **Incremental** — each subsystem is independently testable and replaceable.

## Major subsystems

| Subsystem | Responsibility | Why it exists |
|-----------|----------------|---------------|
| **Kernel** | Lifecycle, tick, dispose, service registry | Single entry; prevents god-objects |
| **Event Bus** | Typed pub/sub across subsystems | Loose coupling for plugins/host |
| **Scene Graph** | Hierarchy, transforms, layers, groups | Shared spatial truth independent of GPU |
| **Geometry** | Editable mesh buffers, primitives | Procedural + manual modeling without Three types leaking |
| **Assets** | Reusable prototypes / instancing hooks | CAD libraries of parts |
| **Spatial Index** | AABB / BVH queries | Fast pick & culling in large scenes |
| **Render Adapter** | Sync graph → WebGL | Isolates Three.js |
| **Camera** | Orbit / fly / walk, ortho/persp, bookmarks | Professional navigation |
| **Interaction** | Pointer, raycast, selection | Editor input pipeline |
| **Editing Tools** | Transform, snap, guides, measure | CAD editing surface |
| **History** | Command stack undo/redo | Non-destructive editing |
| **Serialize** | Versioned document codec + importer ports | Save/load/export architecture |
| **Plugins** | Register tools, importers, gizmos | Long-term extensibility |
| **Animation** | Clips / timeline hooks | Future motion without rewriting core |
| **Host API** | Mount, events, metadata bridges | Integration contract for www |

## Data flow

```
Host (React) ──SpatialEngine.create()──► Kernel
                                              │
         metadata / commands / queries ◄──────┤
                                              ▼
                                    Scene Graph ◄── Geometry / Assets / Layers
                                              │
                         Spatial Index ◄──────┤
                                              ▼
                                    Render Adapter (Three)
                                              ▲
                         Camera / Tools / Interaction
                                              │
                                    History / Serialize / Plugins
```

## Integration (www)

- Code: `features/spatial-engine/`
- Host page: `widgets/spatial` + nav view `spatial`
- Public surface: `@/features/spatial-engine` (`createSpatialEngine`, `SpatialViewport`, types)

The engine **does not** talk to devices, Supabase, or automations.
