# Troubleshooting

Symptom-driven checks for `opencode-kanban-desktop`. Start with the plugin listing and the global
config; most "the board is gone" reports are an install, project selection, or reload mistake.

## First checks

```bash
opencode plugin list
```

Expected: one `nmdra.kanban-desktop` entry, source `local`, and the absolute path to this checkout.
If it is missing, duplicated, or points elsewhere, fix the global config before changing code.

- Global config: `~/.config/opencode/opencode.json`.
- Desktop plugin storage (Linux): `~/.config/ai.opencode.desktop/drafts.sqlite`. The board and
  prefs are `state` rows named `opencode.global.dat` / `plugin.nmdra.kanban-desktop.board` and
  `plugin.nmdra.kanban-desktop.prefs`.
- Desktop logs (Linux): `~/.config/ai.opencode.desktop/logs/`.
- Server log (Linux): `~/.local/share/opencode/log/opencode.log`.

Quit Desktop fully before editing config, moving the checkout, or restoring the plugin database.

## The plugin is not listed or says "not loaded"

Check, in order:

1. The global `opencode.json` has the **absolute** checkout path, for example
   `/home/tayuha/Projects/opencode-plugins-creation/opencode-kanban-desktop`.
2. `npm ci` has completed in that checkout; the bundle requires its dependencies at runtime.
3. `dist/gui-experimental.cjs` exists and matches the source. If you changed `src/`, run
   `npm run build`.
4. Desktop was fully quit and reopened, not just its window.
5. The checkout is not **also** symlinked under `~/.config/opencode/plugins/`. Two sources produce
   duplicate entries and confusing load behavior.
6. `opencode plugin list` shows the expected id and path.

If `src` changed but `dist` did not, the app is loading old code. Rebuild and commit both.

## The board is empty

- The panel has a **project selector**. Confirm it is on the project that owns the cards. Columns
  are global, but cards are filtered by `projectID`.
- The top chip counts active tasks in the selected project; archived cards are in **Archive**.
- A search query or tag filter can hide every card. Clear the search and press **Clear tags**.
- If the board was reset, tasks, tags, custom columns, and assignments are gone; the three default
  columns remain. Worktrees and sessions are not removed.
- If the store was restored from an older `drafts.sqlite`, it contains the board from that backup,
  not the current one.

## Reload replaced the wrong board

This is the destructive path. Reload **replaces the selected project's board** with the file; it
is not a merge. Other projects' boards are untouched. Only a missing `sessionID` for an imported
task with the same ID is carried over.

1. Stop using the board.
2. In the project's board folder, look for `kanban-board.backup.json`. It holds that project's
   live board from before the reload, but only if the board had at least one task, you confirmed,
   and the backup write succeeded.
3. Copy it aside before reusing it, because a later confirmed reload of a non-empty board
   overwrites it:

   ```bash
   cd /path/to/project
   cp kanban-board.backup.json /tmp/kanban-board.recovery.json
   cp /tmp/kanban-board.recovery.json kanban-board.json
   ```

4. Reload again.

If there is no backup, check `kanban-board.json.bak` (the previous export file) or restore
`drafts.sqlite` from a backup. Full details and caveats are in [`board-file.md`](board-file.md).

An empty-board reload has no confirmation and writes no new backup. A stale backup may still exist
from an earlier reload; check its timestamp.

## Reload says the file is missing or invalid

- Reload reads the selected project's board `kanban-board.json` (its root unless you chose another
  board folder), not a task worktree.
- Export first to create the file, or copy a known-good snapshot there.
- Invalid JSON is rejected before the board changes. Validate with
  `node -e 'JSON.parse(require("fs").readFileSync("kanban-board.json","utf8"))'`.
- A JSON document that is not a board shape is rejected. It needs a non-empty `categories` array,
  a `tasks` array, and task objects with `id`, `title`, `projectID`, `branch`, and `categoryID`.
- The file must be a regular file, an absolute project directory must be supplied, and the file
  must be at most 5,000,000 bytes.
- A failed pre-reload backup cancels the reload. The toast should say so; the board is unchanged.

## Reload says the RPC is unavailable

The GUI could not reach the server part.

1. Restart OpenCode Desktop fully.
2. Confirm `opencode plugin list` shows `nmdra.kanban-desktop`; the server part must load for the
   RPC to exist.
3. Confirm `dist/gui-experimental.cjs` and `src/index.ts` are from the same build.
4. Check the server log for a plugin load error.

The toast asking for a restart is the intended message for `rpc.method_not_found`/unavailable.

## Export fails

- The project's board folder (its root unless overridden) must exist and be writable.
- A `.bak` copy failure aborts the export before the board file is replaced; free space and fix
  permissions, then retry.
- Export writes **only the selected project's board** to its board folder. Other projects' cards
  are not included.
- Exporting into a git project can create an untracked/modified `kanban-board.json`. Decide whether
  to commit it or add it to the project's `.gitignore`.
- The file can contain titles, notes, branches, worktree paths, and session IDs; treat it as
  sensitive.

## Worktree creation fails

The dialog shows the server error and no card is written. Check:

- the project is a git repository and `vcs.get`/`vcs.base` work there;
- the base branch exists;
- the branch name is valid and not already used by another task in the same project;
- the branch/worktree is not already checked out elsewhere;
- the app can write to its worktree directory.

Turn **Create a git worktree** off to create a plain card in the project root while you investigate.

## Worktree removal fails

A dirty worktree fails the first, non-forced removal. The force confirmation shows the server error
and names the risk; declining keeps both the task and the worktree. If you accept, the worktree is
removed but the branch remains.

Delete the branch manually with git after you are sure its commits are not needed. The plugin does
not expose branch deletion.

## A card has no status, todos, or cost

- **No session:** the card shows **No session** until a root session exists in the task's worktree
  (or project root) or is linked explicitly.
- A session created in a different directory does not match. Create it in the task directory, or
  use **Link session…** / **Link to this session**.
- A **subagent** session cannot be the task's root session. Link a root session instead.
- **Status** comes from `session.active()` plus events and the safety poll. If the poll is **Off**
  and events are missed, press **Refresh**.
- **Todos:** the session must contain a completed todo tool call in its recent messages. Without
  one, progress is deliberately absent. Todo data is cached for 60s (30s for an empty result), so a
  new plan can take a moment to appear.
- **Cost:** shown on a card only when the root session or its subagents report a positive cost; the
  detail view always shows a formatted value, including `$0.00`.
- **Changes:** read from VCS for the worktree, or the project root for a plain task. A read failure
  shows a note in the Changes section.

## Link session is empty or refused

The picker lists root, non-pending session tabs on the panel's server in the task's project. It
excludes:

- sessions from another project or server;
- subagent sessions;
- pending tabs that the app has not mounted.

Use **Link to this session** while in the right session, or open the desired session tab first.
Linking to a session from another project is refused with a toast by design.

## Open does nothing after a session was deleted elsewhere

An **archived** pinned session stays linked and shows idle. If the server confirms the pinned
session was **deleted**, the board clears the pin after the next refresh and shows a toast. A pin
never falls back to another worktree session in the meantime.

If a stale pin still appears after a server or app upgrade, use **Unlink session** or **New
session**. A task with no pin and a worktree may discover the newest root session there; opening it
pins that session explicitly, so later refreshes keep it.

## Notifications do not appear

Check all of:

- **Completion notifications** is on in Kanban settings;
- Desktop's own notification settings and focus rules allow the notification;
- a Kanban panel/full board is open on that project, or it is the routed project and the pill or
  notifications are enabled (background projects do not poll);
- the session actually transitions from running to idle;
- the task is not archived (transitions for archived tasks are skipped);
- this window has not already sent the same `sessionID:sessionUpdated` notification.

Dedupe is per window and keyed by session + update time, so several tasks linked to one session
produce one notification in that window. Cross-window suppression is the app's behavior; verify it
separately if it matters to you.

## The composer pill is missing

- **Composer pill** must be on in Kanban settings.
- The plugin entry must not set `options.pill: false` in `opencode.json`.
- The routed project must have at least one active (non-archived) card, and a live snapshot must
  have loaded.
- The pill shows a running count or task count; its rows are running tasks only.
- Background projects do not show a pill.

## The board is stale or stops updating

- The stale notice means the last read failed; cards keep their last good state. Press **Retry**.
- If the server restarted, the live registry reconnects on the next event or poll; no window
  reload is required.
- If the refresh interval is **Off**, recovery depends on events or a manual **Refresh**.
- A stale notice with an error is not the same as an empty project: the cards are still there,
  just not freshly confirmed.

## Columns differ between projects

- Columns are per project board. A new board starts with Todo / In progress / Done; edits stay in
  that board.
- Changing project A's columns does not change project B.
- The default column setting is global by ID and falls back to the project's first column when the
  chosen ID is absent from that project.
- **Compact** density only changes how cards render. It does not change columns or stored data.

## Tags and filters

- Tags are **per project**, like columns. Renaming or deleting a tag affects only the selected
  project; other projects keep their own copies.
- Existing v0.1.1 tags are split into each project board during the one-time migration. An
  intentionally empty project tag set stays empty.
- The filter is **AND**: a task must have every selected tag. Select one tag to broaden results.
  Switching projects clears the active tag filter.
- Clicking a card tag toggles it in the filter. **Clear tags** resets the filter.
- Deleting a tag removes it from that project's tasks and from the active filter.
- Reload replaces that project's tags and assignments with the file's contents. If the file lacks
  tags, they are gone. Export first.
- Tags are not reorderable yet.

## Settings do not persist or reset did too much

- Boards and preferences are `Store.global` values in Desktop's plugin storage. They are local to
  this installation. Each project folder keeps its own board.
- **Reset board data** is a global reset: it deletes every task, every tag, every tag assignment,
  and every project's column set, then restores Todo / In progress / Done in each board. It does
  not remove worktrees, stop sessions, or change preferences.
- If settings are lost after a restart, check whether `drafts.sqlite` was restored, replaced, or
  cleaned by another tool.

## Undo is missing

- Archive and delete offer **Undo** only in the toast, for eight seconds. Once the toast closes, there is no history.
- Deleting with the worktree removes it; that delete is permanent and has no Undo action. The
  toast says “worktree removed”.
- A task with no worktree, including every non-git project, always offers Undo. The project folder
  is not a worktree; only a git worktree created by the task can be removed.
- Undo restores the task snapshot. If its column or tag was deleted meanwhile, it falls back to the first column and drops the missing tag.

## Known limits

- Linux is the exercised platform. Windows path normalization is unit tested, but Desktop flows on
  macOS and Windows are not verified.
- Export/reload is project-scoped. A file holds only that project's board.
- A board file from another installation can contain project IDs that do not exist here; those
  tasks remain stored but may not be reachable in the project switcher.
- No branch deletion, existing-directory tasks, tag reordering, or persistent undo history.
- The Help key column expands and wraps its chips. If a key list is still hard to read, widen the
  panel; report the exact width and keys.
