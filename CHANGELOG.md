# Changelog

## v0.1.1 — 2026-11-22

Patch release for existing v0.1.0 installs. No board data migration is required.

### Fixed

- Duplicate project entries when OpenCode exposes two project IDs for the same folder.
  The project switcher now deduplicates by canonical folder path, and the routed project's
  ID replaces the duplicate row. Selecting the folder keeps its tasks and sessions correct.

### Upgrade

From an existing v0.1.0 checkout:

```bash
cd /path/to/opencode-kanban-desktop
git fetch --tags
git checkout v0.1.1
npm ci
```

Fully quit and reopen OpenCode Desktop. The global `opencode.json` plugin entry keeps pointing at
the same checkout; no configuration change is needed. The board, tags, columns, session links, and
preferences remain in Desktop's plugin storage.

## v0.1.0 — 2026-11-20

First local/private release for OpenCode Desktop 2.3.2.
