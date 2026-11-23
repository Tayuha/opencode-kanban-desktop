# Board file: `kanban-board.json`

This page describes the snapshot file used by **Export board**, **auto-export**, and **Reload
board**. It is the reference for the destructive part of the workflow: **reload replaces the live
board with the file**.

The file is a plain JSON snapshot of the plugin's `Store.global` board. It is not the live store,
not a database, and not project-scoped. Preferences are not included. Auto-export keeps it current
after board changes unless the preference is off.

> **Before a valid reload, export the current board.** A stale seed or an older snapshot will
> remove cards, columns, tags, tag assignments, and archive state that are not in the file.

## What the file contains

```ts
type BoardFile = {
  version: number          // written as 1; not enforced on read
  tags?: Tag[]             // shared tag seed
  tagsByProject?: Record<string, Tag[]>  // per-project tag sets
  categories: Category[]   // shared default columns, non-empty
  categoriesByProject?: Record<string, Category[]>  // per-project column sets
  tasks: Task[]            // every project, including archived cards
}

type Tag = { id: string; name: string; color: string }

type Category = {
  id: string
  name: string
  color: string
  position: number
}

type Task = {
  id: string
  title: string
  projectID: string
  projectRoot: string
  projectName: string
  serverID?: string
  branch: string
  baseBranch?: string
  worktreePath?: string
  directory?: string
  categoryID: string
  position: number
  tagIDs?: string[]
  sessionID?: string
  notes?: string
  createdAt: number
  updatedAt: number
  archived: boolean
  archivedAt?: number
}
```

A minimal hand-written file:

```json
{
  "version": 1,
  "tags": [
    { "id": "tag_ui", "name": "UI", "color": "#5b8def" }
  ],
  "categories": [
    { "id": "todo", "name": "Todo", "color": "#5b8def", "position": 0 },
    { "id": "done", "name": "Done", "color": "#2f9e6e", "position": 1 }
  ],
  "tasks": [
    {
      "id": "task_example",
      "title": "Write the empty state",
      "projectID": "proj_example",
      "projectRoot": "/home/me/projects/example",
      "projectName": "example",
      "branch": "feature/amber-otter-042",
      "baseBranch": "main",
      "worktreePath": "/home/me/.local/share/opencode/worktree/proj_example/feature-amber-otter-042",
      "categoryID": "todo",
      "position": 0,
      "tagIDs": ["tag_ui"],
      "notes": "Use the existing panel spacing.",
      "createdAt": 1730000000000,
      "updatedAt": 1730000000000,
      "archived": false
    }
  ]
}
```

`tags` and `tagIDs` are optional so pre-tag boards still load. The loader writes `version: 1`
after normalization regardless of the value in the file.

## Filenames and guarantees

| File | Role |
|---|---|
| `kanban-board.json` | Read by reload; written by export and by a direct `save` RPC call |
| `kanban-board.json.bak` | The previous `kanban-board.json`, copied before an export overwrites an existing file |
| `kanban-board.backup.json` | The live board, written before a confirmed reload |
| `kanban-board.json.tmp-*` | Short-lived temp file in the same directory during an atomic write; removed on failure |

All names are fixed. The RPC takes an absolute project directory, never an arbitrary filename or
a directory listing. The cap is **5,000,000 bytes (about 4.8 MiB)** for both reads and writes.
Writes use a temp file plus `rename` in the same directory, so a successful write replaces the file
atomically. The `.bak` copy is not atomic, but a copy failure aborts the export before the board
file is replaced.

Reads reject:

- a relative or empty directory;
- a missing file, or a path that is not a regular file;
- a file whose stat size or UTF-8 byte length exceeds the cap;
- invalid JSON;
- an aborted request.

Writes reject a relative or empty directory, a directory that does not exist, invalid JSON,
oversized content, an unknown `target`, and an aborted request.

The RPC checks JSON syntax. The GUI additionally checks the board shape with `isBoardLike` before
replacing the store. A syntactically valid JSON file that is not a board is rejected with a toast
and leaves the board alone.

## Export

Auto-export runs after board changes settle for 1.5 seconds. Manual **Export board** (panel upload
icon or palette command) runs the same write immediately. Both:

1. Serialize the whole live board with two-space indentation and a trailing newline.
2. Call `nmdra.kanban-desktop.board.save({ directory: targetProjectRoot, json })`.
3. If `kanban-board.json` already exists as a regular file, copy it to
   `kanban-board.json.bak` first.
4. Write the new file atomically.

Auto-export targets the last selected project's root and is silent on success. A failure shows one
toast per distinct error. Manual export reports the file and backup paths.

Consequences:

- The selected project chooses only the **destination directory**. The file always contains every
  project's tasks and all per-project tags and columns.
- `.bak` is the previous **file**, not a snapshot of the board at the moment you exported. With
  auto-export it is the immediately previous auto-snapshot; a manual export also rotates it.
- Exporting to a git project's root creates an untracked or modified `kanban-board.json` in that
  project. The plugin does not add it to `.gitignore`; decide whether to commit, ignore, or delete
  it. It can also appear in that project's VCS status.
- The file contains task titles, notes, branches, worktree paths, and session IDs. Treat it as
  sensitive project data.

If the directory does not exist or is not writable, the operation reports the server error and the
existing board file is not replaced. If the `.bak` copy fails, the export aborts before writing.

## Auto-reload

While **Auto-reload external changes** is on and a session is active, the plugin reads the last
selected project's `kanban-board.json` every two seconds. The first read for a target only records
a baseline. A later external change is applied when the live board matches the last
exported/reloaded snapshot: the file is parsed, checked, normalized, session bindings are merged,
and the board store is replaced. A success toast confirms the update.

If the live board has unsaved changes, auto-reload skips the file and shows one conflict toast
instead of overwriting your work. Missing or invalid files leave the board untouched. A file that
normalizes back to the same board, such as one with duplicate task IDs, shows a no-change toast
instead of claiming an update. The manual
**Reload board** remains available.

## Reload

**Reload board** (panel download icon or palette command) runs this pipeline:

1. Resolve the selected project's root.
2. If the **live board has at least one task in any project** (archived tasks count), ask for
   confirmation. If the board is empty, skip the confirmation and the backup.
3. After confirmation, serialize the live board and call `save` with `target: "backup"`. This
   writes `kanban-board.backup.json` and does not touch `kanban-board.json`. If this step fails,
   stop; the board is untouched.
4. Call `load({ directory: projectRoot })` to read `kanban-board.json`.
5. Parse the JSON and check `isBoardLike`.
6. Run `normalizeBoard` to repair the shared and per-project tag and column sets, positions, colors,
   duplicates, and orphan references. Existing projects get a copy of the shared tags.
7. Run `mergeSessionBindings(imported, current)`: for each imported task, keep the current
   `sessionID` **only if** the imported task has the same task ID and does not specify a
   `sessionID` itself.
8. Replace the entire board store with the result and invalidate live state.

What is replaced:

- every shared and per-project column, name, color, and order;
- every tag and tag assignment, in every project;
- every task in every project, including archived state and positions;
- session bindings named by the file.

What is preserved:

- preferences (alignment, width, poll interval, open mode, notification/pill settings, default
  prompt);
- a current session binding for an imported task with the same ID when the file omits
  `sessionID`;
- worktrees, branches, and sessions on disk/server (the file only stores references).

What is **not** preserved or merged:

- tasks that are in the live board but not in the file are deleted from the board store;
- columns and tags that are in the live board but not in the file are deleted, including every
  project's tag and column sets;
- a task with a different `serverID` from the mounted server is not shown or live-updated, though it
  remains in the file; legacy tasks without one are claimed by the first server that opens the
  project;
- a task with `directory` runs in that existing folder; the file path is never deleted and never
  treated as a managed worktree;
- tag assignments that the file does not name are lost for that task;
- live status is not stored in the file and is always recomputed from sessions. A reload does not
  "reset status" directly; it changes which session a task points at (or keeps the old binding).

If the file is missing, too large, invalid JSON, or fails the board-shape check, the store is not
changed. The toast describes the reason. A pre-reload backup written in step 3 remains on disk.

### Backup conditions

`kanban-board.backup.json` is written only when:

- the live board has at least one task, and
- the user confirms, and
- the backup write succeeds.

An empty-board reload creates no new backup. A backup from an earlier reload is not deleted, so a
stale `kanban-board.backup.json` can exist. Check its timestamp before treating it as recovery
data.

`kanban-board.json.bak` is created by export or auto-export, and only when a previous board file
existed.

## Recovery

Stop and copy the backup aside before doing anything else. A recovery reload is itself a reload. If
the currently live board has at least one task, the next confirmed reload overwrites
`kanban-board.backup.json` with that live board, so preserve the old backup first if you may need it.

### Recover the board that was live before the last reload

If that reload had at least one task and completed its backup step:

```bash
cd /path/to/project
cp kanban-board.backup.json /tmp/kanban-board.recovery.json
cp /tmp/kanban-board.recovery.json kanban-board.json
```

Then press **Reload board** on that project. If you want to keep the old backup too, copy it to
`/tmp` first (as above); a later confirmed reload of a non-empty board overwrites the backup file.

### Recover the file that was overwritten by the last export

```bash
cd /path/to/project
cp kanban-board.json.bak /tmp/kanban-board.recovery.json
cp /tmp/kanban-board.recovery.json kanban-board.json
```

Then reload. `.bak` is the previous file, so verify its timestamp and contents first.

### No board file exists

There is no automatic recovery from a reload that never had a backup. Options:

- restore Desktop's plugin storage from a backup of
  `~/.config/ai.opencode.desktop/drafts.sqlite` (quit Desktop first; this restores all of
  Desktop's plugin storage, not only Kanban);
- use an earlier `kanban-board.json` or `.bak` from another copy;
- rebuild the cards by hand
  and reload a hand-written file.

## Hand-editing rules

Hand-edited files are allowed, but the loader repairs or rejects malformed data:

- invalid JSON is rejected before the board changes;
- a non-board shape (missing `categories`, an empty `categories` array, a missing `tasks` array, or
  tasks without `id`, `title`, `projectID`, `branch`, or `categoryID`) is rejected;
- duplicate category, tag, or task IDs keep the first occurrence;
- a task with an unknown `categoryID` moves to the first column;
- blank titles fall back to the branch; blank category/tag names get a default;
- invalid colors fall back to the built-in palette;
- duplicate tag IDs and tag IDs that reference missing tags are removed;
- positions are renumbered per project and column;
- missing `version`, `tags`, `tagsByProject`, `tagIDs`, `categoriesByProject`, `archived`, and
  other optional fields get defaults; empty column sets are dropped and their tasks fall back to
  that project's first available column, while empty tag sets are preserved.

The loader does **not** verify that a task's `projectID`, `projectRoot`, `worktreePath`, or
`sessionID` belongs to the selected project or to a live session. Reload only files you trust.

## RPC contract and trust boundary

The GUI calls the plugin's RPC through the local OpenCode server:

- `nmdra.kanban-desktop.board.load({ directory })` returns `{ path, json }`.
- `nmdra.kanban-desktop.board.save({ directory, json, target? })` returns `{ path, backupPath? }`.
  `target` is `"board"` (default) or `"backup"`.

The RPC performs no authentication of its own beyond the local server's RPC surface. It trusts the
absolute directory supplied by the caller and writes only the fixed filenames there. Any local
client able to call the RPC could therefore write those three filenames into another existing
absolute directory. The plugin's own GUI always passes the selected project's root.

## Limits

- 5,000,000 bytes per read or write.
- No streaming and no conflict detection: the last write wins.
- No project-scoped export or merge. The file is the whole board.
- No import from the Rust TUI's SQLite database; JSON snapshots only.
- No automatic backup for an empty-board reload.
- Tasks whose `projectID` is not present in the current Desktop installation remain in the store
  but may not be reachable in the project switcher.
- The file is not encrypted. OS file permissions protect it.

For the user-facing summary, see the README's **Export and reload** section. For test cases, see
[`test-plan.md`](test-plan.md).
