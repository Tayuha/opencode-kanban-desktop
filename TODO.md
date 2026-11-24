# TODO — v0.1.x release backlog

Release-level backlog for `opencode-kanban-desktop`. The working board is the plugin's own Kanban
board; this file is the durable release view. The gate to run is
[`docs/release-checklist.md`](docs/release-checklist.md); the detailed cases are in
[`docs/test-plan.md`](docs/test-plan.md) and [`docs/acceptance-checklist.md`](docs/acceptance-checklist.md).

- **Target:** local/private v0.1.x on OpenCode Desktop **2.3.2**
- **Upgrade plan:** [`docs/upgrading.md`](docs/upgrading.md)
- **Platform exercised:** Linux
- **Last updated:** 2026-11-23

## Current state

> **v0.1.1** is a patch release over v0.1.0: it fixes duplicate project entries for the same folder. No board data migration is required. See [`CHANGELOG.md`](CHANGELOG.md).
>
> **v0.1.2 is open** but not tagged. It adds docs, the canonical no-change fix, and per-project
> boards/files with a one-time split of the v0.1.1 global board. Add changes under `Unreleased` in
> `CHANGELOG.md`; bump the package version and create the tag only when the release is closed.

Implemented and unit-tested:

- One CommonJS GUI bundle; 141 tests; typecheck clean; deterministic build
- Server part and board file RPC (load and save) with atomic writes
- Board, columns, archive, search, keyboard and drag operations
- Git worktrees and sessions through the OpenCode API
- Open modes: reuse, new session, ask
- Session linking: current session, open-session picker, unlink
- Per-project customizable tags with assignment, card chips, AND filter, and delete cleanup
- Live status, todos, subagents, cost, VCS changes
- Completion notifications and composer pill
- `kanban-board.json` export/reload with `.bak`, pre-reload backup, and binding preservation
- Compact column mode (toggle, `C`, palette command, settings)
- Per-project boards keyed by canonical folder, with a one-time split of the v0.1.1 global board
- Per-project `kanban-board.json` files, project-scoped reload, and an optional board folder per project
- Per-project columns and tags, each board storing its own set
- Pinned task sessions are authoritative, hydrated by ID, persist across restarts, and clear on confirmed deletion
- Undo toasts for archive and non-worktree delete
- Server id recorded on tasks, with legacy claiming and server-scoped live/board state
- Existing-folder task mode (project subfolders) and linked-session prefill
- Help key column widened and key chips wrap
- Auto-export and auto-reload of kanban-board.json with settings, canonical no-change detection, and conflict protection
- Project switcher deduplicates same-folder project records
- Starter board and tags in the working project

Verified in Desktop on 2026-11-20 (user pass):

- Panel entry points, `/kanban`, keybinds, command palette, full board
- Columns: create, rename, recolor, reorder, delete
- Tags: create, assign, filter, delete, persistence
- Compact columns: header toggle, `C`, palette command, settings
- Per-project columns and tags: project switch, isolated rename/delete, persistence
- Card/task moving, the test task, persistence across a restart

Not yet verified:

- A real git worktree/session flow
- Session linking and open modes on a real session
- A **safe** board reload with a current/exported file (the seed file reset the live board)
- A fresh install from a removed config and screenshots

## P0 — release blockers

Tick every item before tagging a release. Each maps to a card on the board.

- [x] **Verify the board UI in Desktop** (card `todo/verify-gui`)
      Panel, full board, keybinds, command palette, columns, tags, card moves, and persistence
      passed on 2026-11-20. Session linking/open modes, reload, and the rest of the test plan are
      tracked separately below.
- [ ] **Verify the worktree/session flow** (card `todo/verify-worktree-flow`)
      Create a task in a real git project; confirm worktree creation, linked session, status,
      deletion, and forced removal. Include a non-git project for plain tasks.
- [ ] **Verify session linking and open modes**
      Reuse/New/Ask, Link to this session, the open-session picker, unlink, and shared-session
      notification dedupe on a real session.
- [x] **Add automatic Export board and pre-reload backup**
      Export writes `kanban-board.json` and keeps `.bak`; Reload backs up the live board first.
- [ ] **Verify safe reload and recovery**
      Export the current board, then test valid, missing, invalid, oversized, and
      binding-preserving reloads. Confirm the pre-reload backup can restore the live board.
- [ ] **Finish the documentation** (card `docs/documentation`)
      README, design, test plan, release checklist, and limitations; verify every claim against
      the build and the real Desktop behavior.
- [ ] **Capture screenshots and finish the README** (card `todo/capture-screenshots`)
      Board, detail, task dialog, tags, and pill; verify every README claim against the build.
- [ ] **Fresh install and persistence pass**
      Remove the checkout from the config, restart, reinstall from the global config, and confirm
      board state, tags, links, columns, and settings recover.
- [x] **Commit and push the plugin** (card `chore/git-upload`)
      Repository initialized; `main`, `v0.1.0`, and patch tag `v0.1.1` pushed to
      `github.com:Tayuha/opencode-kanban-desktop` (SSH). The remaining release gates still apply.
- [ ] **Run and sign `docs/release-checklist.md`**
      No unchecked P0 without a written waiver.

## Done

Implemented and covered by the 141 automated tests:

- [x] Bundle builds as one CommonJS file (`dist/gui-experimental.cjs`)
- [x] `npm run typecheck` is clean
- [x] `npm test` passes 141 cases
- [x] Bundle requires only shared modules (`effect`, GUI, rpc, solid-js, solid-js/web)
- [x] Server part loads; plugin id is `nmdra.kanban-desktop`
- [x] Board file RPC (load/save), Export board, Reload board, and pre-reload backup
- [x] Per-project tags, task assignments, card chips, AND filter, delete cleanup
- [x] Open modes (reuse/new/ask) and explicit session linking (current/open picker/unlink)
- [x] Shared-session notification dedupe
- [x] Default board seeds the three documented columns
- [x] `npm audit --audit-level=high` is clean
- [x] Automatic export with `.bak` and pre-reload live-board backup
- [x] Defined `TODO.md` and `docs/release-checklist.md`; aligned the test plan and acceptance matrix
- [x] Board UI, keybinds, command palette, columns, tags, and persistence verified in Desktop (2026-11-20)
- [x] Compact column mode (toggle, `C` shortcut, palette command, settings)
- [x] Per-project columns and per-project tags verified in Desktop (2026-11-20)
- [x] Pinned session persistence and deleted-pin cleanup verified in Desktop (2026-11-20)
- [x] Undo for archive and non-worktree delete verified in Desktop (2026-11-20)
- [x] Server id recording verified in Desktop; all current tasks belong to `sidecar` (2026-11-20)
- [x] Existing-folder task mode and linked-session prefill verified in Desktop (2026-11-20)
- [x] Help key-column overlap fixed and verified in Desktop (2026-11-20)
- [x] Completion notifications verified in Desktop (2026-11-20)
- [x] Auto-export and auto-reload verified in Desktop (2026-11-23)
- [x] Project-list dedupe verified with v0.1.1 (2026-11-23)
- [x] Custom icon support checked: only the app icon catalog exists in 2.3.2 (2026-11-23)
- [x] Upgrade/release plan documented in `docs/upgrading.md` (2026-11-23)
- [x] Documentation audited and expanded; AGENTS/upgrading/README/design/test docs current (2026-11-23)
- [x] AI agent guide documented in `AGENTS.md` (2026-11-23)
- [x] Per-project boards and project-scoped board files implemented; 141 tests pass (2026-11-23)
- [ ] Per-project board split, project switching, and board-folder override verified in Desktop
- [ ] v0.1.2 release closed, version bumped, changelog finalized, tag created

## P1 — follow-ups

- [ ] Pin closed or arbitrary sessions, beyond the open-session linker
- [ ] Verify worktree-removal delete has no Undo in a real git project (covered by the worktree/session pass; use the plugin repo)
- [ ] Custom plugin icons when the SDK exposes them
- [ ] Re-pin and re-test when Desktop changes the experimental GUI API (2.3.2 is still latest as of 2026-11-23)
- [ ] Capture README screenshots manually (spectacle CLI unavailable here)
- [ ] macOS and Windows smoke test
- [ ] Optional tag presets and tag reordering

## Out of scope for v0.1.x

- npm publish (`package.json` is `private: true`; this is a local/private release)
- tmux, external terminal launching, and custom TUI themes
- Sharing or importing/exporting board state with the Rust TUI's SQLite (declined; the board is independent)
- Cross-project session linking (the board tracks sessions per project)
- Bundling a second server or a network daemon

## Definition of done

v0.1.x is releasable when:

1. Every P0 item is checked, or waived in writing in the release checklist.
2. `docs/release-checklist.md` is signed.
3. The committed `dist` matches a fresh build.
4. A fresh restart installs the plugin from the global config and the board recovers.
5. There is no known data-loss, session-kill, or egress bug.
6. README, design, test plan, acceptance checklist, and this backlog are consistent.

## Board mapping

The board is the live working view. The card **Define the TODO and release checklist** produced
this file and the release runbook. **Verify the GUI** now covers the board UI, keybinds, command
palette, columns, tags, and persistence; linking/open modes and safe reload/export are separate
P0 items. The other P0 cards cover worktrees, screenshots, and the git release. P1 follow-ups stay in the backlog and are not release blockers.
