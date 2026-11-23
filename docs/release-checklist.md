# Release checklist — v0.1.1

> v0.1.1 is a patch over v0.1.0 with no board data migration. The v0.1.0 gates that remain open are still listed below.

The ordered runbook for shipping `opencode-kanban-desktop`. The detailed test cases live in
[`test-plan.md`](test-plan.md); the acceptance matrix lives in
[`acceptance-checklist.md`](acceptance-checklist.md); the board-file semantics live in
[`board-file.md`](board-file.md). This page is the gate to run, in order, on release day.

## Scope

- **Release type:** local/private v0.1.1 patch over v0.1.0. The package is `private: true` and installs from a
  checkout through the global `opencode.json`. Publishing to npm is out of scope.
- **Target:** OpenCode Desktop **2.3.2**, pinned in `package.json`.
- **Platform exercised:** Linux. macOS and Windows remain follow-ups.
- **Data model:** one global board per Desktop installation; export/reload is whole-installation,
  not project-scoped.
- **Sources of truth:** `TODO.md` for the backlog, [`test-plan.md`](test-plan.md) for manual cases,
  [`acceptance-checklist.md`](acceptance-checklist.md) for the detailed matrix, and
  [`board-file.md`](board-file.md) for export/reload guarantees.

## 0. Freeze

- [ ] Freeze `src`, `dist`, and docs for the release.
- [ ] Confirm `package.json` version is `0.1.1` and `private: true`.
- [ ] Record the commit or tag in the sign-off table below.
- [ ] Back up Desktop's plugin storage:
      `sqlite3 ~/.config/ai.opencode.desktop/drafts.sqlite ".backup '/tmp/kanban-drafts.sqlite'"`
- [ ] Note that restoring `drafts.sqlite` restores **all** Desktop plugin storage, not only the
      Kanban board. Quit Desktop before restoring it.
- [ ] Back up every current `kanban-board.json`, `kanban-board.json.bak`, and
      `kanban-board.backup.json` that matters, and note any worktrees or sessions that must survive.
- [ ] Confirm no P0 item in `TODO.md` is unchecked without an explicit waiver.
- [ ] Confirm README, design, test plan, acceptance checklist, board-file doc, and SECURITY agree
      on the test count, bundle requirements, open modes, tags, reload behavior, and reset scope.

## 1. Automated gates

Run from the checkout:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

- [ ] `npm ci` completes from the lockfile.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm test` passes **124** cases. If the count changed, update README, design, test-plan, and
      the acceptance checklist before signing.
- [ ] `npm run build` emits `dist/gui-experimental.cjs`.
- [ ] A second build is byte-identical:
      `cp dist/gui-experimental.cjs /tmp/a.cjs && npm run build && cmp /tmp/a.cjs dist/gui-experimental.cjs`
- [ ] The bundle requires only the five shared modules:
      `grep -oE 'require\("[^"]+"\)' dist/gui-experimental.cjs | sort -u`
      Expected: `effect`, `@opencode/plugin/gui`, `@opencode/plugin/rpc`, `solid-js`,
      `solid-js/web`.
- [ ] `npm audit --audit-level=high` exits 0.
- [ ] The server part loads and the plugin id is listed:
      `opencode plugin list` shows `nmdra.kanban-desktop`, source `local`, this checkout's path,
      and no duplicate Kanban source.
- [ ] No process-execution or direct-network API in `src/`:
      `rg -n 'child_process|node:child_process|\bspawn\(|\bfetch\(|WebSocket|new Function' src`
      returns no matches. Do **not** use a bare `exec(` pattern: the source contains a harmless
      regex `.exec(` in `src/gui/window.tsx`.
- [ ] The committed `dist` matches a fresh build:
      `git diff --exit-code -- dist` (also enforced by CI).
- [ ] The committed bundle was produced from the frozen source.

## 2. Install gate

- [ ] The global `~/.config/opencode/opencode.json` contains the **absolute** checkout path.
- [ ] The checkout is **not** also symlinked under `~/.config/opencode/plugins/`.
- [ ] Fully quit and reopen Desktop.
- [ ] **Settings → Extensions → Plugins** shows `nmdra.kanban-desktop`, enabled, not "not loaded".
- [ ] `opencode plugin list` shows exactly one Kanban entry for this installation.
- [ ] Disable, then re-enable the plugin; the GUI returns without a window error.
- [ ] `/kanban`, `mod+alt+k`, the **+** menu, and the full-board command all open the board.

## 3. Functional gates

Run the listed cases from [`test-plan.md`](test-plan.md). Tick an area only when every case passes.

### Board and tags

- [ ] K-02, K-03, K-04 — panel, full board, empty state.
- [ ] K-09, K-10, K-11, K-11b, K-11c, K-11d, K-12, K-13 — drag, keyboard move, per-project columns and tags.
- [ ] K-14, K-15, K-15b — search, archive undo, and archive restore.
- [ ] T-01 to T-07 — tags: per-project manager, assignment, card chips, AND filter, delete cleanup, persistence, isolation.
- [ ] K-19 plus T-02 — task edit persists title, column, notes, and tags.
- [ ] K-33, K-33b, and K-33c — alignment, width, density, poll interval, default column, and Help key wrapping; changes apply and survive restart.
- [ ] K-34 — reset deletes tasks, **tags**, tag assignments, and every per-project column set;
      restores the default columns; leaves worktrees, sessions, and preferences.

### Tasks, worktrees, sessions

- [ ] K-05, K-05b, K-06, K-07, K-08 — create, project-subfolder existing folder, worktree, generated branch, validation.
- [ ] K-16, K-16b, K-16c, K-17, K-18 — delete undo, existing-folder safety, path validation, worktree removal, force.
- [ ] K-20, K-20b, K-20c, K-20d — reuse, focus, new session, ask.
- [ ] K-20e, K-20f, K-20g, K-20h, K-20i — link current/open, shared session, unlink, cross-project.
- [ ] K-21, K-22, K-23, K-23b, K-23c, K-48 — prompt, existing session, manual discovery, pinned-session persistence, deleted-pin cleanup.
- [ ] K-27 — start agent with the default prompt (shown only when no session exists).
- [ ] K-48 — after an externally deleted session, New session or Unlink recovers the card. Do not
      sign off claiming the board automatically clears a stale stored ID.

### Live state and notifications

- [ ] K-24 — todo progress from the newest completed todo tool call.
- [ ] K-25 — subagent status and cost.
- [ ] K-26 — VCS changes, totals, base branch, 60-file display cap.
- [ ] K-28, K-29 — completion notification focus/sound and no duplicate from this window.
- [ ] K-30, K-40 — stale snapshot, retry, server restart.
- [ ] K-31, K-32 — composer pill and the `options.pill` override.

### Reload, export, persistence

> **Reload replaces the entire live board with the file.** It is not a merge. Cards, columns,
> tags, tag assignments, archive state, and positions come from the file. A stale seed removes
> anything not in that seed. Export first.
>
> A pre-reload backup is written only when the live board has at least one task in any project,
> the user confirms, and the backup write succeeds. An empty board reload has no new backup. A
> failed backup cancels the reload. `.bak` is the previous export file, not a live-board snapshot.
> Live status is derived from sessions and is not stored in the file.

- [ ] K-41 — reload an **exported/current** `kanban-board.json`; confirm when the board has tasks;
      verify cards, columns, tags, assignments, archive state, and positions match the file.
- [ ] K-42, K-43 — missing and invalid files leave the board untouched.
- [ ] K-44 — export writes `kanban-board.json` and keeps an existing previous file as `.bak`; the
      file contains every project's tasks.
- [ ] K-44b — with auto-export on, column/tag/task changes update `kanban-board.json` without
      pressing Export; `.bak` is the previous snapshot.
- [ ] K-44c — disabling auto-export stops automatic writes; manual Export still works.
- [ ] K-44d — external file edits auto-reload while the live board is clean.
- [ ] K-44e — an external edit with unsaved live changes shows a conflict toast and does not clobber the board.
- [ ] K-45 — a confirmed reload writes `kanban-board.backup.json`; copy it aside, restore it as
      `kanban-board.json`, and reload to verify recovery.
- [ ] K-46 — export from project A contains project B's cards; project B does not automatically
      receive a file.
- [ ] K-47 — an empty-board reload has no confirmation and writes no new backup.
- [ ] K-35 — tasks, tags, columns, positions, archives, settings, and session links survive a restart.
- [ ] K-36, K-36b, K-36c, K-36d — project switcher, server id recording, server-scoped boards, duplicate folder records.
- [ ] One hand-edited board with an unknown category/tag still loads through `normalizeBoard`.
- [ ] Do not use the stale seed file as a backup. Do not claim unrelated statuses or tag
      assignments are preserved by reload; only a missing `sessionID` for the same task ID is
      preserved.

### Security and privacy

- [ ] K-38 — no shell, process execution, direct network, WebSocket, or telemetry in source/bundle.
- [ ] K-39 — archive/delete never kills a session.
- [ ] Board file RPC reads/writes only the fixed filenames, atomically, with the 5,000,000-byte cap.
- [ ] Every destructive action asks for confirmation; forced worktree removal asks twice.
- [ ] Reload files are treated as untrusted input: shape-checked, normalized, and hand-edited
      `projectRoot`/`worktreePath` values are handled as data, not code.
- [ ] Board files are handled as sensitive data (titles, notes, paths, session IDs).
- [ ] No prompt text, tree content, credentials, or telemetry leaves the app. The plugin requests
      recent messages only to parse todo tool parts.

## 4. Docs and attribution

- [ ] README install steps match the actual path, global config, and Desktop version.
- [ ] README usage covers panel, full board, tags, open modes, linking, export/reload, settings,
      reset scope, and limits.
- [ ] README's reload wording says **replacement**, names the backup conditions, and links
      [`board-file.md`](board-file.md).
- [ ] `docs/design.md`, `docs/test-plan.md`, `docs/release-checklist.md`,
      `docs/acceptance-checklist.md`, `docs/board-file.md`, `docs/upgrading.md`,
      `docs/troubleshooting.md`, and `SECURITY.md` are current.
- [ ] `TODO.md` has no unchecked P0 without a waiver.
- [ ] `LICENSE` keeps the TomCC7/opencode-kanban MIT attribution; README links the original.
- [ ] Screenshots or a clear note that they are pending.

## 5. Release mechanics

- [ ] Commit `src`, `dist`, docs, `package.json`, and the lockfile in one release commit.
- [x] Tag the commit `v0.1.1`.
- [ ] Reinstall from the tag in a disposable profile or directory and smoke-test the panel.
- [ ] Confirm **Settings → Extensions → Plugins** still lists the plugin after the fresh install.
- [ ] Write release notes: features, fixes, known limitations, Desktop version, the global board
      file behavior, and the reload/backup path.
- [ ] Keep the previous working checkout available for rollback.

## 6. Rollback

If the release fails after install:

1. Remove the plugin entry from the global `opencode.json`.
2. Fully quit Desktop.
3. If only the board is damaged, restore a `kanban-board.json`/backup in the relevant project and
   reload after reinstalling. If all Desktop plugin state is damaged, restore the backed-up
   `drafts.sqlite` (this reverts all plugin storage, not only Kanban).
4. Restore the previous checkout or `dist/gui-experimental.cjs`.
5. Reopen Desktop and confirm the prior version loads.

Worktrees and sessions are never removed by uninstalling the plugin. Removing a worktree is a
separate, confirmed action; branch deletion is a manual git step.

## 7. Exit criteria

The release is accepted only when:

- Every automated gate and every functional area above is checked.
- The sign-off table is filled, with no open P0.
- The committed `dist` matches `src`.
- The install path works from a fresh restart.
- No known data-loss, session-kill, or egress bug remains.
- The reload warning and reset scope in the docs match the code.

## Sign-off

| Gate | Result | Date | By | Notes |
|---|---|---|---|---|
| Freeze and backup | | | | |
| Automated gates | | | | |
| Install gate | | | | |
| Board and tags | | | | |
| Tasks/worktrees/sessions | | | | |
| Live state/notifications | | | | |
| Reload/export/recovery | | | | |
| Persistence | | | | |
| Security/privacy | | | | |
| Docs/attribution | | | | |
| Release mechanics | | | | |
