# Kanban for OpenCode Desktop

A kanban board that lives inside OpenCode Desktop. Each card is a task with a branch, an
optional git worktree, and the OpenCode session working in it. Columns are movable, cards drag
between them, and the board tracks which agents are running, what their todo lists say, and what
changed in the worktree.

This is a **desktop GUI port of [`TomCC7/opencode-kanban`](https://github.com/TomCC7/opencode-kanban)**,
which is a terminal UI built around tmux. The board structure, task model, worktree workflow, and
keyboard-first feel are kept. tmux, terminal launching, and custom TUI themes are replaced by
OpenCode Desktop's native project, worktree, session, tab, dialog, and notification APIs.

**Release scope:** local/private v0.1.1 for OpenCode Desktop 2.3.2. The package is `private: true`
and installs from this checkout; it is not published to npm. The documented v0.1.1 baseline passes
`typecheck`, 135 unit tests, and a deterministic single-file GUI build.

## Requirements

- **OpenCode Desktop 2.3.2.** The GUI plugin API is experimental and version-coupled. The package
  pins `@opencode/plugin@2.3.2` and `@opencode/client@2.3.2`.
- **Node and npm** to install the checkout's dependencies. `dist/gui-experimental.cjs` is
  committed, so installing does **not** require a build.
- **Git**, for the worktree features. Projects that are not git repositories still support plain
  tasks in the project root.
- A local checkout of this directory. Worktrees, sessions, and the OpenCode server stay local.

When you update Desktop, re-pin both OpenCode packages in `package.json`, then run:

```bash
npm install
npm run typecheck
npm test
npm run build
```

The committed `dist/` must be rebuilt and committed with the source so the installed plugin and
the checkout agree.

## Install

From the checkout:

```bash
cd ~/Projects/opencode-plugins-creation/opencode-kanban-desktop
npm ci
```

`npm ci` installs the dependencies the committed bundle and the development commands need. It does
not build the GUI.

Add the plugin to the **global** `~/.config/opencode/opencode.json` (Desktop reads
`opencode.json`, not `cli.json`):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "/home/tayuha/Projects/opencode-plugins-creation/opencode-kanban-desktop",
      "options": {
        "pill": true
      }
    }
  ]
}
```

Use the **absolute path** to this checkout, and adjust it if the checkout lives elsewhere. The
`options.pill` value is optional; `false` hides the composer pill regardless of the stored setting.

Then:

1. Fully quit and reopen OpenCode Desktop.
2. Check **Settings → Extensions → Plugins**: `nmdra.kanban-desktop` should be listed and enabled,
   not "not loaded".
3. Run `opencode plugin list` in a terminal. It should show `nmdra.kanban-desktop` with source
   `local` and this checkout's path.

Do **not** also symlink the folder under `~/.config/opencode/plugins/`. Desktop would then see two
sources for the same plugin, and `opencode plugin list` will show duplicate entries. Keep one
installation method.

### Upgrade

From the configured checkout, quit Desktop first:

```bash
git fetch --tags
git checkout vX.Y.Z
npm ci
```

Reopen Desktop. The plugin path in `opencode.json` stays the same, and the board data persists in
plugin storage. See [`docs/upgrading.md`](docs/upgrading.md) for release, migration, notebook, and
rollback details.

For development, keep Vite rebuilding the bundle:

```bash
npm run dev
```

Every successful build reloads the GUI plugin in open Desktop windows.

## Quick start

1. Open or create an OpenCode session in a project.
2. Open the board from the command palette (**Kanban: open board**), with `mod+alt+k`, with
   `/kanban`, or from the session side region's **+** menu.
3. Press **New task**, choose a title, leave the branch blank to generate one, and keep
   **Create a git worktree** on for a git project.
4. Review the linked session that opens in the worktree with the prompt prefilled, or enable
   **Send the initial prompt automatically** in the task dialog to start the agent immediately.
5. Run the agent and watch the card's status, todos, subagents, and cost update.

The board is functional without git: turn the worktree switch off (or use a non-git project) and
the task works in the project root.

## Usage

| Surface | How to open |
|---|---|
| Side panel | Command palette → **Kanban: open board**, `mod+alt+k`, `/kanban`, or the session side region's **+** menu |
| Full board | Command palette → **Kanban: open full board**, `mod+alt+shift+k` |
| New task | `mod+alt+n`, the **+** in a column header, the panel's **+** button, or the empty state's **New task** |
| Composer pill | Above the composer while the routed project has active cards; click the pill to open the board, or click a running task in its menu |
| Reload board | The download icon in the panel header, or **Kanban: reload board from kanban-board.json** |
| Export board | The upload icon in the panel header, or **Kanban: export board to kanban-board.json** |
| Board file folder | The folder icon in the panel header; use the project root or choose another folder for this project |
| Tags | The Tags button in the panel header, or **Kanban: manage tags** |
| Columns | The Columns button in the panel header, or **Kanban: manage columns** |
| Compact columns | The collapse/expand button in the panel header, `C`, or **Kanban: toggle compact columns** |
| Help | The help button in the panel header, or **Kanban: help** |
| Settings | **Settings → Extensions → Kanban** (or search "kanban") |

The panel is the primary surface. It is 560px wide and can be widened by the app, or moved to the
bottom pane like any other side tab. The full board command renders the same workspace in a large
dialog and shares the same per-project board data and live state.

### The board

- **Columns are per project.** The selected project's board owns its columns. A new board starts
  with **Todo / In progress / Done**. Add, rename, recolor, reorder, and delete them from
  **Columns** or a column's menu. Deleting a column moves that project's tasks to its first
  remaining column; the last column cannot be deleted.
- **Compact columns** hide tags, branch/worktree lines, and card details so more columns fit in a
  narrow panel. Toggle with the collapse/expand button in the header, `C`, the palette, or
  **Settings → Kanban → Column density**. Cards stay draggable and keep their menu; scroll-mode
  columns cap at 220px.
- **Cards** show the title, branch, worktree name, live status (running / idle / no session), todo
  progress, running subagent count, and session-plus-subagent cost. Tags appear as chips.
- **Drag** a card onto another column or between cards to reorder. The arrow keys move the
  selection; **Shift + arrows** move the task itself.
- **Search** matches title, branch, project name, and notes, case-insensitively. It applies to the
  current view, including the archive. Escape clears it.
- **Archive** keeps finished cards out of the board but available to restore. Restoring puts the
  task back in its original column and position. The archive toast offers **Undo** for 8 seconds.
- **Delete** asks once for the task. If the task has a worktree, a second dialog asks whether to
  remove it; declining removes only the card. Keeping the worktree shows “worktree kept” and offers
  **Undo**; removing it shows “worktree removed” and is permanent. A task with no worktree —
  including every non-git project — always offers Undo. Session processes are never stopped.

The panel's chip shows the number of active tasks in the selected project, or the number currently
running. The archive view lists archived tasks; it does not have a separate count badge.

### Tags

Tags are customizable and **per project board**, like columns: a name and a color, created and
edited from **Tags** in the panel header (or the palette command). A new board starts with no tags;
v0.1.1 tags are split into their owning project during the one-time migration.

- Assign tags in the task dialog. Cards show up to three and a `+N` marker; the detail view and
  archive show all assigned tags.
- Click a tag on a card to toggle that tag in the filter.
- The filter row above the board and archive uses **AND** semantics: a task must have every
  selected tag. **Clear tags** resets the filter.
- Renaming, recoloring, or deleting a tag affects only the selected project. Deleting a tag
  removes it from that project's tasks and the active filter.
- Tags and assignments are stored in the board and travel with `kanban-board.json` on export and
  reload.
- Tags are ordered by creation; reordering tags and tag presets are follow-ups.

### Tasks, worktrees, and sessions

Creating a task asks for a project, title, branch, base branch, folder, column, notes, tags, and
an initial prompt. With **Create a git worktree** on (the default for git projects), the plugin
calls OpenCode's native worktree API and stores the returned directory. The branch is generated as
`feature/<adjective>-<noun>-NNN` when left empty; the **Generate** button replaces the field with
another generated name.

**Existing folder** is optional. Browse to or type an absolute folder and the task runs there
instead of the project root or a new worktree. The plugin never creates or removes that folder;
selecting it turns the worktree switch off. If the folder is a git repository, the dialog prefills
its current branch.

After creation:

- With **Open a session after creating** on (the default), a **linked session** opens in the task's
  directory (worktree, existing folder, or project root) with the initial prompt filled into its
  composer for review. The session is bound immediately, so the card and composer pill track it
  before the prompt is sent.
- With **Send the initial prompt automatically** on, the plugin creates the session, sends the
  prompt, and opens its tab without waiting for review.
- With both off, the card is created and nothing opens.

The dialog switches start from the saved settings but apply per task. Changing a setting does not
retroactively open or send anything for existing cards.

**Open** on a card (double-click, Enter, the card menu, or the detail view) follows the **Opening a
task** setting:

- **Reuse** focuses the task's linked or directory-matched session; if it has none, a session is
  created in its worktree, existing folder, or project root, then bound to the task.
- **Start a new session** always creates and binds a fresh session, leaving the old one in its tab.
- **Ask each time** shows the two choices when the task has a session binding; if it has none,
  Ask creates one.
- The card menu exposes **Open** (which still follows the setting) and **New session** (which
  always starts fresh). The detail view exposes **New session** when the task currently has a
  session.
- Reusing keeps the task's context and prompt cache warm; a new session starts clean.

A worktree-creation failure aborts before the card is written. A failure after the card is written
(for example, session creation with auto-prompt) leaves the card in place and reports the error.

### Linking a task to an open session

The card menu and the palette offer **Link to this session** and **Link session…**; the detail view
offers **Link session…**. The palette also offers **Unlink task session**.

- **Link to this session** binds the task to the session you are currently in, provided it is a
  root session in the same project and server.
- **Link session…** lists open session tabs in the task's project on the panel's server, with the
  current session first. Pending tabs and subagent sessions are excluded.
- A linked task tracks that session's status, todos, and cost, and **Open** focuses its tab.
- Several tasks can link to the same session to share one context window and prompt cache. The
  board sends one completion notification per session transition in a window.
- **Unlink session** removes the explicit link. A task with a worktree may still match a session by
  directory afterwards.
- Sessions from another project are refused or excluded; linking is per project.

The board binds a task to a root session in this order:

1. The explicitly stored `sessionID` is the task's **pin** and is authoritative. If that session is
   outside the current session page, the board loads it by ID. It never substitutes another
   worktree session when the pin is missing.
2. Only when a task has no stored ID, the newest root session in the task's worktree directory is
   used as a discovery fallback, preferring the task's project, then any project listing the same
   path. Opening the task with such a match pins it explicitly.
3. No session.

A session created manually in the worktree is discovered for an unpinned task on the next refresh;
opening the task turns that discovery into a persisted pin. Subagent sessions are not eligible as
the task's root session; they appear as descendants in the detail view.

### Live state

- **Status** comes from the desktop server's active-session set, refreshed on session events and a
  configurable safety poll. A failed read keeps the last good snapshot and marks it stale; the
  panel shows a Retry action.
- **Todos** come from the newest completed todo tool call in the session transcript. They are
  shown on cards and in the detail view; when no todo tool was used, progress is simply absent.
- **Subagents** are the descendants of the task's root session, with their own status, cost, and
  todo count when available.
- **Changes** in the detail view read VCS status for the task's worktree, existing folder, or
  project root, show
  the base branch, and list up to 60 files with additions and deletions.
- **Completion notifications** fire when a watched task's session goes from running to idle. They
  click through to the session and follow Desktop's notification settings.

The refresh loop is deliberately bounded: it reads up to 200 sessions per project, 100 recent
messages per session when looking for todos, and hydrates todos for the root plus up to five
running subagents, three sessions at a time. See [`docs/design.md`](docs/design.md) for the full
lifecycle and limits.

### Export and reload

Both actions operate on **the project selected in the panel's board**. The selected project also
chooses the folder, which defaults to its root.

- **Auto-export is on by default.** After column, tag, task, archive, undo, session-link, or
  move changes settle for 1.5 seconds, that project's live board is written to its
  `kanban-board.json` atomically. It is silent; failures show a toast. The previous file is copied
  to `kanban-board.json.bak` on each write, so `.bak` is the immediately previous snapshot. Disable
  it in **Settings → Extensions → Kanban → Auto-export this project's board**.
- **A missing project file is created when the project is selected.** With auto-export on, a
  project that has a board but no `kanban-board.json` gets one after the debounce. An existing file
  is left alone; use **Reload board** to import it.
- **Changing or resetting the board folder writes the current board to the new folder.** An
  existing file there is kept as `.bak`. The previous folder's file is left in place; delete it
  yourself if you no longer need it.
- **Export board** writes immediately and reports the path and backup path. It uses the project's
  board folder.
- **Auto-reload is on by default.** While a session is active, the plugin checks the selected
  project's `kanban-board.json` every two seconds. If the file changed externally and that project's
  live board has no unsaved changes, the board updates automatically. If you have unsaved live
  edits, it skips the external change and shows a conflict toast instead of overwriting your work.
  Disable it in **Settings → Extensions → Kanban → Auto-reload external changes**.
- **Reload board** remains available for an explicit import. Auto-export makes the live project
  board authoritative; an externally edited file is overwritten by the next board change unless it
  is reloaded or auto-reloaded first.
- **Reload board** reads the project's `kanban-board.json` and **replaces that project's board
  with the file**. If the board contains at least one task, Desktop asks for confirmation first and
  writes the live board to `kanban-board.backup.json` before reading. If that backup fails, the
  reload is cancelled. An empty board reloads without a confirmation or a new backup. A legacy
  whole-installation file is narrowed to the selected project; other folders' tasks are ignored.
- A missing, oversized, invalid-JSON, or wrong-shape file leaves the live board untouched and
  shows a toast. If a pre-reload backup was already written, it remains on disk.
- A task's current session binding is kept when the imported task has the same ID and does not name
  a session. If the file names one, the file wins. Live status is always derived from sessions; it
  is not stored in the file and is not "reset" by a reload except through changed bindings.
- Preferences are **not** in the board file. Columns, tags, tasks, positions, archive state, and
  tag assignments come from the file for that project only.

Because reload is a replacement of one project's board, **export before a valid reload**. A stale
seed file will remove cards, columns, tags, tag assignments, and archive state that are not in that
seed. Read [`docs/board-file.md`](docs/board-file.md) for the exact format, backup conditions,
recovery recipes, and caveats.

### Keyboard

These work while focus is inside the panel and not in a text field, search box, select, button, or
menu:

| Key | Action |
|---|---|
| `N` | New task |
| `E` | Edit the selected task |
| `A` | Archive the selected task |
| `V` | Toggle board / details |
| `Shift+V` | Open the archive |
| `Enter` | Open the selected task's session (following the open mode) |
| `/` | Focus search |
| Arrow keys | Move the selection |
| `Shift` + arrows | Move the task between columns or reorder it |
| `Esc` | Clear search, then selection |

The panel, full board, new task, help, and move commands also work from the palette. Unbound
commands include **Kanban: manage columns**, **Kanban: task details**, **Kanban: open archive**,
**Kanban: archive task**, **Kanban: open task session**, **Kanban: new session for task**,
**Kanban: link task to this session**, **Kanban: link task to an open session**, **Kanban: unlink
task session**, **Kanban: refresh**, **Kanban: export board to kanban-board.json**, **Kanban:
reload board from kanban-board.json**, **Kanban: search tasks**, **Kanban: help**, and **Kanban:
move task left/right/up/down**.

## Settings

| Setting | Default | Effect |
|---|---|---|
| Board alignment | Fit columns | Fit every column into the panel, or keep a fixed width and scroll sideways |
| Column density | Comfortable | Comfortable shows tags and card details; Compact hides them for one-line cards |
| Column width | Normal (280px) | Narrow (240), Normal (280), or Wide (340); used while the board scrolls |
| Default column | First column | Column a new task starts in; the first column is used if unset |
| Opening a task | Reuse | Reuse the task's session, start a new one, or ask each time |
| Open a session after creating | On | Initial state of the task-dialog switch; creates and links a session in the task directory with the prompt prefilled |
| Send the initial prompt | Off | Initial state of the task-dialog switch; creates the session and sends the prompt immediately |
| Default initial prompt | Empty | Prefills new task dialogs and the detail view's **Start agent** action; remembered for the next task |
| Refresh interval | 15 s | Safety poll on top of session events: Off, 5, 15, 30, or 60 seconds; changes apply immediately |
| Auto-export board | On | Write this project's changes to its `kanban-board.json` automatically; Reload stays manual |
| Auto-reload external changes | On | Apply external edits to this project's `kanban-board.json` every two seconds; skipped when the live board has unsaved changes |
| Completion notifications | On | Notify when a watched task's session goes from running to idle |
| Composer pill | On | Show the routed project's task/running status above the composer |
| Reset board data | — | Delete every task and every per-project tag and column set; restore the three default columns in each board. Worktrees, sessions, and preferences stay |

`options.pill: false` in the plugin's `opencode.json` entry hides the composer pill regardless of
the stored setting. The board still runs; only the pill is hidden.

`Reset board data` is a global reset, not a per-project delete. It deletes every task and
every project's tag and column sets, then restores **Todo / In progress / Done** in each board. It
does not remove worktrees, stop sessions, or change settings. If the saved default column is missing
from a project, new tasks fall back to that project's first column.

## Storage and scope

Every project folder owns its own board. Boards are keyed by the canonical project folder, so two
OpenCode project records for the same directory share one board instead of leaking cards into each
other. A board contains its own columns, tags, assignments, archive state, and tasks; preferences
are separate. Boards and preferences live in Desktop's plugin storage with `Store.global`, under
the plugin's own namespace. They are local to this installation and are **not** shared with the
Rust TUI's SQLite databases. Worktrees, branches, and sessions stay on disk/server; the plugin only
remembers their identifiers and paths.

On this Linux installation, Desktop's plugin storage is backed by
`~/.config/ai.opencode.desktop/drafts.sqlite`. In this build, the board map and preferences are
`state` rows named `opencode.global.dat` / `plugin.nmdra.kanban-desktop.boards` and
`plugin.nmdra.kanban-desktop.prefs`. The older `plugin.nmdra.kanban-desktop.board` row is read once
during the upgrade and then kept empty. Treat the database as the authoritative copy until you
export a project. The board file in a project's board folder is an explicit snapshot you create.

The project switcher in the panel header shows another project's entire board without leaving the
session, including that project's columns and tags. Switching projects swaps the board; it does not
merge or filter another project's cards into the current one. The switcher can only show projects
that the current Desktop installation knows about. Tasks record the `serverID` that owns them;
legacy tasks without one are claimed by the first server that opens a board knowing their project.
The local Desktop server is `sidecar`, so a single-server board legitimately has `sidecar` on every
task.

Each project's board file defaults to `<projectRoot>/kanban-board.json`. The folder icon in the
panel header lets you choose a different folder for that project; the choice is stored per project
folder. The RPC still writes only the fixed filenames (`kanban-board.json`,
`kanban-board.json.bak`, and `kanban-board.backup.json`) into the chosen folder. Use a distinct
folder per project; choosing one folder for several projects makes them share one file.

## Security and privacy

- **No shell.** Worktrees use `client.worktree.create/remove`; there is no `child_process`, no
  `git` invocation, and no command string assembled by the plugin.
- **No process killing.** Deleting or archiving a task never stops a session or an agent.
- **No direct network egress.** The plugin talks only to the local OpenCode server through the SDK
  client. It has no `fetch`, WebSocket, telemetry, or external URL of its own.
- **Bounded writes.** It creates and removes worktrees, creates and prompts sessions, opens tabs,
  writes its own plugin storage, copies explicit text to the clipboard, reveals folders, and writes
  the fixed board filenames. Nothing else.
- **Board file RPC.** `nmdra.kanban-desktop.board.load` reads `<folder>/kanban-board.json`;
  `save` writes that file and its `.bak`, or `kanban-board.backup.json` for a pre-reload backup.
  `<folder>` is the project root unless the user chose a board folder for that project. Fixed
  filenames, atomic writes, a 5,000,000-byte cap, and no directory listings. The RPC trusts
  the absolute directory supplied by its caller; the GUI passes the selected project's board folder.
- **Destructive actions ask first.** Deleting a task, deleting a column or tag, removing a
  worktree, and resetting the board use the app's confirm dialogs. A dirty worktree needs a second
  explicit confirmation before a forced removal.
- **Board files are sensitive.** They contain task titles, notes, branches, worktree and existing
  folder paths, and session IDs. Exporting writes them into the project's board folder; decide
  whether to commit, ignore, or delete the file. Reload treats the file as untrusted input and
  validates/normalizes it, but a hand-edited `worktreePath` is still data that can be sent to the
  worktree API during deletion; an existing `directory` is never removed.

See [`SECURITY.md`](SECURITY.md) for the reporting process, trust boundaries, and the full
permission list.

## Limitations

- **Desktop only.** The TUI does not load GUI plugin parts, and the plugin needs the desktop's
  worktree/session APIs.
- **A board file is one project.** Export writes only the selected project's cards, columns, and
  tags. Reload scopes the file to that project and ignores tasks for other folders, including a
  legacy whole-installation snapshot.
- **Upgrading from v0.1.1 splits the old global board once.** The split uses each task's project
  folder. Tasks whose stored `projectRoot` is missing stay addressable by project id but cannot be
  exported until a folder is known.
- **Reload is a replacement, not a merge.** Only a missing `sessionID` is carried over for an
  imported task with the same ID. Everything else comes from the file.
- **Foreign project or server IDs.** Moving a board file to an installation with different OpenCode
  project or server IDs can leave tasks stored but unreachable in the project switcher.
- **Pinned sessions and deletion.** An archived pinned session stays linked and shows idle. If the
  server confirms a pinned session was deleted, the board clears the pin after the next refresh and
  shows a toast; **New session** or **Link session…** can attach another one.
- **No branch deletion.** The public worktree API removes a worktree, not its branch. Delete the
  branch with git after removing the worktree.
- **Existing folders are never removed.** A task can run in a chosen folder, but deleting the task
  does not delete that folder; only a plugin-created worktree can be removed.
- **No tag reordering.** This is a follow-up. Columns and tags are per project; reordering is not
  yet exposed. Undo is a short-lived toast, not a persistent history, and worktree removal is
  permanent.
- **Todo data is best effort.** OpenCode's todo tool is experimental; without a todo tool call
  there is nothing to show.
- **Bounded live data.** The board reads a recent page of sessions and messages, hydrates todos for
  a limited set of sessions, and renders the first 60 changed files.
- **Notifications are scoped to watched projects.** A project is watched while a Kanban panel or
  full board is open on it, or while it is the routed project and the pill or notifications are
  enabled. Background projects do not poll and do not notify.
- **Platform coverage.** Linux is the exercised platform. Windows path normalization is unit
  tested, but Desktop behavior on macOS and Windows is not yet verified.
- **Experimental GUI API.** A Desktop update can change the API; re-pin and rebuild.

## Troubleshooting

See [`docs/troubleshooting.md`](docs/troubleshooting.md) for symptom-driven checks: plugin not
listed, empty board, reload mistakes, worktree failures, missing status or todos, missing
notifications/pill, and where the data lives.

Two common cases:

- **The plugin is not listed.** Confirm the absolute checkout path is in the global
  `opencode.json`, run `npm ci`, fully quit Desktop, and check `opencode plugin list`. Remove any
  duplicate symlink under `~/.config/opencode/plugins/`.
- **A reload replaced the wrong board.** If the board had tasks, look for
  `kanban-board.backup.json` in the project you reloaded from. Copy it aside first, then use it as
  `kanban-board.json` and reload. See the recovery section in
  [`docs/board-file.md`](docs/board-file.md).

## Development

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest: 135 cases
npm run build       # dist/gui-experimental.cjs
npm run dev         # vite build --watch
npm run coverage    # optional coverage run
```

Layout:

```
src/index.ts                  server part: declares the plugin id and board-file RPC
src/gui.tsx                   ./gui-experimental entry
src/gui/definition.ts         stores, i18n
src/gui/window.tsx            panel, commands, menu, pill, settings, notifications
src/gui/panel.tsx             workspace shell: project, views, keyboard
src/rpc.ts                    board file load/save RPC contract
src/server/board-file.ts      reads/writes <project>/kanban-board{.json,.json.bak,.backup.json}
src/gui/style.ts              scoped CSS
src/gui/api.ts                services contract between the shell and components
src/gui/model/                pure task, status, todo, project, select, branch logic
src/gui/data/live.ts          event + poll registry, status and todo caching
src/gui/data/actions.ts       worktree, branch, VCS, session helpers
src/gui/components/           board, detail, archive, help, task/columns/tags dialogs
```

The build must stay one CommonJS file that requires only `effect`, `@opencode/plugin/gui`,
`@opencode/plugin/rpc`, `solid-js`, and `solid-js/web`.

Verify a change end to end:

```bash
npm run typecheck
npm test
npm run build
grep -oE 'require\("[^"]+"\)' dist/gui-experimental.cjs | sort -u
opencode plugin list
```

The bundle check should print exactly those five module names. `opencode plugin list` should show
`nmdra.kanban-desktop` with source `local` and this checkout's path.

The automated suite is split across `model/board` (36), `model/status` (10), `model/todo` (8),
`model/projects` (8), `model/select` (6), `data/live` (3), `server/board-file` (9), `definition`
(3), and `format` (7). CI runs `npm ci`, typecheck, tests, build, a committed-`dist` diff check,
and `npm audit --audit-level=high`.

## Documentation

- [`AGENTS.md`](AGENTS.md) — instructions for AI agents: setup, upgrades, data, and release rules
- [`docs/design.md`](docs/design.md) — architecture, data model, lifecycle, failure handling, and the TUI mapping
- [`docs/board-file.md`](docs/board-file.md) — `kanban-board.json` format, export/reload semantics, backup and recovery
- [`docs/upgrading.md`](docs/upgrading.md) — release process, upgrades, data migration, and rollback
- [`CHANGELOG.md`](CHANGELOG.md) — version history
- [`docs/troubleshooting.md`](docs/troubleshooting.md) — symptom-driven fixes and data locations
- [`docs/release-checklist.md`](docs/release-checklist.md) — the ordered v0.1.1 release runbook
- [`docs/test-plan.md`](docs/test-plan.md) — automated cases and the manual Desktop plan
- [`docs/acceptance-checklist.md`](docs/acceptance-checklist.md) — the detailed acceptance matrix
- [`TODO.md`](TODO.md) — the release backlog and P0/P1 work
- [`SECURITY.md`](SECURITY.md) — reporting, trust boundaries, and permission scope

## Attribution

The task/category model, worktree-per-task workflow, branch generation, archive and detail views,
and the overall board interaction derive from
[`TomCC7/opencode-kanban`](https://github.com/TomCC7/opencode-kanban), MIT licensed. The desktop
implementation, data flow, UI, and tests are new work.

The GUI package conventions (Split `definition`/`window`/`panel`, scoped styles, store and command
patterns) follow the author's `opencode-cache-stats-gui`.

## License

MIT. See [`LICENSE`](LICENSE).
