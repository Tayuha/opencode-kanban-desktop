# AGENTS.md — opencode-kanban-desktop

Instructions for AI agents working on this repository. Read this before changing code, packaging,
board data, or release metadata.

## What this project is

A local/private GUI kanban plugin for **OpenCode Desktop 2.3.2**. It is a desktop-native port of
`TomCC7/opencode-kanban`; it uses OpenCode projects, worktrees, sessions, tabs, dialogs, and
notifications. It does **not** use tmux, launch terminals, kill processes, or make external network
requests.

Current release line: **v0.1.3**. The package is `private: true` and is installed from a git
checkout, not npm.

## Read first

- [`README.md`](README.md) — install, usage, settings, limitations
- [`docs/design.md`](docs/design.md) — architecture, data model, lifecycle, failure paths
- [`docs/test-plan.md`](docs/test-plan.md) — automated and manual acceptance cases
- [`docs/upgrading.md`](docs/upgrading.md) — release, upgrade, migration, rollback
- [`docs/release-checklist.md`](docs/release-checklist.md) — ordered release gates
- [`docs/board-file.md`](docs/board-file.md) — snapshot format, export/reload, backups
- [`SECURITY.md`](SECURITY.md) — trust boundaries and permission scope
- [`CHANGELOG.md`](CHANGELOG.md) — version history

## Repository and release identity

```text
Checkout: /home/tayuha/Projects/opencode-plugins-creation/opencode-kanban-desktop
Remote:   git@github.com:Tayuha/opencode-kanban-desktop.git (SSH)
Branch:   main
Tags:     v0.1.0, v0.1.1, v0.1.2, v0.1.3 (immutable)
```

- Never move, delete, or re-create a published tag. Fix forward with a new patch version.
- `package.json` is `private: true`; never publish to npm.
- `dist/gui-experimental.cjs` is committed and must match a fresh deterministic build.
- The committed release tag must contain `dist`, source, docs, `package.json`, and the lockfile.

## Install and configuration

Dependencies:

```bash
npm ci
```

The plugin is registered in the **global** OpenCode config, normally
`~/.config/opencode/opencode.json`, with an absolute path:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "/home/tayuha/Projects/opencode-plugins-creation/opencode-kanban-desktop",
      "options": { "pill": true }
    }
  ]
}
```

Do not also symlink the checkout under `~/.config/opencode/plugins/`; that produces duplicate
plugin entries. After changing config or code, fully quit and reopen Desktop.

Verify with **Settings → Extensions → Plugins** and:

```bash
opencode plugin list
```

## Build, test, and quality gates

```bash
npm run typecheck
npm test
npm run build
npm audit --audit-level=high
```

- Current suite: **138 tests**.
- Build twice and compare byte-for-byte when touching the bundle:
  `cp dist/gui-experimental.cjs /tmp/a.cjs && npm run build && cmp /tmp/a.cjs dist/gui-experimental.cjs`
- The bundle must require only `effect`, `@opencode/plugin/gui`, `@opencode/plugin/rpc`,
  `solid-js`, and `solid-js/web`.
- Do not claim a GUI card is verified from tests alone. Desktop behavior needs a manual pass.
- Update `docs/test-plan.md`, `docs/acceptance-checklist.md`, and counts when adding tests.

## Architecture map

```text
src/index.ts                 server plugin; registers load/save RPC
src/rpc.ts                   board RPC contract
src/server/board-file.ts     fixed-filename, atomic board read/write, 5 MB cap, .bak
src/gui.tsx                  GUI entry
src/gui/definition.ts        stores, schemas, i18n
src/gui/window.tsx           services, commands, settings, notifications, per-project auto-sync
src/gui/panel.tsx            mounted panel/workspace
src/gui/components/*         board, detail, archive, help, dialogs
src/gui/model/*              pure, tested data logic
src/gui/model/boards.ts      per-project board map, migration, file-folder choice
src/gui/data/live.ts         live session registry, hydration, transitions
src/gui/data/actions.ts      worktree/session/VCS actions
src/gui/style.ts             scoped CSS
```

The `model/` layer must stay SDK-free and unit-tested. Keep GUI code out of it. Keep server and GUI
parts decoupled; the server RPC may only read/write fixed board filenames under the supplied
absolute project root.

## Board data and agent edits

The authoritative board is Desktop plugin storage (`Store.global`), normally
`~/.config/ai.opencode.desktop/drafts.sqlite` on Linux. `kanban-board.json` is a snapshot.

- **While Desktop is running:** write board changes to the active project's `kanban-board.json` (or
  call the `save` RPC with its project root). Auto-reload polls the last selected project every two
  seconds and applies the file when that project's live board is clean. Direct writes to
  `drafts.sqlite` are invisible to the in-memory store and can be overwritten.
- **While Desktop is closed:** update plugin storage only if you are sure which installation and
  board row you are changing; otherwise edit the snapshot and let the user reload it.
- Auto-export writes each changed project's board after a 1.5 s debounce. `.bak` is the previous
  snapshot.
- Auto-reload skips external changes when that project's live board has unsaved edits and shows a
  conflict toast.
- Export before major board-schema work. Keep `kanban-board.json.bak` and a closed-Desktop copy of
  `drafts.sqlite` for recovery.
- Board files contain titles, notes, branches, legacy folder paths, and session IDs. Treat them as
  sensitive.
- New tasks run in a worktree or the project root. Legacy tasks with a stored `directory` keep
  using it, but the new-task dialog has no folder picker. Only plugin-created worktrees may be
  removed, with confirmation; a legacy `directory` is never removed; branches are never deleted.
- Boards are stored one per canonical project folder in the `boards` store. Exports and reloads are
  project-scoped: a file holds only that project's cards, columns, tags, and archive state. The
  legacy global `board` store is read once during migration and then kept empty.
- Each project's board file is `<projectRoot>/kanban-board.json`.

## Upgrade and release rules

Existing checkout upgrade:

```bash
git fetch --tags
git checkout vX.Y.Z
npm ci
# npm run build only if the tag does not contain dist
```

Then fully quit and reopen Desktop. The config path does not change. Patch releases normally need
no data migration; v0.1.2 is the exception (it split the v0.1.1 global board, see
[`docs/upgrading.md`](docs/upgrading.md)).

Release process:

1. Run the gates above plus the affected manual cases.
2. `npm version X.Y.Z --no-git-tag-version`.
3. Update `CHANGELOG.md`, README version, and docs.
4. Commit, create an annotated tag, push `main` and the tag.
5. Create a GitHub Release from the tag.
6. Keep the previous tag/checkout for rollback.

Never use `opencode plugin update` for a local-path install; use `git checkout` + `npm ci` +
restart. Never rewrite a released tag. The full runbook is [`docs/upgrading.md`](docs/upgrading.md).

## Hard constraints

- No shell execution, tmux, terminal launching, process killing, or external network calls from the
  plugin.
- Worktrees use OpenCode's native API only. In 2.3.2, `worktree.create` runs
  `git worktree add --detach <dir> <ref>`: `name` labels the directory, `branch` must be an
  existing ref, and the API never creates a git branch. The plugin must not pretend otherwise.
- No deleting sessions; no removing worktrees without user confirmation; never delete branches.
- The board RPC reads and writes only `kanban-board.json`, `kanban-board.json.bak`, and
  `kanban-board.backup.json` inside the project root.
- Keep React/Solid style, naming, and existing component patterns.
- Do not edit `node_modules`, `dist` by hand, or released tags. Rebuild `dist` instead.
- Do not mark a verification card Done without the user confirming the Desktop pass.
- Ask before destructive board, storage, worktree, or git history actions.

## Current open work

- **v0.1.2** — released. Per-project boards/files, the one-time v0.1.1 split, the canonical
  no-change fix, and the worktree/session flow were verified in Desktop.
- **v0.1.3** — released. README screenshots, automatic project-ID adoption, and the hidden empty
  Todos section are verified.
- **v0.1.4** — open for the fresh-install smoke test, custom icons when the SDK exposes them, and
  macOS/Windows verification.
