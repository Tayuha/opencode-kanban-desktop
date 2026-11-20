/** Injected once while the plugin is active. Everything is scoped under `.kb`. */
export const styles = `
.kb {
  --kb-success: #157f3b;
  --kb-warning: #a35b00;
  --kb-danger: #b3261e;
  --kb-info: #1a5fb4;
  --kb-muted: color-mix(in oklab, currentColor 62%, transparent);
  --kb-border: color-mix(in oklab, currentColor 16%, transparent);
  --kb-border-strong: color-mix(in oklab, currentColor 30%, transparent);
  --kb-track: color-mix(in oklab, currentColor 9%, transparent);
  --kb-surface: color-mix(in oklab, currentColor 4%, transparent);
  --kb-surface-strong: color-mix(in oklab, currentColor 8%, transparent);
  --kb-accent: #5b8def;
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 0;
  padding: 10px 12px 12px;
  font-size: 12px;
  line-height: 1.45;
  box-sizing: border-box;
  color: inherit;
}
.kb[data-mode="dark"] {
  --kb-success: #4ade80;
  --kb-warning: #fbbf24;
  --kb-danger: #f87171;
  --kb-info: #60a5fa;
}
.kb-dialog { height: 560px; padding: 0; gap: 6px; }
.kb-dialog-form { height: auto; padding: 0; gap: 8px; }
.kb-dialog-form * { box-sizing: border-box; }
.kb-in-dialog { height: 480px; padding: 0; gap: 6px; }
.kb * { box-sizing: border-box; }
.kb button { font: inherit; color: inherit; }

.kb-tone-success { color: var(--kb-success); }
.kb-tone-warning { color: var(--kb-warning); }
.kb-tone-danger  { color: var(--kb-danger); }
.kb-tone-info    { color: var(--kb-info); }
.kb-tone-muted   { color: var(--kb-muted); }

.kb-head { display: flex; flex-direction: column; gap: 6px; flex: none; }
.kb-title-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.kb-title { font-weight: 600; flex: none; }
.kb-subtitle {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--kb-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kb-actions { display: flex; align-items: center; gap: 2px; flex: none; }

.kb-chip {
  flex: none;
  border: 1px solid var(--kb-border);
  border-radius: 999px;
  padding: 0 7px;
  font-size: 11px;
  color: var(--kb-muted);
  white-space: nowrap;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.kb-chip[data-tone="success"] { color: var(--kb-success); border-color: color-mix(in oklab, var(--kb-success) 45%, transparent); }
.kb-chip[data-tone="warning"] { color: var(--kb-warning); border-color: color-mix(in oklab, var(--kb-warning) 45%, transparent); }
.kb-chip[data-tone="danger"]  { color: var(--kb-danger);  border-color: color-mix(in oklab, var(--kb-danger) 45%, transparent); }

.kb-switch { display: flex; flex-wrap: wrap; gap: 4px; }
.kb-switch button {
  all: unset;
  cursor: pointer;
  border: 1px solid var(--kb-border);
  border-radius: 6px;
  padding: 1px 8px;
  font-size: 11px;
  color: var(--kb-muted);
  background: transparent;
}
.kb-switch button:hover { color: inherit; background: var(--kb-surface); }
.kb-switch button[data-active="true"] {
  color: inherit;
  border-color: var(--kb-border-strong);
  background: var(--kb-surface-strong);
  font-weight: 600;
}
.kb-switch button:focus-visible { outline: 2px solid var(--kb-info); outline-offset: 1px; }

.kb-project-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.kb-project-row > :first-child { flex: 1 1 auto; min-width: 0; }
.kb-project-label { flex: none; color: var(--kb-muted); }

.kb-search { display: flex; align-items: center; gap: 6px; }
.kb-search input {
  flex: 1 1 auto;
  min-width: 0;
  height: 26px;
  border: 1px solid var(--kb-border);
  border-radius: 6px;
  background: var(--kb-surface);
  color: inherit;
  padding: 0 8px;
  font: inherit;
  font-size: 12px;
  outline: none;
}
.kb-search input:focus { border-color: var(--kb-info); }
.kb-search input::placeholder { color: var(--kb-muted); }
.kb-search-clear {
  all: unset;
  cursor: pointer;
  color: var(--kb-muted);
  border-radius: 4px;
  padding: 0 4px;
}
.kb-search-clear:hover { color: inherit; }

.kb-divider { border: 0; border-top: 1px solid var(--kb-border); margin: 0; flex: none; }

.kb-tag {
  --kb-tag: #5b8def;
  display: inline-flex;
  align-items: center;
  max-width: 150px;
  padding: 0 7px;
  border: 1px solid color-mix(in oklab, var(--kb-tag) 45%, transparent);
  border-radius: 999px;
  background: color-mix(in oklab, var(--kb-tag) 12%, transparent);
  color: color-mix(in oklab, var(--kb-tag) 82%, currentColor);
  font: inherit;
  font-size: 10px;
  line-height: 1.7;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
button.kb-tag { cursor: pointer; }
button.kb-tag:hover { background: color-mix(in oklab, var(--kb-tag) 20%, transparent); }
.kb-tag[data-active="true"] {
  background: color-mix(in oklab, var(--kb-tag) 28%, transparent);
  border-color: var(--kb-tag);
  font-weight: 600;
}
.kb-tag-more {
  border-color: var(--kb-border);
  background: var(--kb-surface);
  color: var(--kb-muted);
}
.kb-tags-filter { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.kb-card-tags { display: flex; flex-wrap: wrap; gap: 3px; min-width: 0; }
.kb-tag-picker { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }

.kb-body { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.kb-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; padding-right: 2px; }
.kb-scroll::-webkit-scrollbar { width: 8px; }
.kb-scroll::-webkit-scrollbar-thumb { background: var(--kb-track); border-radius: 999px; }

.kb-notice {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--kb-warning);
  font-size: 11px;
  padding: 2px 0;
}
.kb-notice[data-danger="true"] { color: var(--kb-danger); }

/* Board */
.kb-board {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  gap: 8px;
  align-items: stretch;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 6px;
}
.kb-board[data-align="fit"] .kb-col { flex: 1 1 0; min-width: 0; }
.kb-board[data-align="scroll"] .kb-col { flex: 0 0 var(--kb-col-width, 280px); }
.kb-board::-webkit-scrollbar { height: 8px; }
.kb-board::-webkit-scrollbar-thumb { background: var(--kb-track); border-radius: 999px; }

.kb-col {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--kb-border);
  border-radius: 8px;
  background: var(--kb-surface);
  overflow: hidden;
}
.kb-col[data-over="true"] {
  border-color: color-mix(in oklab, var(--kb-accent) 65%, transparent);
  background: color-mix(in oklab, var(--kb-accent) 7%, var(--kb-surface));
}
.kb-col-head {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 6px 5px 8px;
  border-bottom: 1px solid var(--kb-border);
  flex: none;
  min-width: 0;
}
.kb-col-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--kb-accent); flex: none; }
.kb-col-title {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kb-col-count { color: var(--kb-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.kb-col-add {
  all: unset;
  cursor: pointer;
  color: var(--kb-muted);
  width: 20px;
  height: 20px;
  border-radius: 4px;
  display: grid;
  place-items: center;
  font-size: 15px;
  line-height: 1;
}
.kb-col-add:hover { color: inherit; background: var(--kb-surface-strong); }
.kb-col-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  overflow-y: auto;
  min-height: 56px;
  flex: 1 1 auto;
}
.kb-col-body::-webkit-scrollbar { width: 6px; }
.kb-col-body::-webkit-scrollbar-thumb { background: var(--kb-track); border-radius: 999px; }

.kb-card {
  --kb-accent: #5b8def;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 7px 8px;
  border: 1px solid var(--kb-border);
  border-left: 3px solid var(--kb-accent);
  border-radius: 6px;
  background: color-mix(in oklab, currentColor 2.5%, transparent);
  cursor: grab;
  min-width: 0;
}
.kb-card:hover { border-color: var(--kb-border-strong); background: var(--kb-surface-strong); }
.kb-card[data-selected="true"] {
  border-color: color-mix(in oklab, var(--kb-accent) 70%, var(--kb-border));
  background: color-mix(in oklab, var(--kb-accent) 8%, transparent);
}
.kb-card[data-dragging="true"] { opacity: 0.45; }
.kb-card:focus-visible { outline: 2px solid var(--kb-info); outline-offset: 1px; }
.kb-card-head { display: flex; align-items: flex-start; gap: 4px; min-width: 0; }
.kb-card-title {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 600;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.kb-card-menu { flex: none; margin: -3px -4px 0 0; }
.kb-card-line { display: flex; align-items: center; gap: 4px; min-width: 0; color: var(--kb-muted); font-size: 11px; }
.kb-card-line > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kb-card-branch { font-family: var(--kb-mono, ui-monospace, monospace); font-size: 10.5px; }
.kb-card-foot { display: flex; align-items: center; gap: 8px; min-width: 0; color: var(--kb-muted); font-size: 10.5px; }
.kb-card-foot > span { white-space: nowrap; }
.kb-card-foot .kb-foot-grow { flex: 1 1 auto; }
.kb-card-status { display: none; flex: none; }

/* Compact columns: one-line cards that keep the board readable at a glance. */
.kb-board[data-density="compact"] { gap: 6px; }
.kb-board[data-density="compact"][data-align="scroll"] .kb-col {
  flex-basis: min(var(--kb-col-width, 280px), 220px);
}
.kb-board[data-density="compact"] .kb-col-head { padding: 3px 4px 3px 6px; gap: 4px; }
.kb-board[data-density="compact"] .kb-col-title { font-size: 10px; letter-spacing: 0.03em; }
.kb-board[data-density="compact"] .kb-col-count { font-size: 10px; }
.kb-board[data-density="compact"] .kb-col-add { width: 16px; height: 16px; font-size: 13px; }
.kb-board[data-density="compact"] .kb-col-body { gap: 3px; padding: 4px; min-height: 40px; }
.kb-board[data-density="compact"] .kb-card {
  flex-direction: row;
  align-items: center;
  gap: 5px;
  padding: 3px 5px;
  border-left-width: 2px;
  border-radius: 4px;
}
.kb-board[data-density="compact"] .kb-card-status { display: inline-flex; align-items: center; }
.kb-board[data-density="compact"] .kb-card-head { flex: 1 1 auto; align-items: center; }
.kb-board[data-density="compact"] .kb-card-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}
.kb-board[data-density="compact"] .kb-card-menu { margin: 0; }
.kb-board[data-density="compact"] .kb-card > .kb-card-tags,
.kb-board[data-density="compact"] .kb-card > .kb-card-line,
.kb-board[data-density="compact"] .kb-card > .kb-card-foot { display: none; }
.kb-board[data-density="compact"] .kb-col-empty { min-height: 32px; padding: 4px; }

.kb-dot { width: 7px; height: 7px; border-radius: 999px; background: var(--kb-muted); flex: none; }
.kb-dot[data-status="running"] { background: var(--kb-warning); animation: kb-pulse 1.6s ease-in-out infinite; }
.kb-dot[data-status="idle"] { background: var(--kb-success); }
.kb-dot[data-status="none"] { background: color-mix(in oklab, currentColor 28%, transparent); }
@keyframes kb-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.8); }
}
@media (prefers-reduced-motion: reduce) {
  .kb-dot[data-status="running"] { animation: none; }
}

.kb-progress {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.kb-progress-track {
  flex: 1 1 auto;
  min-width: 20px;
  height: 4px;
  border-radius: 999px;
  background: var(--kb-track);
  overflow: hidden;
}
.kb-progress-fill { height: 100%; background: var(--kb-success); border-radius: 999px; }
.kb-progress-label { flex: none; font-variant-numeric: tabular-nums; }

.kb-col-empty {
  display: grid;
  place-items: center;
  min-height: 48px;
  border: 1px dashed var(--kb-border);
  border-radius: 6px;
  color: var(--kb-muted);
  font-size: 11px;
  text-align: center;
  padding: 6px;
}

.kb-empty { display: flex; flex-direction: column; gap: 6px; padding: 10px 4px; }
.kb-empty-title { font-weight: 600; }
.kb-empty-body { color: var(--kb-muted); }

/* Detail */
.kb-detail { display: flex; flex-direction: column; gap: 10px; }
.kb-detail-head { display: flex; align-items: flex-start; gap: 6px; min-width: 0; }
.kb-detail-title { flex: 1 1 auto; min-width: 0; font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.kb-detail-actions { display: flex; flex-wrap: wrap; gap: 4px; }
.kb-grid { display: grid; grid-template-columns: minmax(90px, 0.7fr) minmax(0, 1.3fr); gap: 3px 8px; }
.kb-grid dt { color: var(--kb-muted); }
.kb-grid dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.kb-mono { font-family: var(--kb-mono, ui-monospace, monospace); font-size: 11px; }
.kb-section { display: flex; flex-direction: column; gap: 4px; }
.kb-section-head { display: flex; align-items: baseline; gap: 6px; }
.kb-section-title { font-weight: 600; }
.kb-section-detail { color: var(--kb-muted); }
.kb-note { color: var(--kb-muted); }
.kb-list { display: flex; flex-direction: column; gap: 2px; }
.kb-row { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.kb-row-icon { flex: none; width: 14px; text-align: center; color: var(--kb-muted); }
.kb-row-main { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kb-row-meta { flex: none; color: var(--kb-muted); font-variant-numeric: tabular-nums; }
.kb-todo[data-done="true"] .kb-row-main { color: var(--kb-muted); text-decoration: line-through; }
.kb-todo[data-active="true"] .kb-row-icon { color: var(--kb-info); }
.kb-changes { display: flex; flex-direction: column; gap: 2px; }
.kb-change { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.kb-change-file { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kb-add { color: var(--kb-success); font-variant-numeric: tabular-nums; }
.kb-del { color: var(--kb-danger); font-variant-numeric: tabular-nums; }

/* Archive */
.kb-archive { display: flex; flex-direction: column; gap: 6px; }
.kb-archive-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: 1px solid var(--kb-border);
  border-radius: 6px;
  background: var(--kb-surface);
  min-width: 0;
}
.kb-archive-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.kb-archive-title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kb-archive-meta { color: var(--kb-muted); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Help */
.kb-help { display: flex; flex-direction: column; gap: 10px; }
.kb-help-row {
  display: grid;
  grid-template-columns: minmax(140px, max-content) minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}
.kb-help-row > span:first-child {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-width: 0;
  color: var(--kb-muted);
}
.kb-help-row > span:last-child { min-width: 0; overflow-wrap: anywhere; }
.kb-help kbd {
  font-family: var(--kb-mono, ui-monospace, monospace);
  border: 1px solid var(--kb-border);
  border-radius: 4px;
  padding: 0 4px;
  font-size: 10.5px;
}

/* Dialogs */
.kb-form { display: flex; flex-direction: column; gap: 10px; }
.kb-field { display: flex; flex-direction: column; gap: 4px; }
.kb-field-label { font-weight: 600; font-size: 11px; }
.kb-field-hint { color: var(--kb-muted); font-size: 11px; }
.kb-field-row { display: flex; align-items: center; gap: 6px; }
.kb-field-row > * { min-width: 0; }
.kb-field-row > :first-child { flex: 1 1 auto; }
.kb-textarea {
  min-height: 64px;
  resize: vertical;
  border: 1px solid var(--kb-border);
  border-radius: 6px;
  background: var(--kb-surface);
  color: inherit;
  font: inherit;
  font-size: 12px;
  padding: 6px 8px;
  outline: none;
}
.kb-textarea:focus { border-color: var(--kb-info); }
.kb-check-row { display: flex; align-items: flex-start; gap: 6px; }
.kb-check-row > :first-child { flex: none; margin-top: 1px; }
.kb-error { color: var(--kb-danger); font-size: 11px; white-space: pre-wrap; }
.kb-form-footer { display: flex; justify-content: flex-end; gap: 6px; }
.kb-columns { display: flex; flex-direction: column; gap: 6px; }
.kb-column-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 6px;
  border: 1px solid var(--kb-border);
  border-radius: 6px;
  background: var(--kb-surface);
}
.kb-column-row input[type="text"] {
  flex: 1 1 auto;
  min-width: 0;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  padding: 2px 4px;
}
.kb-column-row input[type="text"]:focus { border-color: var(--kb-info); outline: none; background: var(--kb-surface-strong); }
.kb-color {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--kb-border);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
}
.kb-color::-webkit-color-swatch-wrapper { padding: 2px; }
.kb-color::-webkit-color-swatch { border: 0; border-radius: 3px; }
.kb-icon-button {
  all: unset;
  cursor: pointer;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 4px;
  color: var(--kb-muted);
  font-size: 13px;
  line-height: 1;
}
.kb-icon-button:hover { color: inherit; background: var(--kb-surface-strong); }
.kb-icon-button:disabled { opacity: 0.4; cursor: default; }
.kb-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`
