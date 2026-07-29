/**
 * Shared CSS for the Plana editor chrome.
 *
 * shadcn/ui dark (zinc) look — system font stack, card panels, muted borders.
 */

/** Inline stylesheet for the editor shell. */
export const editorStyles = /* css */ `
.plana-editor {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --card: 240 10% 3.9%;
  --card-foreground: 0 0% 98%;
  --popover: 240 10% 3.9%;
  --popover-foreground: 0 0% 98%;
  --primary: 0 0% 98%;
  --primary-foreground: 240 5.9% 10%;
  --secondary: 240 3.7% 15.9%;
  --secondary-foreground: 0 0% 98%;
  --muted: 240 3.7% 15.9%;
  --muted-foreground: 240 5% 64.9%;
  --accent: 240 3.7% 15.9%;
  --accent-foreground: 0 0% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 0 0% 98%;
  --border: 240 3.7% 15.9%;
  --input: 240 3.7% 15.9%;
  --ring: 240 4.9% 83.9%;
  --radius: 0.5rem;

  --pe-bg: hsl(var(--background));
  --pe-panel: hsl(var(--card));
  --pe-panel-2: hsl(var(--secondary));
  --pe-ink: hsl(var(--background));
  --pe-border: hsl(var(--border));
  --pe-border-strong: hsl(240 3.7% 22%);
  --pe-text: hsl(var(--foreground));
  --pe-muted: hsl(var(--muted-foreground));
  --pe-accent: hsl(var(--primary));
  --pe-accent-2: hsl(var(--muted-foreground));
  --pe-accent-soft: hsl(var(--secondary));
  --pe-danger: hsl(0 72% 51%);
  --pe-input: hsl(var(--input));
  --pe-radius: var(--radius);
  --pe-font: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --pe-display: var(--pe-font);
  --pe-sidebar-rail: 28px;

  box-sizing: border-box;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--pe-bg);
  color: var(--pe-text);
  font-family: var(--pe-font);
  font-size: 13px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

.plana-editor *,
.plana-editor *::before,
.plana-editor *::after {
  box-sizing: border-box;
}

/* Hide scrollbars on panel bodies only; scrolling still works */
.plana-panel__body {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.plana-panel__body::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.plana-editor__body {
  display: flex;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.plana-editor__viewport {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: #09090b;
  border-left: 1px solid var(--pe-border);
  border-right: 1px solid var(--pe-border);
}

.plana-editor__viewport > div {
  width: 100% !important;
  height: 100% !important;
}

.plana-editor__viewport canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

.plana-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 48px;
  padding: 0 8px;
  background: hsl(var(--background) / 0.95);
  border-bottom: 1px solid var(--pe-border);
  backdrop-filter: blur(8px);
}

.plana-toolbar__brand {
  display: grid;
  place-items: center;
  padding: 0 14px;
  margin-right: 4px;
  font-family: var(--pe-display);
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--pe-text);
  border-right: 1px solid var(--pe-border);
  user-select: none;
}

.plana-toolbar__group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 4px;
}

.plana-toolbar__label {
  color: var(--pe-muted);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0 4px;
  user-select: none;
}

.plana-segmented {
  display: inline-flex;
  align-items: stretch;
  border: 1px solid var(--pe-border);
  border-radius: calc(var(--pe-radius) - 1px);
  overflow: hidden;
  background: hsl(var(--secondary));
}

.plana-segmented__btn {
  appearance: none;
  border: 0;
  margin: 0;
  padding: 4px 10px;
  background: transparent;
  color: var(--pe-muted);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.plana-segmented__btn + .plana-segmented__btn {
  border-left: 1px solid var(--pe-border);
}

.plana-segmented__btn:hover {
  color: var(--pe-text);
  background: hsl(var(--accent));
}

.plana-segmented__btn--active {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.plana-segmented__btn--active:hover {
  background: hsl(0 0% 90%);
  color: hsl(var(--primary-foreground));
}

.plana-toolbar__sep {
  width: 1px;
  align-self: stretch;
  min-height: 24px;
  margin: 8px 4px;
  background: var(--pe-border);
}

.plana-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--pe-border);
  border-radius: calc(var(--pe-radius) - 2px);
  background: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease, opacity 120ms ease;
}

.plana-btn:hover:not(:disabled) {
  background: hsl(240 3.7% 20%);
  color: var(--pe-text);
}

.plana-btn:active:not(:disabled) {
  background: hsl(240 3.7% 18%);
}

.plana-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.plana-btn--accent {
  background: hsl(var(--primary));
  border-color: transparent;
  color: hsl(var(--primary-foreground));
}

.plana-btn--accent:hover:not(:disabled) {
  background: hsl(0 0% 90%);
  color: hsl(var(--primary-foreground));
}

.plana-btn--danger:hover:not(:disabled) {
  background: hsl(0 62.8% 30.6% / 0.25);
  border-color: hsl(0 62.8% 30.6% / 0.5);
  color: hsl(0 86% 70%);
}

.plana-btn--active {
  background: hsl(var(--primary));
  border-color: transparent;
  color: hsl(var(--primary-foreground));
}

.plana-btn--active:hover:not(:disabled) {
  background: hsl(0 0% 90%);
  color: hsl(var(--primary-foreground));
}

.plana-btn--icon {
  width: 28px;
  height: 28px;
  padding: 0;
  flex-shrink: 0;
}

.plana-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  width: var(--pe-panel-width, 260px);
  min-width: var(--pe-sidebar-rail);
  min-height: 0;
  height: 100%;
  background: var(--pe-panel);
  border: 0;
  /* No mount fade — restarting pe-fade-in was flashing both sidebars to opacity 0. */
  contain: layout paint;
}

.plana-panel--collapsed {
  width: var(--pe-sidebar-rail);
  min-width: var(--pe-sidebar-rail);
  max-width: var(--pe-sidebar-rail);
  flex: 0 0 var(--pe-sidebar-rail);
}

.plana-panel__header {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  min-height: 40px;
  padding: 4px 6px 4px 10px;
  border-bottom: 1px solid var(--pe-border);
}

.plana-panel__header[hidden] {
  display: none !important;
}

.plana-panel__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--pe-display);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--pe-muted);
}

.plana-panel__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 8px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.plana-panel__body--parked,
.plana-panel__body[hidden] {
  display: none !important;
}

.plana-panel__rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  height: 100%;
  padding: 8px 0;
}

/* Author display:flex beats the UA [hidden] rule — force hide. */
.plana-panel__rail[hidden] {
  display: none !important;
}

.plana-panel__rail-label {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pe-muted);
  user-select: none;
}

.plana-panel__resize {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 4px;
  z-index: 2;
  cursor: col-resize;
  touch-action: none;
  background: transparent;
}

.plana-panel__resize:hover,
.plana-panel__resize:active {
  background: hsl(var(--ring) / 0.35);
}

.plana-panel__resize--left {
  right: -2px;
}

.plana-panel__resize--right {
  left: -2px;
}

.plana-tree {
  list-style: none;
  margin: 0;
  padding: 0;
}

.plana-tree ul {
  list-style: none;
  margin: 0;
  padding-left: 12px;
  border-left: 1px solid var(--pe-border);
}

.plana-tree__row {
  display: flex;
  align-items: center;
  gap: 2px;
  width: 100%;
}

.plana-tree__chevron {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  padding: 0;
  border: 0;
  border-radius: calc(var(--pe-radius) - 4px);
  background: transparent;
  color: var(--pe-muted);
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, transform 120ms ease;
}

.plana-tree__chevron:hover {
  background: hsl(var(--accent));
  color: var(--pe-text);
}

.plana-tree__chevron--open {
  transform: rotate(90deg);
}

.plana-tree__chevron--leaf {
  visibility: hidden;
  pointer-events: none;
}

.plana-tree__item {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  text-align: left;
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  font: inherit;
  padding: 6px 8px;
  border-radius: calc(var(--pe-radius) - 2px);
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}

.plana-tree__item:hover {
  background: hsl(var(--accent));
}

.plana-tree__item--selected {
  background: hsl(240 5% 32%);
  border-color: hsl(var(--ring) / 0.7);
  box-shadow: inset 3px 0 0 hsl(0 0% 98%);
  color: var(--pe-text);
}

.plana-tree__item--selected .plana-tree__kind {
  color: hsl(var(--foreground) / 0.72);
}

.plana-tree__kind {
  color: var(--pe-muted);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  min-width: 58px;
}

.plana-tree__name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plana-field {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
}

.plana-field label {
  color: var(--pe-muted);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.plana-field input[type='text'],
.plana-field input[type='number'],
.plana-field input[type='color'] {
  width: 100%;
  height: 32px;
  background: hsl(var(--background));
  border: 1px solid var(--pe-border);
  border-radius: calc(var(--pe-radius) - 2px);
  color: var(--pe-text);
  padding: 6px 10px;
  font: inherit;
  font-size: 0.8125rem;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}

.plana-field input[type='color'] {
  padding: 2px;
  cursor: pointer;
}

.plana-field input:focus {
  outline: none;
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.25);
}

.plana-field--row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.plana-field--check {
  display: flex;
  align-items: center;
  gap: 8px;
}

.plana-field--check input {
  accent-color: hsl(var(--foreground));
}

.plana-section {
  margin-top: 2px;
  margin-bottom: 8px;
  border: 1px solid transparent;
  border-radius: calc(var(--pe-radius) - 2px);
}

.plana-section__header {
  appearance: none;
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  margin: 0;
  padding: 8px 6px;
  border: 0;
  border-radius: calc(var(--pe-radius) - 2px);
  background: transparent;
  color: var(--pe-text);
  font: inherit;
  cursor: pointer;
  transition: background 120ms ease;
}

.plana-section__header:hover {
  background: hsl(var(--accent));
}

.plana-section__chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--pe-muted);
  transition: transform 120ms ease;
}

.plana-section__chevron--open {
  transform: rotate(90deg);
}

.plana-section__title {
  flex: 1;
  text-align: left;
  font-family: var(--pe-display);
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--pe-text);
  margin: 0;
}

.plana-section__body {
  padding: 2px 6px 8px;
}

.plana-empty {
  color: var(--pe-muted);
  padding: 18px 10px;
  text-align: left;
}

.plana-dim {
  pointer-events: none;
  white-space: nowrap;
  padding: 5px 9px;
  border-radius: calc(var(--pe-radius) - 2px);
  border: 1px solid hsl(var(--border));
  background: hsl(var(--background) / 0.94);
  color: hsl(var(--foreground));
  font-family: var(--pe-font);
  font-size: 12px;
  font-weight: 560;
  letter-spacing: 0.02em;
  line-height: 1.25;
  box-shadow: 0 1px 3px hsl(0 0% 0% / 0.45);
  backdrop-filter: blur(6px);
}

.plana-dim--emphasis {
  border-color: hsl(var(--ring));
  background: hsl(0 0% 98% / 0.95);
  color: hsl(240 10% 3.9%);
  font-size: 13px;
  font-weight: 600;
}

.plana-dim--hint {
  opacity: 0.85;
  font-weight: 500;
  color: var(--pe-muted);
  border-style: dashed;
}

@media (max-width: 960px) {
  .plana-editor {
    min-height: 0;
    height: 100%;
  }

  .plana-editor__body {
    flex-direction: column;
    min-height: 0;
    flex: 1 1 auto;
  }

  .plana-panel {
    width: 100% !important;
    height: auto;
    max-height: min(28dvh, 220px);
    order: 2;
  }

  .plana-panel--truncated {
    width: 100% !important;
    max-height: 44px;
  }

  .plana-panel__resize {
    display: none;
  }

  .plana-editor__viewport {
    flex: 1 1 auto;
    order: 1;
    min-height: min(48dvh, 420px);
    border-left: 0;
    border-right: 0;
    border-top: 0;
    border-bottom: 1px solid var(--pe-border);
  }

  .plana-toolbar {
    flex-wrap: wrap;
    gap: 0.35rem;
    padding: 0.4rem 0.5rem;
  }

  .plana-toolbar .plana-btn {
    min-height: 36px;
  }
}

@media (max-width: 640px) {
  .plana-editor__viewport {
    min-height: min(52dvh, 480px);
  }

  .plana-panel {
    max-height: min(24dvh, 180px);
  }

  .plana-panel__header,
  .plana-section__header {
    padding-inline: 0.65rem;
  }
}
`
