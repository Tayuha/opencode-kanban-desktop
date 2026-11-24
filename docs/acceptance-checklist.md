# Acceptance checklist

Detailed acceptance matrix for `opencode-kanban-desktop`. Run it through the ordered
[`release-checklist.md`](release-checklist.md) runbook; this page is the evidence behind each gate.
The board file's exact behavior is in [`board-file.md`](board-file.md).

## Build and package

- [ ] `npm ci` from a clean checkout
- [ ] `npm run typecheck` exits 0
- [ ] `npm test` passes every case (**136** at the time of writing; update the docs if the count changes)
- [ ] `npm run build` emits `dist/gui-experimental.cjs`
- [ ] A second build is byte-identical (`cp dist/gui-experimental.cjs /tmp/a && npm run build && cmp /tmp/a dist/gui-experimental.cjs`)
- [ ] The bundle requires only `effect`, `@opencode/plugin/gui`, `@opencode/plugin/rpc`, `solid-js`, and `solid-js/web`
- [ ] No `child_process`, shell execution, `spawn(`, `fetch(`, `WebSocket`, `new Function`, or telemetry in `src/` or `dist/`
- [ ] The source's harmless regex `.exec(` is not misreported as process execution
- [ ] `opencode plugin list` shows `nmdra.kanban-desktop` with source "local" and this checkout's path
- [ ] No duplicate Kanban source is listed
- [ ] `npm audit --audit-level=high` reports no high or critical advisories
- [ ] The committed `dist` matches a fresh build

## Install

- [ ] The absolute checkout path is in the global `opencode.json` `plugins` (and it is not also symlinked)
- [ ] **Settings → Extensions → Plugins** lists the plugin, enabled, not "not loaded"
- [ ] A Desktop restart loads the GUI without a window error
- [ ] The plugin can be disabled and re-enabled with the settings switch
- [ ] `/kanban`, `mod+alt+k`, the side **+** menu, and the full-board command all reach the board

## Board

- [ ] The panel opens from the command palette, `/kanban`, `mod+alt+k`, and the **+** menu
- [ ] The full board opens from its command and shares state with the panel
- [ ] The empty project state offers **New task**
- [ ] Cards render title, branch, worktree, status, todo progress, running subagents, and cost
- [ ] Drag and drop moves cards across columns and reorders within a column
- [ ] Shift+arrows move the selected task
- [ ] Arrow keys move the selection; Enter opens; Escape clears
- [ ] Searching matches title, branch, project name, and notes; Escape clears
- [ ] Columns add, rename, recolor, reorder, and delete for the selected project's board
- [ ] A new project board starts with Todo / In progress / Done; changing one project's columns leaves other boards unchanged
- [ ] Deleting a column moves that project's tasks; its last column cannot be deleted
- [ ] A task cannot move into another project's column
- [ ] Compact columns toggle from the header, `C`, the palette, and settings; cards become one-line rows and the setting survives a restart
- [ ] Archive and restore work; the archive view lists archived tasks and the panel chip counts active tasks
- [ ] The archive toast offers Undo for 8 seconds and restores the card
- [ ] Deleting without worktree removal offers Undo; deleting with worktree removal does not
- [ ] Task edit persists title, column, notes, and tags
- [ ] Tags can be added, renamed, recolored, and deleted from the manager for the selected project
- [ ] Tag changes in one project do not rename or delete tags in another project
- [ ] v0.1.1 tags are split into their owning project's board; empty tag sets stay empty
- [ ] Assigning tags shows chips on cards (up to three plus `+N`) and all tags in detail/archive
- [ ] The tag picker and filter only offer the selected project's tags
- [ ] The tag filter uses AND semantics and can be cleared
- [ ] Deleting a tag removes it from that project's tasks and the filter, leaving other projects unchanged
- [ ] Tags and assignments survive a restart and an exported/reloaded board file that contains them
- [ ] Reset deletes tasks, tags, tag assignments, and every per-project column set; restores the default columns; leaves worktrees/sessions/preferences alone
- [ ] Board alignment, column width, column density, poll interval, default column, auto-export, and auto-reload apply without a restart and survive one
- [ ] External `kanban-board.json` changes apply automatically while the live board is clean
- [ ] An external change with unsaved live edits is skipped with a conflict toast
- [ ] Auto-export writes column/tag/task changes to `kanban-board.json` without pressing Export
- [ ] Disabling auto-export stops automatic writes; manual Export still works

## Worktrees and sessions

- [ ] Creating a task in a git project creates a worktree through the API
- [ ] A generated worktree label has the `feature/word-word-NNN` shape; Generate produces another valid name
- [ ] Creating a worktree task produces a detached worktree at the base ref; the plugin does not create or delete a git branch
- [ ] Long switch and field descriptions wrap instead of clipping at the dialog edge
- [ ] Choosing **Default branch** keeps its text visible and detaches the worktree at HEAD
- [ ] A linked session opens in the task directory by default with the prompt prefilled and bound immediately
- [ ] Auto-prompt creates a session, sends the prompt, binds it, and opens its tab
- [ ] A worktree creation failure leaves no task record and shows the server error
- [ ] A session or prompt failure after card creation leaves the card and reports a toast
- [ ] Open focuses an existing pinned session instead of creating a duplicate
- [ ] A pinned session survives a newer session in the same worktree and a Desktop restart
- [ ] A missing pinned session does not fall back to another worktree session
- [ ] An archived pinned session stays linked and idle
- [ ] A deleted pinned session is cleared after a confirmed not-found; Unlink disappears
- [ ] Reuse creates and binds a session when the task has none, and the next open focuses it
- [ ] New session creates and binds a fresh session and leaves the old one in its tab
- [ ] Ask shows Reuse / New when the task already has a session; with no session it creates one
- [ ] The card menu and detail view expose Open and New session (Open still follows the open mode)
- [ ] Link to this session binds the task to the routed session and Open focuses it
- [ ] Link session lists only root, non-pending, same-project, same-server sessions, current first
- [ ] Two tasks linked to one session share its state and notify once per transition in a window
- [ ] Unlink removes the explicit link; worktree auto-matching may still apply
- [ ] A manually created session in the worktree binds to the card on refresh
- [ ] A non-git project creates plain tasks and opens linked sessions in the project root
- [ ] Delete with worktree removal works; a dirty worktree requires the force confirmation
- [ ] Declining the force confirmation leaves both the worktree and the task
- [ ] Deleting or archiving a task never stops its session
- [ ] After an externally deleted session, New session or Unlink recovers the card (the board does not automatically clear the stale stored ID)

## Live state

- [ ] Running and idle update within the poll interval or on events
- [ ] Todo progress appears when the todo tool was used and is absent otherwise
- [ ] Subagents show status, cost, and todo counts
- [ ] Changes show files, additions/deletions, totals, and the base branch; the file list is capped at 60
- [ ] A failed read marks the board stale and keeps the last cards
- [ ] Retry recovers after the server returns
- [ ] A server restart reconnects without a window reload

## Notifications and pill

- [ ] Completion notification fires on running → idle
- [ ] Clicking the notification opens the task's session
- [ ] Notification respects Desktop's notification settings
- [ ] A second Desktop window does not create a duplicate completion for the same event in this window; record the observed cross-window behavior separately
- [ ] The pill shows the running count or task count and opens a row's session
- [ ] The pill hides via Settings and via `options.pill: false`
- [ ] With the pill on or notifications on, the routed project keeps its status fresh

## Export, reload, and persistence

- [ ] Tasks, columns, positions, archives, settings, and session links survive a Desktop restart
- [ ] New tasks record the mounted server id; legacy tasks are claimed when their project opens
- [ ] The board, archive, pill, and live status do not mix tasks from another server with the same project id
- [ ] Two OpenCode project records for the same folder appear once in the switcher; the routed id wins
- [ ] Switching projects swaps the entire board, including that project's columns, tags, and archive; no cards leak between projects
- [ ] The project switcher follows the routed session's project on open
- [ ] Selecting a project with a board but no board file creates its snapshot; selecting one with an existing file does not overwrite it
- [ ] Export keeps an existing previous file as `kanban-board.json.bak`
- [ ] Exporting into a git project may create an untracked/modified board file; the doc warns about it
- [ ] Reload reads an **exported/current** project `kanban-board.json`, confirms when that project's board has any task, and replaces that project's board with the file
- [ ] Reload writes `kanban-board.backup.json` only after confirmation and only when that project's board has at least one task; an empty board writes no new backup
- [ ] A reload of a legacy whole-installation file keeps only the selected project's tasks and ignores other folders
- [ ] A failed pre-reload backup cancels the reload and leaves the board untouched
- [ ] Missing, oversized, invalid-JSON, or wrong-shape files leave the existing board untouched with a clear toast
- [ ] A valid reload's cards, columns, tags, assignments, and archive state match the file; there is no general merge
- [ ] A missing `sessionID` is preserved for an imported task with the same task ID; a session ID named by the file wins
- [ ] Live status is derived from sessions and is not claimed to be stored/reset by reload
- [ ] The board file RPC writes only the fixed filenames, atomically, capped at 5,000,000 bytes
- [ ] A recovery reload from `kanban-board.backup.json` restores the pre-reload project board
- [ ] `normalizeBoard` repairs a hand-edited board without dropping the window
- [ ] A v0.1.1 board with tasks from several projects is split into one board per folder without losing cards
- [ ] `Reset board data` is global and also deletes tags and tag assignments in every board

## Security and privacy

- [ ] No shell, child process, `git` invocation, process kill, direct network call, WebSocket, or telemetry
- [ ] Board file RPC trusts only the caller-supplied absolute directory and writes fixed filenames
- [ ] Hand-edited board files are treated as untrusted input; task paths are not executed by the plugin
- [ ] Destructive actions use confirmation; forced worktree removal asks twice
- [ ] Board files are handled as sensitive data (titles, notes, paths, session IDs)
- [ ] No prompt text, tree content, credentials, or telemetry leaves the app; todo parsing reads recent messages locally

## Documentation

- [ ] README install steps match the actual paths and Desktop version
- [ ] README limitations match observed behavior, including project-scoped export/reload, foreign project IDs, stale session bindings, and platform coverage
- [ ] README's export/reload section uses replacement wording and names the backup conditions
- [ ] `docs/design.md`, `docs/test-plan.md`, `docs/release-checklist.md`, `docs/board-file.md`, `docs/troubleshooting.md`, and `SECURITY.md` are current
- [ ] `TODO.md` has no unchecked P0 without a written waiver
- [ ] The committed `dist` matches `src`

## Release decision

- [ ] No known data-loss, session-kill, or network-egress bug remains
- [ ] `docs/release-checklist.md` is signed
- [ ] The release is scoped to a local/private v0.1.x, not an npm publish

## Attribution

- [ ] `LICENSE` keeps the TomCC7/opencode-kanban MIT attribution
- [ ] README links the original project
