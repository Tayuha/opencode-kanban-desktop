# Board file: `kanban-board.json`

This page describes the snapshot file used by **Export board**, **auto-export**, **Reload board**,
and **auto-reload**. It is the reference for the destructive part of the workflow: **reload
replaces the live board with the file**.

Each project folder owns one board and one snapshot. The file is a plain JSON snapshot of that
project's board, not the live store and not a database. Preferences are not included. Auto-export
keeps the selected project's file current after its board changes unless the preference is off.

> **Before a valid reload, export the project's current board.** A stale seed or an older snapshot
> will remove cards, columns, tags, tag assignments, and archive state that are not in the file.

## Where the file lives

- Default: `<projectRoot>/kanban-board.json`.
- The folder icon in the panel header opens **Board file folder**. Choose **Project root** or a
  folder with `ctx.desktop.pick`. The choice is stored per project in the preferences.
- A project's board is keyed by its canonical folder. Two OpenCode project records for the same
  folder share one board and one default file.
- Do not point several projects at the same folder. They would take turns overwriting one file.

The board RPC writes only fixed filenames inside the folder the GUI supplies. It never accepts a
custom filename or lists directories.

## What the file contains

```ts
type BoardFile = {
  version: number          // written as 1; not enforced on read
  tags?: Tag[]             // this project's tags
  categories: Category[]   // this project's columns, non-empty
  tasks: Task[]            // this project's tasks, including archived cards
}
```

Files written by v0.1.1 may contain `tagsByProject` and `categoriesByProject` plus tasks from every
project. They are still accepted: the loader normalizes the file, keeps the slice that belongs to
the selected project, and ignores tasks for other folders. New exports write the simpler
board-level shape.

```ts
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

## Storage and upgrade

The live boards live in Desktop plugin storage (`Store.global`) in the
`plugin.nmdra.kanban-desktop.boards` state row. That row is a map from canonical project folder to
one board. Preferences, including board-folder overrides, are in
`plugin.nmdra.kanban-desktop.prefs`.

v0.1.1 stored one `plugin.nmdra.kanban-desktop.board` with every project's tasks. On the first
mount after upgrading, the plugin:

1. normalizes the legacy board;
2. groups tasks by `projectRoot` (falling back to `id:<projectID>` for a task with no root);
3. gives each group its project's columns and tags;
4. writes the map to `boards`;
5. resets the legacy `board` row to the empty default.

The legacy row is not migrated again. A task with no stored root remains addressable by project id
but needs a known project folder before it can be exported.

With auto-export on, the upgrade also schedules one write of the selected project's board, so its
existing `kanban-board.json` becomes project-scoped promptly (the previous file is kept as `.bak`).
Other projects write their files when they are selected and change.

## Filenames and guarantees

| File | Role |
|---|---|
| `kanban-board.json` | Read by reload; written by export and by a direct `save` RPC call |
| `kanban-board.json.bak` | The previous `kanban-board.json`, copied before an export overwrites an existing file |
| `kanban-board.backup.json` | The live project board, written before a confirmed reload |
| `kanban-board.json.tmp-*` | Short-lived temp file in the same folder during an atomic write; removed on failure |

All names are fixed. The RPC takes an absolute folder, never an arbitrary filename or a directory
listing. The cap is **5,000,000 bytes (about 4.8 MiB)** for both reads and writes. Writes use a temp
file plus `rename` in the same folder, so a successful write replaces the file atomically. The
`.bak` copy is not atomic, but a copy failure aborts the export before the board file is replaced.

Reads reject:

- a relative or empty folder;
- a missing file, or a path that is not a regular file;
- a file whose stat size or UTF-8 byte length exceeds the cap;
- invalid JSON;
- an aborted request.

Writes reject a relative or empty folder, a folder that does not exist, invalid JSON, oversized
content, an unknown `target`, and an aborted request.

The RPC checks JSON syntax. The GUI additionally checks the board shape with `isBoardLike` before
replacing a board. A syntactically valid JSON file that is not a board is rejected with a toast and
leaves the board alone.

## Export

Auto-export runs after one project's board changes settle for 1.5 seconds. Manual **Export board**
(panel upload icon or palette command) runs the same write immediately. With auto-export on,
selecting a project that has a board but no file also creates its snapshot; an existing file is
never overwritten just by selecting the project. Both writes:

1. Serialize that project's live board with two-space indentation and a trailing newline.
2. Call `nmdra.kanban-desktop.board.save({ directory: boardFolder, json })`.
3. If `kanban-board.json` already exists as a regular file, copy it to
   `kanban-board.json.bak` first.
4. Write the new file atomically.

Auto-export tracks and writes each changed project independently. It is silent on success. A
failure shows one toast per distinct error. Manual export reports the file and backup paths and
updates the folder used by later auto-exports.

Consequences:

- The file contains **only the exported project's** tasks, columns, tags, and archive state.
- `.bak` is the previous **file**, not a snapshot at the moment you exported. With auto-export it
  is the immediately previous auto-snapshot; a manual export also rotates it.
- A board-folder override changes the destination for that project. The RPC still writes only the
  fixed names into that folder.
- Exporting to a git project's root creates an untracked or modified `kanban-board.json` in that
  project. The plugin does not add it to `.gitignore`; decide whether to commit, ignore, or delete
  it. It can also appear in that project's VCS status.
- The file contains task titles, notes, branches, worktree paths, and session IDs. Treat it as
  sensitive project data.

If the folder does not exist or is not writable, the operation reports the server error and the
existing board file is not replaced. If the `.bak` copy fails, the export aborts before writing.

## Auto-reload

While **Auto-reload external changes** is on and a session is active, the plugin reads the selected
project's board file every two seconds. The first successful read for a project records a baseline.
A later external change is applied when that project's live board matches the last
exported/reloaded snapshot: the file is parsed, checked, scoped to the project, normalized, session
bindings are merged, and only that project's board is replaced. A success toast confirms the
update.

If the project's live board has unsaved changes, auto-reload skips the file and shows one conflict
toast instead of overwriting your work. Missing or invalid files leave the board untouched. A file
that normalizes back to the same board, such as one with duplicate task IDs, shows a no-change toast
instead of claiming an update. Tasks for other project folders in the file are ignored. The manual
**Reload board** remains available.

## Reload

**Reload board** (panel download icon or palette command) runs this pipeline:

1. Resolve the selected project's folder and board folder.
2. If that project's board has at least one task (archived tasks count), ask for confirmation. If
   the board is empty, skip the confirmation and the backup.
3. After confirmation, serialize that project's board and call `save` with `target: "backup"`. This
   writes `kanban-board.backup.json` and does not touch `kanban-board.json`. If this step fails,
   stop; the project's board is untouched.
4. Call `load({ directory: boardFolder })` to read `kanban-board.json`.
5. Parse the JSON and check `isBoardLike`.
6. Normalize the file and scope it to this project folder (or, for a root-less legacy task, this
   project id). Tasks for other folders are ignored.
7. Run `normalizeBoard` to repair tag and column sets, positions, colors, duplicates, and orphan
   references.
8. Run `mergeSessionBindings(imported, current)`: for each imported task, keep the current
   `sessionID` **only if** the imported task has the same task ID and does not specify a
   `sessionID` itself.
9. Replace only that project's board and invalidate live state.

What is replaced:

- this project's columns, names, colors, and order;
- this project's tags, tag assignments, and archive state;
- this project's tasks and positions;
- session bindings named by the file for this project.

What is preserved:

- every other project's board;
- preferences (alignment, width, poll interval, open mode, notification/pill settings, default
  prompt, board-folder overrides);
- a current session binding for an imported task with the same ID when the file omits
  `sessionID`;
- worktrees, branches, and sessions on disk/server (the file only stores references).

What is **not** preserved or merged:

- tasks in this project's live board but not in the file are deleted from this project's board;
- columns and tags in the live board but not in the file are deleted for this project;
- a task with a different `serverID` from the mounted server is not shown or live-updated, though it
  remains in the file; legacy tasks without one are claimed by the first server that opens the
  project;
- a task with `directory` runs in that existing folder; the folder is never deleted and never
  treated as a managed worktree;
- tag assignments that the file does not name are lost for that task;
- live status is not stored in the file and is always recomputed from sessions.

If the file is missing, too large, invalid JSON, or fails the board-shape check, the board is not
changed. The toast describes the reason. A pre-reload backup written in step 3 remains on disk.

### Backup conditions

`kanban-board.backup.json` is written only when:

- this project's live board has at least one task, and
- the user confirms, and
- the backup write succeeds.

An empty-board reload creates no new backup. A backup from an earlier reload is not deleted, so a
stale `kanban-board.backup.json` can exist. Check its timestamp before treating it as recovery
data.

`kanban-board.json.bak` is created by export or auto-export, and only when a previous board file
existed.

## Recovery

Stop and copy the backup aside before doing anything else. A recovery reload is itself a reload. If
the currently live project board has at least one task, the next confirmed reload overwrites
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
- rebuild the cards by hand and reload a hand-written file.

## Hand-editing rules

Hand-edited files are allowed, but the loader repairs or rejects malformed data:

- invalid JSON is rejected before the board changes;
- a non-board shape (missing `categories`, an empty `categories` array, a missing `tasks` array, or
  tasks without `id`, `title`, `projectID`, `branch`, or `categoryID`) is rejected;
- tasks whose `projectRoot` is a different folder are ignored; a task with no root is kept only when
  its `projectID` matches the selected project;
- duplicate category, tag, or task IDs keep the first occurrence;
- a task with an unknown `categoryID` moves to the first column;
- blank titles fall back to the branch; blank category/tag names get a default;
- invalid colors fall back to the built-in palette;
- duplicate tag IDs and tag IDs that reference missing tags are removed;
- positions are renumbered per project and column;
- missing `version`, `tags`, `tagIDs`, `archived`, and other optional fields get defaults; files
  with `tagsByProject` or `categoriesByProject` are normalized before scoping.

The loader does **not** verify that a task's `projectID`, `projectRoot`, `worktreePath`, or
`sessionID` belongs to a live session. Reload only files you trust.

## RPC contract and trust boundary

The GUI calls the plugin's RPC through the local OpenCode server:

- `nmdra.kanban-desktop.board.load({ directory })` returns `{ path, json }`.
- `nmdra.kanban-desktop.board.save({ directory, json, target? })` returns `{ path, backupPath? }`.
  `target` is `"board"` (default) or `"backup"`.

The RPC performs no authentication of its own beyond the local server's RPC surface. It trusts the
absolute folder supplied by the caller and writes only the fixed filenames there. Any local client
able to call the RPC could therefore write those three filenames into another existing absolute
folder. The plugin's own GUI passes the selected project's board folder.

## Limits

- 5,000,000 bytes per read or write.
- No streaming and no conflict detection in the RPC: the last write wins.
- Reload is project-scoped but is still a replacement, not a merge.
- No import from the Rust TUI's SQLite database; JSON snapshots only.
- No automatic backup for an empty-board reload.
- A task whose `projectRoot` is unknown cannot be exported automatically.
- The file is not encrypted. OS file permissions protect it.

For the user-facing summary, see the README's **Export and reload** section. For test cases, see
[`test-plan.md`](test-plan.md).
