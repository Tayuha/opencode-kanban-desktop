# AGENTS.md — opencode-kanban-desktop

Instructions for AI agents working on this repository. Read this before changing code, packaging,
board data, or release metadata.

## What this project is

A local/private GUI kanban plugin for **OpenCode Desktop 2.3.2**. It is a desktop-native port of
`TomCC7/opencode-kanban`; it uses OpenCode projects, worktrees, sessions, tabs, dialogs, and
notifications. It does **not** use tmux, launch terminals, kill processes, or make external network
requests.

Current release line: **v0.1.1**. The package is `private: true` and is installed from a git
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
Tags:     v0.1.0, v0.1.1 (immutable)
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

- Current suite: **122 tests**.
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
src/gui/window.tsx           services, commands, settings, notifications, auto-sync
src/gui/panel.tsx            mounted panel/workspace
src/gui/components/*         board, detail, archive, help, dialogs
src/gui/model/*              pure, tested data logic
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

- **While Desktop is running:** write board changes to `kanban-board.json` (or call the `save`
  RPC). Auto-reload polls the last selected project every two seconds and applies the file when the
  live board is clean. Direct writes to `drafts.sqlite` are invisible to the in-memory store and can
  be overwritten.
- **While Desktop is closed:** update plugin storage only if you are sure which installation and
  board row you are changing; otherwise edit the snapshot and let the user reload it.
- Auto-export writes board changes after a 1.5 s debounce. `.bak` is the previous snapshot.
- Auto-reload skips external changes when the live board has unsaved edits and shows a conflict
  toast.
- Export before major board-schema work. Keep `kanban-board.json.bak` and a closed-Desktop copy of
  `drafts.sqlite` for recovery.
- Board files contain titles, notes, branches, folder paths, and session IDs. Treat them as
  sensitive.
- Existing folders and worktrees: only plugin-created worktrees may be removed, with confirmation.
  An existing `directory` is never removed; branches are never deleted.
- Board data is per Desktop installation. Export/reload is whole-installation, not project-scoped.

## Upgrade and release rules

Existing checkout upgrade:

```bash
git fetch --tags
git checkout vX.Y.Z
npm ci
# npm run build only if the tag does not contain dist
```

Then fully quit and reopen Desktop. The config path does not change. Patch releases normally need
no data migration.

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
- Worktrees use OpenCode's native API only.
- No deleting sessions; no removing worktrees without user confirmation; never delete branches.
- The board RPC writes only `kanban-board.json`, `kanban-board.json.bak`, and
  `kanban-board.backup.json`.
- Keep React/Solid style, naming, and existing component patterns.
- Do not edit `node_modules`, `dist` by hand, or released tags. Rebuild `dist` instead.
- Do not mark a verification card Done without the user confirming the Desktop pass.
- Ask before destructive board, storage, worktree, or git history actions.

## Current open work

- **Auto-sync board with kanban-board.json** — auto-export/auto-reload implemented; pending GUI
  verification of K-44b–K-44e.
- **Deduplicate project list by folder** — implemented and released in v0.1.1; pending final
  switcher confirmation that the duplicate cache-stats row is gone.
- **Verify the worktree and session flow** — deferred; use the plugin repository or a throwaway git
  repo. See K-05/06/16/17/18 and K-20..22.
- Still open for a full release: safe reload/recovery, screenshots/docs completion, custom icons
  when the SDK exposes them, fresh-install smoke test, macOS/Windows testing.
