# plana

[![CI Status](https://img.shields.io/github/actions/workflow/status/xlebpushek/plana/release.yml?label=CI)](https://github.com/xlebpushek/plana/actions)
[![Version](https://img.shields.io/npm/v/plana)](https://www.npmjs.com/package/plana)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Apartment plan engine (`engine`) and React integration (`react`) for interactive floor-plan editors.

```ts
import { /* … */ } from 'plana'
```

## Layout

- `engine/` — calculations, document model, geometry, commands, JSON I/O (no React)
- `react/` — provider, hooks, R3F scene, GUI chrome
- `examples/` — usage samples
- `index.ts` — single public entry

## Library build / typecheck

```bash
npm install
npm run build
npx tsc --noEmit
```

## JSON document format

```json
{
    "format": "plana",
    "version": 1,
    "meta": { "title": "Studio", "modifiedAt": "2026-07-28T00:00:00.000Z" },
    "world": {
        "kind": "world",
        "id": "world",
        "x": 0,
        "y": 0,
        "z": 0,
        "width": 0,
        "height": 0,
        "depth": 0,
        "children": []
    },
    "selection": []
}
```

Use `exportDocumentJson` / `importDocumentJson` from the engine.

## Node style

Optional `style` on any node:

| Field                           | Meaning                          |
| ------------------------------- | -------------------------------- |
| `color`                         | Fill / material hex              |
| `accentColor`                   | Emissive / accent                |
| `opacity`                       | 0–1                              |
| `metalness` / `roughness`       | PBR hints                        |
| `visible` / `selectable`        | Editor flags                     |
| `outlineColor` / `outlineWidth` | Outline (width in meters for 3D) |
| `extras`                        | Free-form metadata               |

## Scripts

```bash
npm install
npm run build
npm run format:check
npm run example:tiny
```

## License

Licensed under the [MIT](LICENSE) license.
