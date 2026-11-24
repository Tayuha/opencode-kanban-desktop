# Design

## Goals

1. Bring the `opencode-kanban` workflow to OpenCode Desktop without tmux.
2. Make each task a real git worktree and a real OpenCode session, not a simulated card.
3. Keep the board keyboard-first and dense enough for a side panel.
4. Never run a shell, kill a process, or hide a destructive action.

## Non-goals

- Sharing the Rust TUI's SQLite databases, or importing/exporting them. The only interchange format
  is the JSON snapshot described in [`board-file.md`](board-file.md).
- Managing arbitrary folders that are not OpenCode projects.
- Launching external terminals or custom themes.
- A network service, a second server, or any external API.
- Reimplementing git. All worktree operations use the OpenCode API.

## Mapping from the TUI

| opencode-kanban (TUI) | opencode-kanban-desktop |
|---|---|
| Per-project SQLite file | One `Store.global` board map, keyed by canonical project folder |
| Repository registry | OpenCode projects (`data.project.list`, `session.project`) |
| `git worktree add/remove` | `client.worktree.create/remove/refresh`; 2.3.2 creates a detached worktree from an existing ref |
| tmux session per task | OpenCode session in the worktree directory |
| tmux attach | `ctx.tabs.open` for an existing session; session create + composer prefill for a new task |
| `tmux_status` polling | `client.session.active()` + `session.*` events + a safety poll |
| `/session/{id}/todo` | Newest completed todo tool call in `client.message.list`, parsed locally |
| Subagent summaries | `parentID` descendants with their own status, cost, and todos |
| tmux/system notifications | `ctx.attention.notify`, click-through to the session |
| Command palette | GUI `Command`s, keybinds, and `/kanban` |
| Themes | Desktop's theme; no custom theme file |
| Terminal launcher | Session tabs and `ctx.desktop.reveal` |
| Archive / detail / split | Archive view and detail view in the panel |
| Project switch | Project select in the panel header |

## Package shape

```
opencode-kanban-desktop
├── server part  src/index.ts          plugin id "nmdra.kanban-desktop" + board-file RPC
│                src/rpc.ts            board file load/save contract
│                src/server/board-file.ts
└── GUI part     src/gui.tsx           ./gui-experimental -> dist/gui-experimental.cjs
```

The server part owns **no board state**. It exists so the plugin id is explicit instead of relying
on the package-name fallback, and so the GUI can read and write the fixed board-filename snapshot
through the local server. Board state, preferences, and all UI behavior live in the GUI process.

The GUI bundle is built by Vite with the `gui()` preset. It must stay one CommonJS file that
requires only `effect`, `@opencode/plugin/gui`, `@opencode/plugin/rpc`, `solid-js`, and
`solid-js/web`.

## Layering

```
window.tsx        registrations, services, dialogs, notifications, settings
  panel.tsx       workspace shell: project, search, tags filter, views, keyboard
    components/   board, detail, archive, help, task/columns/tags dialogs
  data/live.ts    event + poll registry, status and todo caching
  data/actions.ts worktree/branch/VCS/session calls
  model/*         pure, tested logic (board, status, todo, projects, select)
  format.ts       pure display formatting
```

Dependency direction is downward: components call services, services call actions/model, and the
model never imports the SDK or Solid. The split mirrors `opencode-cache-stats-gui`:

- `definition.ts` declares stores and copy.
- `window.tsx` registers contributions and owns the services object.
- `panel.tsx` is the mounted shell.
- `model/` is SDK-free and unit tested.
- `data/live.ts` is a registry with single-flight refreshes, debounce, polling, and last-good
  snapshots.

## Data model

```ts
type BoardMap = Readonly<Record<string, Board>>   // key: canonical project folder

type Board = {
  version: number              // 1
  tags?: readonly Tag[]        // this project's tags
  tagsByProject?: Readonly<Record<string, readonly Tag[]>>   // accepted from legacy files
  categories: readonly Category[]  // this project's columns
  categoriesByProject?: Readonly<Record<string, readonly Category[]>>  // accepted from legacy files
  tasks: readonly Task[]
}

type Category = { id; name; color; position }
type Tag = { id; name; color }

type Task = {
  id
  title
  projectID; projectRoot; projectName
  serverID?                    // omitted on legacy tasks
  branch; baseBranch?
  worktreePath?
  directory?                   // legacy task folder; never removed by the plugin
  categoryID; position
  tagIDs?
  sessionID?
  notes?
  createdAt; updatedAt
  archived; archivedAt?
}
```

Positions are per category in a project's board. Every mutation renumbers the affected groups, so
the stored order is always contiguous and stable. A task's array order is never relied on; the
position/`createdAt` pair breaks ties.

The board map is keyed by the canonical project folder, not by OpenCode's project id. Two project
records for the same folder (for example `global` and a hashed id) therefore share one board and
cannot leak cards into each other. `model/boards.ts` owns the keying, lookup, migration, project
scoping. A missing board is the normal default board with **Todo / In progress / Done** columns
and no tags.

Each project board normally stores its tags in `tags` and its columns in `categories`. The
`tagsByProject` and `categoriesByProject` fields remain in the type and normalizer so a legacy
v0.1.1 whole-installation board and old snapshot files still load. Migration groups tasks by
`projectRoot`, gives each group its project's columns and tags, and writes one board per folder.
`scopeBoardToProject` performs the same narrowing for reload and auto-reload, so a legacy file
cannot reintroduce another project's cards.

Tasks also record the OpenCode `serverID` that owns them. New tasks take it from the mounted
session. A legacy task without one is visible on any server listing its project and is claimed by
the first server that opens a board knowing that project, or that binds its session. The local
Desktop server id is `sidecar`; additional servers use their own ids. The board view, archive,
pill, live registry, and selection all filter by server plus project, so two servers that expose
the same project ID do not mix cards or sessions.

`normalizeBoard` repairs hand-edited or old data on startup: duplicate IDs, missing categories,
orphan tasks, invalid positions, blank required strings, duplicate tags, invalid tag colors, and
task tag IDs that reference a missing tag. It also ensures at least one column in each set,
drops empty project column sets, preserves intentionally empty tag sets, validates every task
against its project's columns and tags, and renumbers positions. `tags`, `tagsByProject`,
`tagIDs`, and `categoriesByProject` are optional, so older boards and `kanban-board.json` files
still load.

Tags are per project board. Deleting one strips its ID from that project's tasks only. The tag
filter uses AND semantics: a task must have every selected tag. Up to three tags render on a card,
with a `+N` marker; clicking a card tag toggles it in the filter. The tag picker in the task dialog
only offers the selected project's tags.

### Preferences

```ts
type Prefs = {
  view: "board" | "detail" | "archive" | "help"
  alignment: "fit" | "scroll"
  columnWidth: number          // 240, 280, or 340
  density?: "comfortable" | "compact"  // absent means comfortable
  pollMs: number               // 0, 5000, 15000, 30000, 60000
  autoExport?: boolean         // absent means on
  autoReload?: boolean         // absent means on
  notify: boolean
  pill: boolean
  openMode?: "reuse" | "new" | "ask"   // absent means reuse
  defaultCategoryID?
  openOnCreate: boolean
  autoPrompt: boolean
  initialPrompt: string
  lastProjectID?
  lastBoardKey?                // canonical folder key last shown in the panel
}
```

The `boards` map and preferences use `Store.global`, so they follow the user across windows in one
Desktop installation. The deprecated `board` store is only read during the one-time v0.1.1
migration.

### State ownership

| State | Owner | Persisted? |
|---|---|---|
| Every project's tasks, columns, tags, assignments, archive flags | GUI `Store.global` `boards` map | Yes, in Desktop plugin storage |
| Preferences | GUI `Store.global` prefs | Yes, in Desktop plugin storage |
| Live status, session titles, cost, todos, subagents | Live registry, derived from server data | No; recomputed |
| Sessions, messages, worktrees, VCS status | OpenCode server | Yes, outside the plugin |
| Each project's `kanban-board.json` and its backups | Project root, written only by explicit actions/RPC | Yes, as files |
| Tabs, notifications, clipboard, reveal | Desktop app | Outside the plugin |

## Lifecycle

### Plugin setup

`setup` runs once per window:

1. Normalizes the legacy `board` store and, when the `boards` map is empty, splits it by project
   folder. Then empties the legacy store.
2. Normalizes every per-project board and writes back only the ones that changed.
3. Creates one live registry with a 400ms event debounce and the current `pollMs` getter.
4. Builds the services object used by both the panel and the full-board dialog.
5. Registers the panel, commands, session menu item, style, settings page, composer pill, and the
   routed-project watcher.
6. On teardown, disposes the live registry and clears auto-export/reload timers.

Normalization runs at setup, not on every render. A board imported by reload is normalized and
project-scoped explicitly before it is written to the map.

### Panel mount and project selection

Each panel instance keeps a local project selection and a local search/tag filter:

- The initial project is the full-board dialog's project if provided, otherwise the routed
  session's project, otherwise `lastProjectID`.
- When the routed session changes, the panel follows that session's project.
- When the project list arrives, a missing or stale selection falls back to the routed project or
  the first project.
- Changing the project persists `lastProjectID` and `lastBoardKey` and clears a selection that
  belongs to another project's board.
- The panel calls `project.sync()` once on mount so a newly opened project can appear.
- It watches `(server, project)` through the live registry. Changing server, project, or the
  session's pending state tears down the old watch and starts a new one.
- A change to any task's ID, `sessionID`, `worktreePath`, or archived flag invalidates live state.
- Tag IDs are pruned from the active filter when a tag is deleted.
- In the detail view, if the selected task disappears, the first visible task is selected.

The full-board dialog uses the same `BoardWorkspace` component and the same services. It has its
own watch and local filters, but shares the per-project board map and preferences.

### Live registry lifecycle

`createLiveBoard` keeps one entry per `(serverID, projectID)`:

- `watch(target, listener)` creates the entry, subscribes to server events, starts the poll, and
  immediately emits the current snapshot. The first watch triggers a refresh.
- The target's `client` and `data` are getters, so a restarted server is picked up under the same
  server ID.
- When the last listener stops, the entry aborts its request, clears timers, deletes itself, and
  removes the server subscription if no other entry uses that server.
- `dispose()` tears down every entry and subscription.
- `invalidate` schedules a refresh; with no server/project filter it invalidates every entry.
- `applyPoll` restarts every poll interval after the preference changes.

## Flows

### Create a task

1. The dialog loads the project list (live projects plus the routed project) and, when the project
   changes, calls `vcs.get`, `vcs.base`, and `vcs.branch.list` through `listBranches`.
2. If the directory is not a git repository, the worktree switch is disabled and
   `makeWorktree` is false.
3. Validation checks the project, column, title-or-branch, git branch syntax, and duplicate
   branch labels in the same project. Auto-prompt also requires a prompt.
4. With worktrees on:
   `client.worktree.create({ projectID, name: branchLabel, branch: baseRef })`. OpenCode 2.3.2
   runs `git worktree add --detach`; `branch` is the ref to detach at, `name` labels the directory,
   and the API never creates a branch.
5. `worktree.refresh` updates the app's project data. A refresh failure is ignored because the
   worktree was already created.
6. The task is written to its project's board with the returned directory, and live state is
   invalidated.
7. Then:
   - auto-prompt: `startAgent` creates the session, sends the prompt, syncs it into the app's data
     store, binds it to the task, opens its tab, and invalidates live state;
   - otherwise, if **Open a session** is on: create the session with `startSession`, bind it to the
     task, open its tab, and prefill the composer with the dialog prompt or the
     saved default prompt;
   - otherwise nothing opens.

A worktree failure aborts before the task is written, so there is no half-created card. A session
or prompt failure after the card is written leaves the card in place and reports a toast. The
branch suggestion is random (`feature/<adjective>-<noun>-NNN`), not derived from the title; it is a
worktree label until the user creates the git branch inside the worktree.

### Bind a task to a session

`matchTaskSession` runs on every refresh:

1. If `task.sessionID` names a root session, use it. The pin is authoritative: if the session is
   outside the current session page, the live registry fetches it by ID; if it cannot be loaded,
   the task has no session. A missing pin never falls back to a different worktree session.
2. Else, only for a task with no stored ID, find root sessions whose `location.directory` equals
   `task.worktreePath`, preferring the task's project, then any project listing the same path,
   newest first. This discovery fallback keeps manually created sessions attached; opening the task
   pins the match explicitly.
3. Else the task has no session.

The lookup compares normalized paths (trailing slashes, Windows separators, drive-letter case), so
a worktree created with a different separator still matches. Subagent sessions are never roots.

An archived pinned session stays linked and reports idle. When `session.get` confirms a pinned
session was deleted, the live registry notifies the board and the pin is cleared; a toast explains
why. Ambiguous failures (offline server, timeouts) do not clear the pin. Until then, `openTask`
prefers the stored pin over any live match.

### Live refresh

`createLiveBoard` runs one refresh per `(server, project)` entry:

- `session.list({ project, limit: 200, archived: false })` and `session.active()` in parallel;
- task lookups for live state and pinned sessions filter by `serverID` (legacy tasks are included);
- pinned session IDs missing from that page are fetched with `session.get`, with a 60s retry
  backoff for deleted sessions;
- if the project-filtered list is empty, a server-wide `session.list({ limit: 200, archived: false })`
  fallback for older servers that ignore the project filter;
- the returned sessions are filtered to the project or to a directory used by one of the project's
  task worktrees, and archived sessions are excluded;
- `sessionRows` maps them to plain rows; `deriveLive` matches each task, walks descendants, and
  sums root + subagent cost;
- single-flight requests, with a dirty flag for changes that arrive mid-flight;
- event subscriptions (`session.created`, `deleted`, `moved`, `archived`, `unarchived`, `status`,
  `execution.*`, `worktree.updated`) debounced at 400ms by the setup;
- a safety poll from settings (default 15s, can be off; changing it applies immediately);
- on failure, keep the last tasks and mark the snapshot `stale` with the error; the panel shows
  the last good cards and a Retry action;
- on a running → idle transition, call the transition callback once per task; the setup's callback
  sends `ctx.attention.notify` when notifications are on.

Notification dedupe is per window/setup: the key is `sessionID:sessionUpdated`, so several tasks
linked to one session produce one notification in that window. The set is cleared when it grows
past 200 entries. The notification also carries a stable `id` for the app's own dedupe.

Todo lists are hydrated after the status snapshot. The registry fetches the root session plus up to
five **running** subagents per task, three sessions at a time, with `message.list` (limit 100,
descending). Results are cached for 60s, or 30s for an empty result. A failed fetch keeps the
previous cached summary. A second emit updates cards after any todo cache miss.

### Manage tags

The Tags dialog adds, renames, recolors, and deletes the selected project's tags. The task dialog
edits a task's `tagIDs` with selectable chips and can open the Tags dialog on top. Deleting a tag
rewrites that project's task `tagIDs`; the workspace prunes deleted IDs from the active filter and
clears the tag filter when the project changes. Tags are not reorderable yet.

### Link a task to an open session

`linkTaskToCurrent` binds the task's `sessionID` to the routed session. `bindTaskSession` checks
that the session is known to the app's data store, is a root session, belongs to the task's
project, and differs from the current binding; it then persists the link and invalidates live
state.

`linkTaskSession` lists `ctx.sessions.current()` plus `ctx.sessions.list()`, filtered to the panel's
server, the task's project, root sessions, and non-pending tabs. The routed session sorts first,
then title. Picking one calls the same bind path.

`unlinkTaskSession` clears the link. A worktree task may then auto-match the newest session in its
directory again. Several tasks may point at the same session, so they share its context window,
prompt cache, todos, and cost.

### Export and reload

**Auto-export** runs per project board. After one project's board changes settle for 1.5 seconds,
the plugin serializes that board and calls `save({ directory: project.root, json })` silently. When
a project with a board is selected and no file exists, the same path creates it; an existing file
is only read as a baseline. Each project keeps its own debounce, destination, and last-written
snapshot, so switching projects does not export the wrong board. It never runs while the preference
is off. A failure shows one toast per distinct error until a later write succeeds. Manual **Export
board** uses the same save path immediately and reports the file and backup paths. Both keep the
previous file as `kanban-board.json.bak`.

**Auto-reload** polls the selected project's board file every two seconds while a session is
active. The first successful read for a project establishes a baseline without replacing the
board. Later reads that differ from the last seen file are applied only when that project's live
board matches its last exported/reloaded state; otherwise the plugin skips the external change and
shows one conflict toast. A successful apply parses the file, scopes it to the project, normalizes
it, merges session bindings, replaces only that project's board, and invalidates live state. It
does not auto-export the result back.

Reload calls `load({ directory: project.root })` explicitly. Auto-export makes the live project
board authoritative; an externally edited file is overwritten on the next board change unless it
is reloaded or auto-reloaded first.

Reload is a **project replacement**:

1. If that project's live board has any task, confirm.
2. After confirmation, write that project's live board to `kanban-board.backup.json` with
   `save({ target: "backup" })`. A failure cancels the reload.
3. Read and parse the file, check `isBoardLike`, normalize it, then scope it to the project folder
   (or project id for a root-less legacy task).
4. `mergeSessionBindings(imported, current)`.
5. Replace only that project's board and invalidate live state.

The only merge is session binding preservation: an imported task with the same task ID and no
`sessionID` keeps the live task's binding. Everything else comes from the file. Other projects'
boards and preferences are untouched. Live status is derived, never stored. The file contains only
the reloaded project's cards; tasks for other folders in a legacy file are ignored.

The backup is written only when the project's board has at least one task (archived included), the
user confirms, and the write succeeds. An empty board reloads without a confirmation or a new
backup. See [`board-file.md`](board-file.md) for exact guarantees, recovery, and trust boundaries.

### Open a task

The **Opening a task** preference has three modes:

- **Reuse** (default): if the task has a linked or matched session, `data.session.sync(id)` then
  `ctx.tabs.open({ server, id }, { focus: true })`. Otherwise create a session in the task's
  worktree (or project root), bind it, and open it.
- **New**: always create and bind a fresh session. The previous session stays in its tab.
- **Ask**: when a stored or live-matched session ID is present, `ctx.dialogs.select` offers
  **Reuse** or **New session**; when none exists, it creates one without asking.

The card menu exposes **Open** (still subject to the setting) and **New session** (always fresh).
The detail view exposes **New session** when a session is currently present. The new-session path
gives a clean context; reuse preserves the prompt cache and context window.

`startAgent` is a separate path used by **Start agent** and auto-prompt. It creates a session,
sends a non-empty prompt, syncs the session, binds it, and opens its tab. A prompt-send error still
leaves the session bound and open and reports a toast.

### Archive and delete

- Archive flips `archived` and keeps the position; restore flips it back. Archive invalidates live
  state and clears the selection when the archived task was selected; restore invalidates live
  state. The archive toast offers **Undo** for eight seconds.
- Delete removes the task and renumbers its column. Without worktree removal, the toast offers
  **Undo**, which re-inserts the task snapshot at its old position, clamping to the current column
  and filtering tags that have since been deleted. If the worktree was removed, no undo is offered.
- A task with an existing `directory` is never treated as a managed worktree. The delete flow does
  not offer worktree removal and never deletes that folder; it behaves like a plain card delete.
- Delete from the board opens one choice dialog when the task has a worktree: keep it or remove
  it with the card. Keeping removes only the card and leaves the worktree.
- Worktree removal first tries `force: false`. If that fails, a second confirmation offers a
  forced removal and shows the server error. Declining the force confirmation aborts the delete,
  leaving both the worktree and the task.
- The archive menu offers **Delete forever** and, for a worktree task, **Delete forever ·
  Worktree**. The worktree variant goes through the same removal/force path.
- Sessions are never stopped. Branch deletion is not exposed by the API and is documented as a
  manual git step.

## UI decisions

- **Side panel is primary.** The GUI SDK contributes panels, commands, menus, composer pills,
  settings pages, styles, and dialogs, but no full route. A 560px panel with `wide: true` is usable
  for three columns; the full board command reuses the same workspace in an `x-large` dialog.
- **Columns are per project.** Each project board owns its set. A new board starts from **Todo /
  In progress / Done**. Tasks remain in their board, and a column from one project is never a valid
  target for another project's task.
- **Board files are per project.** The file is `<projectRoot>/kanban-board.json`. A reload scopes
  the file to the project, so a legacy whole-installation snapshot cannot add another project's
  cards.
- **Compact density is a reading mode.** It keeps the same board DOM and interactions but hides tags,
  branch/worktree lines, and card details, clamps cards to one line, and caps scroll-mode columns at
  220px. The toggle lives in the panel header, the `C` key, the palette, and settings.
- **Folder selection is gone.** Tasks run in a worktree or the project root. Legacy tasks with a
  stored folder still open there; the new-task dialog has no folder picker. This avoids a nested
  OpenCode project silently switching the panel to another board.
- **Detail replaces the board instead of splitting.** A split view in a 560px panel leaves two
  unusable halves. The detail view keeps a back control and the same keyboard flow.
- **Drag and drop plus keyboard.** Mouse users drag; keyboard users use Shift+arrows and palette
  commands.
- **No custom theme.** The plugin uses `currentColor`, `color-mix`, and the app's light/dark mode,
  so it follows every Desktop theme.
- **No custom icon.** `Declarations.icons` is not in the 2.3.2 SDK; the board uses the app's `task`
  icon.
- **Search and tags are separate.** Search matches text fields; tags use an AND filter. Neither
  changes the stored board.
- **Project switcher dedupes by folder.** OpenCode can expose two project IDs for one worktree
  (for example a `global` record and a hashed record). The switcher keeps one row per canonical
  folder, and the routed project ID replaces the duplicate row.

## Failure handling

| Failure | Behavior |
|---|---|
| Server offline | Stale snapshot, Retry action, last good cards |
| Project session list empty | Fall back to a server-wide page; if still empty, show the project with no sessions |
| Worktree create rejects | Dialog shows the server message; no task is written |
| Worktree refresh fails after create/remove | Ignored; the worktree operation already succeeded |
| Worktree removal rejects | Offer forced removal with the error; declining aborts deletion |
| Session create fails after card creation | Card remains; toast reports the error |
| Prompt send fails | Session is still created, bound, and opened; toast reports the prompt error |
| Non-git project | Worktree switch disabled; tasks work in the project root |
| Todo fetch fails | Previous cached summary stays; otherwise progress is absent |
| VCS read fails | Detail view shows the changes error; the rest of the card works |
| Session not known to the app | `data.session.sync` before opening the tab; a failure is ignored because the event stream may catch up |
| Stored session was deleted | The pin is cleared after a confirmed not-found; a toast explains; Link/New session can attach another |
| Auto-export fails | A single toast per distinct error; that project's live board stays intact and a later change retries |
| External file changes with unsaved live edits | Auto-reload skips and shows a conflict toast; that project's board is untouched |
| Project list not loaded | The routed session's project is merged in as a fallback |
| Old/invalid board data at startup | Legacy data is split once, then `normalizeBoard` repairs each project; normalization is not a schema migration |
| Reload file contains other projects | Tasks for other folders are ignored; only the selected project's board changes |
| Reload file missing/invalid | Toast; the current project board is untouched |
| Pre-reload backup fails | Reload is cancelled; the current project board is untouched |
| Export `.bak` copy fails | Export is cancelled; the existing board file is untouched |
| Board RPC unavailable | Toast asking for a Desktop restart |

## Performance and limits

- One live entry per server/project; entries stop when their last listener unmounts.
- 200 sessions per project per refresh, with one server-wide fallback page.
- 100 recent messages per session for todo parsing; up to 200 todo items are parsed per call.
- Todos for the root plus up to five running subagents; three sessions per batch; 60s/30s cache.
- 60 changed files rendered in the detail view; the totals still include all files.
- 5,000,000-byte board file cap; no streaming.
- Event debounce 400ms; poll options 0/5/15/30/60 seconds.
- Notification dedupe set capped at 200 entries per window.

## Testing

The documented v0.1.2 suite has 136 vitest cases:

| File | Cases | Focus |
|---|---:|---|
| `model/board.test.ts` | 60 | defaults, create/update/move/archive/delete/undo, task directories, per-project columns and tags, server ids and claiming, normalization, duplicate branches/counts, colors, session merge, shape check, branch generation |
| `model/status.test.ts` | 12 | path normalization, session rows, pinned vs discovery matching, existing-folder matching, descendants, live derivation, status/transition helpers |
| `model/todo.test.ts` | 8 | todo normalization, newest tool call, metadata/text fallbacks, percentage |
| `model/projects.test.ts` | 10 | names, sort/dedupe, same-folder ids, routed fallback, lookups |
| `model/boards.test.ts` | 10 | project keys, lookup/write immutability, migration split, project scoping |
| `model/select.test.ts` | 7 | text/tag filters, server scope, column/archive selection, neighbours, status keys |
| `data/actions.test.ts` | 2 | worktree payload: base ref, sanitized name, blank fallbacks |
| `data/live.test.ts` | 8 | derived live state, server-scoped tasks, pinned-session hydration, archived pins, deleted-pin reporting, missing-pin isolation, running→idle callback, stale fallback with a fake client |
| `server/board-file.test.ts` | 9 | read/write, missing/invalid/oversized/aborted, `.bak`, separate backup |
| `definition.test.ts` | 3 | store declaration, key copy, non-empty copy |
| `format.test.ts` | 7 | cost, IDs, basenames, plurals, relative time, clock/diff |

The GUI itself is verified manually in Desktop using [`test-plan.md`](test-plan.md); there is no
headless host for the experimental GUI SDK. The suite deliberately covers the pure model and file
I/O; it cannot prove Desktop's event timing, tab behavior, or notification delivery.

## Trade-offs and follow-ups

- Per-project boards keep workflows isolated, but adding a project creates a new board and a new
  snapshot file. The canonical-folder key means duplicate OpenCode project records share one board.
- A per-project board file makes backup and transfer easy; a legacy whole-installation file is
  narrowed to one project on reload.
- Auto-export keeps each file current but overwrites external edits; `.bak` rotates to the
  immediately previous snapshot.
- Pinned sessions are authoritative and hydrated by ID; only unpinned tasks use the directory
  discovery fallback, which becomes an explicit pin when the task is opened.
- Server ids scope tasks and live state. Legacy tasks are claimed lazily because a board does not
  know the server until a mounted session reads the project.
- Desktop's plugin store is not encrypted; OS permissions and Desktop's storage protect it.
- Follow-ups: tag reordering, persistent undo history, pinning closed sessions, multi-server task
  records, and macOS/Windows verification.
