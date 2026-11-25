# Changelog

## Unreleased (v0.1.3)

Do not tag yet. The package version stays `0.1.2` until this release is closed.

- Boards now adopt the current OpenCode project ID and canonical root for their folder when the
  project is opened. Duplicate project records no longer hide existing cards while leaving the
  board's columns and tags visible.
- Added 2 board tests; the suite now has 138 cases.
- The detail view hides the Todos section when the session has no todo list, instead of showing an empty placeholder.
- README screenshots remain queued for this release.

## v0.1.2 — 2026-11-24

Feature patch over v0.1.1. The board store migrates once; back up `drafts.sqlite` and export the
boards you care about before upgrading.

### Added

- **Per-project boards.** Boards are stored one per canonical project folder in the
  `plugin.nmdra.kanban-desktop.boards` state row. Switching projects swaps the whole board instead
  of showing or exporting another project's cards.
- **Project-scoped board files.** Export, auto-export, reload, and auto-reload read and write only
  the selected project's `kanban-board.json` in its project root. Selecting a project with a board
  but no file creates its snapshot; an existing file is not overwritten just by selecting it.
- Added `AGENTS.md`, the guide for AI agents working on the plugin, and `docs/upgrading.md`, the
  release, upgrade, migration, and rollback plan. The README links both.

### Changed

- The task **Existing folder** picker and the per-project **board folder** picker were removed.
  New tasks run in a worktree or the project root, and board files live at `<projectRoot>`.
- Reload confirmation and notes describe a project replacement instead of a whole-installation
  replacement.
- Auto-reload uses a canonical board key and distinguishes an effective board update from a file
  that normalizes to the same board (for example duplicate task IDs).
- Worktree creation matches OpenCode 2.3.2: it passes the base ref and a sanitized worktree name.
  The API creates a detached worktree and never creates a git branch; the task's branch name is a
  label until you create the branch inside the worktree.
- The new-task dialog wraps switch descriptions instead of clipping them and keeps the
  “Default branch” label visible.
- Deleting a worktree task opens one choice dialog: keep the worktree or remove it with the card.
  The branch is never deleted.

### Fixed

- Detail labels no longer render literal `{{time}}` placeholders; the Changes empty copy no longer
  says “worktree” for tasks without one.

### Upgrade

From v0.1.1, the old global `board` row is split once by each task's `projectRoot` into per-project
boards, then reset. A legacy whole-installation snapshot is narrowed to the selected project on
reload; tasks for other folders are ignored. See [`docs/upgrading.md`](docs/upgrading.md).

The automated suite now has 136 cases, including board-map and worktree-payload coverage.

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
