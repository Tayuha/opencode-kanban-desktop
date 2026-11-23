# Changelog

## Unreleased (v0.1.2)

Do not tag yet. Add v0.1.2 changes here until the release is closed; the package version stays
`0.1.1` until then.

- Added `AGENTS.md`, the guide for AI agents working on the plugin.
- Added `docs/upgrading.md`, the release, upgrade, migration, and rollback plan.
- README now links both documents.
- Auto-reload now uses a canonical board key and distinguishes an effective board update from a
  file that normalizes to the same board (for example duplicate task IDs), instead of claiming
  the board updated.
- Detail labels no longer render literal `{{time}}` placeholders; the Changes empty copy no longer
  says “worktree” for tasks without one.

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
