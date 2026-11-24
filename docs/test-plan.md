# Test plan

Two layers: automated unit tests for everything that does not need a GUI, and a manual Desktop
plan for the contributions and API calls that only the app can exercise.

The current v0.1.3 development suite has **138 cases** (v0.1.2 shipped with 136). It covers the pure model, the live registry with a
fake client, the board-file server code, the store definition, and formatting. It cannot cover
Desktop's event timing, tabs, dialogs, notifications, clipboard, or worktree API.

## Automated

Run from the checkout:

```bash
npm run typecheck
npm test
npm run build
```

The build is expected to produce `dist/gui-experimental.cjs`; a second build should be
byte-identical and the bundle should require only the five shared modules.

### `model/boards.test.ts` — 10 cases

- normalizes project keys and Windows paths
- splits the legacy global board by project folder
- scopes an imported file to one project and ignores other folders
- resolves a root-less migrated board by project id
- writes board maps immutably and finds tasks across boards

### `model/board.test.ts` — 62 cases

- default board seeds Todo / In progress / Done
- positions are per project and column
- blank title falls back to the branch
- blank branch and unknown categories are handled
- two projects keep independent position spaces
- move between columns inserts at an index and renumbers both
- reorder inside one column
- unknown task and column are no-ops
- move by delta clamps at both ends
- move to next/previous column clamps at the ends
- update title/notes; blank title ignored
- category change moves the task
- tags and a category move apply together
- adopts the current project id and root for a per-project board
- leaves an already-adopted board unchanged
- bind a session (and merge/override bindings from a file)
- archive, list, and restore
- delete renumbers the column
- undo-delete restores a task at its old position
- undo-delete restores an archived task into the archive
- undo-delete clamps a deleted column and drops deleted tags
- undo-delete ignores a task that already exists
- add, rename, recolor, reorder, and delete a project's columns
- a new project board starts with the default columns; edits stay in that board
- task moves reject a column owned by another project
- normalization validates each project's column set and drops empty sets
- records the server id and scopes positions per server
- canonical board key ignores object key order
- a normalized duplicate-id board compares equal
- a legacy existing folder wins over a worktree and the project root
- a legacy existing folder is stored and normalized without a worktree
- claims a legacy task on session bind or first server edit
- preserves the server id through normalization
- the default density is comfortable and the compact copy keys exist
- per-project tag sets stay independent; deleting a tag affects only its project
- legacy shared tags seed a project with tasks; empty tag sets are preserved
- task creation and edits reject tags from another project
- normalize repairs duplicates, orphans, and empty data
- normalize seeds defaults
- a valid board is stable through normalize
- duplicate branch detection and active/archived counts
- six-digit hex colors and category color sanitization
- add/rename/recolor/read tags
- assign only existing tags; clear empty assignments
- delete a tag from every task
- normalize duplicate/blank/invalid tags and orphaned task tags
- `isBoardLike` accepts the board shape and rejects incomplete files
- generated branch shape and git branch validation

### `model/status.test.ts` — 12 cases

- path normalization and equality
- session list → row mapping
- pinned session wins
- a missing pin does not fall back to a newer worktree session
- a legacy existing folder matches the task
- newest root session in the worktree wins for an unpinned task
- no match returns nothing
- nested descendants, no duplicates
- status, nested subagent, and cost derivation
- todo lookup attached to the right session
- no-session fallback
- status helpers and the running → idle transition

### `model/todo.test.ts` — 8 cases

- status strings and `completed` booleans
- text fields; empty and non-array input
- a completed todo tool call
- non-todo tools and incomplete calls ignored
- newest call wins regardless of array order
- metadata and JSON content fallbacks
- non-assistant messages and empty lists
- progress percentage

### `model/projects.test.ts` — 10 cases

- names from the last path segment, Windows paths, trailing slashes
- sort and dedupe project rows
- dedupe different ids for the same canonical folder
- replace a duplicate folder with the routed project id
- merge the routed project before the list loads
- no duplicate when the list already has it
- mounted project beats the directory fallback
- lookup helpers

### `model/select.test.ts` — 7 cases

- search title, branch, project, and notes case-insensitively
- tag filters use AND semantics
- per-column and archive filtering
- server scope keeps legacy tasks visible and excludes another server's tasks
- first visible task in a column or board
- neighbours in a column
- status key mapping

### `data/actions.test.ts` — 2 cases

- passes the selected base ref instead of the generated branch
- sanitizes the worktree name and omits blank inputs

### `data/live.test.ts` — 8 cases

- running status, cost, and parsed todos from a fake client
- a pinned session outside the page is fetched by ID
- a server-confirmed deleted pin is reported for clearing
- an archived pinned session stays linked and idle
- a missing pinned session does not fall back to another worktree session
- live tasks are scoped to the mounted server; legacy tasks remain visible
- running → idle transition callback
- failed reads keep the last snapshot and mark it stale

### `server/board-file.test.ts` — 9 cases

- reads a valid board file
- reports a missing file
- reports invalid JSON
- rejects a relative directory
- rejects a file over the size cap
- honours an aborted signal
- writes the board and keeps the previous file as `.bak`
- writes a separate pre-reload backup without touching the board
- rejects invalid JSON, relative paths, oversized writes, and aborts

### `definition.test.ts` — 3 cases

- the definition declares the board and prefs stores
- English copy contains the main surfaces
- no default copy value is empty

### `format.test.ts` — 7 cases

- cost formatting including sub-cent and zero
- short IDs
- path basenames
- plural counts
- relative times
- clock and diff formatting

### Not covered automatically

- `openTask` mode selection and stale-binding recovery
- session creation, prompt sending, and tab behavior
- the worktree API and VCS calls
- the board RPC in a running Desktop server
- dialogs, keyboard focus, drag and drop, notifications, clipboard, and reveal
- Desktop's handling of the committed `dist`

## Manual Desktop plan

Use a throwaway git project with a remote base branch (for example `~/Projects/kanban-demo`).
Create a second non-git folder for the plain-task path. Quit and reopen Desktop between install
changes.

Record the build or commit under test. Use two projects with cards for the cross-project export
cases.

| ID | Steps | Expected |
|---|---|---|
| K-01 | Install per README; open **Settings → Extensions → Plugins**; run `opencode plugin list` | `nmdra.kanban-desktop` is listed once, enabled, not "not loaded"; the CLI lists the checkout path |
| K-02 | Open a session; run `/kanban`, close the tab; use `mod+alt+k`; use the side region **+** menu | Each opens the Kanban panel on the routed project |
| K-03 | Run **Kanban: open full board** / `mod+alt+shift+k` | The same board opens in a large dialog; project switch and task dialogs work |
| K-04 | Open the panel on a project with no tasks | Empty state with a **New task** button |
| K-05 | Create a task in a non-git folder with worktree off | Card appears; no worktree; Open creates and binds a session in the project root |
| K-06 | Create a task in a git project with worktree on and a prompt (**Open a session** on, the default) | A detached worktree is created at the base ref; no git branch is created; a linked session opens in that directory with the prompt prefilled; the card shows the worktree name and the session is bound before sending |
| K-06b | Inspect the worktree with git | `git worktree list` shows it detached at the base commit; create a branch inside it manually; the plugin neither creates nor deletes that branch |
| K-07 | Leave the branch name empty and enter a title; press **Generate** | A worktree label is generated as `feature/<word>-<word>-NNN`; **Generate** replaces it with another valid name |
| K-07b | Choose **Default branch** in the base select | The select keeps showing “Default branch” instead of a blank value; the worktree detaches at HEAD |
| K-08 | Try a branch name with a space, a duplicate label, and an empty title+label | The dialog shows the matching validation message and stays open; no card/worktree is created |
| K-09 | Drag a card to another column and between two cards | Card moves, order is correct, counts update |
| K-10 | Select a card, press Shift+Right and Shift+Up | Task changes column, then reorders within the column |
| K-11 | Open **Columns** on project A: add, rename, recolor, move up/down | Project A updates live; tasks follow their column |
| K-11b | Add a column in project A, then switch the panel to project B | Project A keeps its column; project B keeps its own set or the default columns |
| K-11c | Open the task dialog in a project with custom columns, then switch projects | Column options follow the selected project; a choice missing from the target project resets to its first column |
| K-11d | Rename a tag in project A, then switch to project B | Project A shows the new name; project B keeps its own tag names |
| K-12 | Delete a column with tasks | Confirmation; tasks move to the first remaining column |
| K-13 | Try to delete the last column | Refused with an explanation |
| K-14 | Type in search; press Escape; press `/` | Filter narrows to title/branch/project/notes matches; Escape clears; `/` focuses the field |
| K-15 | Archive a card, click **Undo** in the toast | The task returns to its original column and position within 8 seconds |
| K-15b | Archive a card, open **Archive**, restore it | Task leaves the board, appears in Archive, returns to its original column and position |
| K-16 | Delete a task with a worktree; choose **Delete task, keep worktree**, then click **Undo** | Card is deleted; worktree remains on disk; Undo restores the card at its old position and the session keeps running |
| K-17 | Delete a task with a clean worktree; choose **Delete task and remove worktree** | Worktree is removed; no branch was created to clean up; the card is gone and no Undo action is offered |
| K-18 | Delete a task with a dirty worktree; choose **Delete task and remove worktree**, then force | First removal fails; a force confirmation names the error; force removes it; declining keeps both task and worktree |
| K-19 | Edit a task's title, column, notes, and tags | Changes persist across a reopen |
| K-20 | Double-click a card with no session, with **Opening a task = Reuse** | A session is created in its directory, bound to the card, and opened |
| K-20b | Double-click the same card again | The same session tab focuses; no second session is created |
| K-20c | Card menu → **New session** on a card that has a session | A fresh session is created and bound; the old session stays in its tab |
| K-20d | Set **Opening a task = Ask**, then double-click a card that has a session | A two-option dialog appears; Reuse focuses, New starts a fresh session |
| K-20e | Card menu → **Link to this session** | The card tracks this session's status/todos/cost; Open focuses this tab |
| K-20f | Open two sessions in one project; card menu → **Link session…** | The current session is listed first; pending/subagent/other-project sessions are absent; picking another binds the task to it |
| K-20g | Link two tasks to the same session | Both cards show the same session state; one completion notification is sent in this window |
| K-20h | Card menu → **Unlink session** | The explicit link is removed; a worktree task may match a session by directory again |
| K-20i | Try to link a session from another project | It is not listed; the direct link command refuses with a toast |
| K-21 | Send the prefilled prompt; watch the card | Status becomes running, then idle when the agent finishes |
| K-22 | Use **Open session** on a task with an existing session | The existing session tab focuses; no duplicate session is created |
| K-23 | Create a session manually in a worktree for an unpinned task, then refresh and open the task | The card discovers the newest root session; opening pins it explicitly |
| K-23b | Pin a task to session A, create a newer session B in the same worktree, refresh, then press Open | The card stays on A and opens A; B never replaces the pin |
| K-23c | Restart Desktop with a pinned task, then open it | The pin persists and opens the same session |
| K-24 | Enable the todo tool, ask the agent for a plan; open Details | Todo checklist and progress match the session's newest completed todo tool call |
| K-25 | Run a subagent; open Details | Subagent row with status, cost, and todo count when available |
| K-26 | Change a file in the worktree; open Details → Changes | File list with add/delete counts, totals, and the base branch shown |
| K-27 | Set a default initial prompt; open a task with no session; press **Start agent** | A session is created, the prompt is sent, and its tab opens. The button only appears when no session exists and the default prompt is non-empty |
| K-28 | With notifications on, finish a task while Desktop is unfocused | System notification appears and opens the session when clicked |
| K-29 | Repeat while focused; also observe a second window | Desktop's notification/sound rules apply; this window does not duplicate. Record whether the app suppresses a cross-window duplicate |
| K-30 | Stop the server or open a project whose server is unreachable | Stale notice appears; cards keep the last state; Retry works after recovery |
| K-31 | Enable the pill; switch sessions in the same project | Pill shows the running count or task count; rows are running tasks; clicking the pill opens the board |
| K-32 | Hide the pill in Settings, then set `options.pill: false` in config | Pill hides both ways; the board still works |
| K-33 | Change alignment, width, density, poll interval, default column, auto-export, auto-reload | Board and refresh behavior follow; changes apply without a restart and survive one |
| K-33b | Toggle compact columns from the header, `C`, the palette, and settings | Cards become one-line rows with a status dot; tags and branch/worktree details hide; the setting survives a restart |
| K-33c | Open **Help** at the narrowest panel width | `CTRL ALT SHIFT K` and other key chips stay in the key column; descriptions do not overlap |
| K-33d | Open the new-task dialog at normal and narrow widths | Long switch descriptions wrap under their labels instead of clipping at the right edge; the dialog remains scrollable |
| K-34 | **Reset board data** | Confirm; tasks, tags, tag assignments, and every project's column set are gone; the three default columns return in each board; worktrees, sessions, and preferences remain |
| K-35 | Restart Desktop with several tasks | Board, tags, session links, columns, positions, archived cards, and settings persist |
| K-36 | Switch projects in the panel header | The other project's entire board, columns, tags, and archive load; the previous project's board is unchanged; creating a task targets that project |
| K-36b | Create a task and export the board | The exported task contains the mounted server's `serverID`; a legacy task without one is claimed when its project opens |
| K-36c | Open two servers that expose the same project ID (if available) | Cards, live status, and the pill do not mix tasks from the other server |
| K-36d | When OpenCode has two project records for the same folder (for example cache-stats), open the project switcher | The folder appears once; selecting it uses the routed project id and its tasks |
| K-37 | Inspect `dist/gui-experimental.cjs` | Requires only `effect`, `@opencode/plugin/gui`, `@opencode/plugin/rpc`, `solid-js`, `solid-js/web` |
| K-38 | Search the source/bundle for process and network APIs | No `child_process`, shell execution, `spawn(`, `fetch(`, WebSocket, telemetry, or external URL. Do not flag the regex `.exec(` already present in source |
| K-39 | Archive or delete a running task | The session keeps running; no process is killed |
| K-40 | Restart the server while the panel is open | The board reconnects on the next event/poll without a window reload |
| K-41 | Export a current board, then reload it from the same project | If the board has any task, a confirmation appears; after confirming, the cards/tags/columns match the exported file; the backup exists. Do not use a stale seed |
| K-42 | Remove the file, then press reload | A toast says the file is missing; the board is unchanged |
| K-43 | Put invalid JSON in the file, then press reload | A toast rejects the file; the board is unchanged |
| K-44 | Export with an existing project `kanban-board.json`, then export again | `kanban-board.json` matches that project's live board; the previous file is kept as `kanban-board.json.bak`; no other project's tasks appear |
| K-44b | With auto-export on, move a card, rename a column, add a tag, and edit a task; wait two seconds each time | That project's `kanban-board.json` updates without pressing Export; no success toast; `.bak` holds the previous snapshot |
| K-44c | Turn **Auto-export board** off, change the board, wait, then press Export | The file does not change automatically; manual Export still writes it and reports the paths |
| K-44d | With auto-reload on and no unsaved live edits, edit `kanban-board.json` externally (move a card or rename a tag), wait three seconds | The live board updates automatically with a confirmation toast; manual Reload is not needed |
| K-44e | Make a live board edit, then change the file externally before auto-export writes, wait | Auto-reload shows one conflict toast and leaves the live board untouched; manual Reload can still import the file |
| K-45 | Reload after exporting; inspect the project root | `kanban-board.backup.json` holds that project's pre-reload board; copy it aside, use it as `kanban-board.json`, and reload to recover |
| K-46 | With cards in two projects, export from project A, then inspect project A's file | The file contains only A's tasks, tags, columns, and archive state; project B's cards are absent; project B's root does not automatically get a file |
| K-47 | With an empty board, press reload with a valid file | No confirmation and no new `kanban-board.backup.json`; the file loads |
| K-48 | Delete a task's pinned session outside the board, then refresh | The pin is cleared after the server confirms it is missing; a toast explains; the card shows no session and **Unlink** disappears; Link/New session can attach another |
| K-50 | Upgrade a v0.1.1 installation whose board has tasks from two projects | Each project shows only its own cards, columns, and tags; the old global file still loads only the current project on reload |
| K-53 | Open a project whose board tasks carry an old project ID because OpenCode has duplicate records for the folder | The cards appear with their tags and columns; the board adopts the current project ID and auto-exports the corrected board |
| K-51 | Put a legacy whole-installation `kanban-board.json` in project A and reload | Only A's tasks are imported; the other project's cards stay out of A's board; the toast reports A's imported task count |
| T-01 | **Tags** → add three tags with different colors in project A | The filter row and task dialog show them for A; project B keeps its own tags; cards show assigned tags |
| T-02 | Assign tags in the task dialog, then save | Card shows up to 3 tags; detail and archive show all |
| T-03 | Click a tag on a card | That tag toggles in the filter row |
| T-04 | Select two tags in the filter | Only tasks with both tags are shown; **Clear tags** resets |
| T-05 | Delete a tag used by tasks in project A | Confirm; the tag disappears from A's cards, task dialog, and filter; project B is unchanged |
| T-06 | Restart or reload after tagging | Tags and assignments persist when the file contains them |
| T-07 | Add tags to projects A and B, rename A's tag, and switch projects | A and B keep separate names; the filter clears on the project switch and never shows the other project's tags |

## Notes

- Desktop notifications may be off by default in OpenCode's settings; enable them to see K-28.
- A todo tool call must be present for K-24. Without it, the card deliberately omits progress.
- The full board dialog stacks over the session; task dialogs opened from it stack above it.
- K-41/K-45 are the only reload cases that should use a real exported file during a release pass.
  A seed file is not a live backup.
- A task in a non-git project has no worktree. Its delete always offers Undo; the project folder is
  not a worktree. Use a git project for K-17. Existing-folder tasks likewise never remove their
  folder.
- The automated tests exercise Windows path normalization, but the Desktop flows have only been
  exercised on Linux. macOS and Windows remain manual follow-ups.
- The Help key column expands and wraps its chips; re-check the narrow-width key list before
  signing the release.
