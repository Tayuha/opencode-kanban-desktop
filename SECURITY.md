# Security policy

## Supported versions

Only the latest revision of the default branch is supported. The plugin is version-coupled to
OpenCode Desktop 2.3.2 through `@opencode/plugin` and `@opencode/client`; fixes are made against
the current pin. Local/private v0.1.0 builds are supported only from this checkout.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Use the hosting repository's private
security advisory form (GitHub: **Security → Advisories → New draft security advisory**).

Include:

- the commit or version affected, and your OpenCode Desktop version;
- reproduction steps, or a minimal project/worktree/board file that triggers it;
- the impact you expect, and whether the flaw is in this plugin, its build, or an upstream
  dependency.

Expect an acknowledgement within 7 days and a status update within 30. This is a personal project
maintained in spare time; there is no bounty programme.

## Scope

In scope:

- `src/` — the GUI, data layer, live registry, and the server part that declares the plugin id and
  board-file RPC;
- `dist/gui-experimental.cjs` — the shipped bundle must match a fresh build;
- packaging and install steps (`package.json` exports, `vite.config.ts`, the documented global
  `opencode.json` wiring);
- the board-file read/write behavior and its fixed filenames.

Out of scope:

- OpenCode Desktop or the OpenCode server — report those to the OpenCode project;
- vulnerabilities in `@opencode/plugin`, `effect`, `solid-js`, or other upstream packages — report
  them upstream; this repository adopts fixes when available;
- attacks that require a local user who can already edit the checkout, the global OpenCode
  configuration, the plugin bundle, or Desktop's plugin database;
- a user deliberately reloading a board file they do not trust. The loader validates structure but
  does not sandbox the paths stored in task records.

## Architecture and trust boundaries

```
OpenCode Desktop GUI process
  └── plugin GUI (src/gui/*)             board + prefs in Store.global
        ├── SDK data/client              local OpenCode server
        └── RPC client                   nmdra.kanban-desktop.board.{load,save}
Local OpenCode server
  └── plugin server part (src/index.ts, src/server/board-file.ts)
        └── <absolute project directory>/kanban-board*.json
Project filesystem
  └── optional board snapshots and their backups
```

The plugin has no daemon and no listener of its own. The GUI runs in Desktop's renderer/plugin
host. The server part is loaded by the local OpenCode server and exposes the board-file RPC.

Trust boundaries worth naming:

- **Desktop plugin storage** is trusted local state. The per-project board map and preferences are
  `Store.global` values. On this Linux installation they are backed by
  `~/.config/ai.opencode.desktop/drafts.sqlite`. They are not encrypted by the plugin; OS file
  permissions and Desktop's storage protect them.
- **The local OpenCode server** is trusted to provide sessions, projects, messages, worktrees, and
  VCS status. The plugin treats its responses as data, not instructions.
- **The board file is untrusted input.** Reload checks JSON syntax and the board's outer shape,
  scopes it to the selected project folder, then normalizes column sets, tags, colors, positions,
  duplicates, and task tag IDs. It does not verify that a task's `projectID`, `projectRoot`,
  `worktreePath`, or `sessionID` belongs to the selected project or to a live session. Those fields
  are later used as data: opening a task may create a session in its stored `projectRoot`; deleting
  with worktree removal may send its `worktreePath` to the worktree API after confirmation. Reload
  only files you trust.
- **The board-file RPC trusts its caller's directory.** It accepts an absolute directory, checks
  that it exists, and reads/writes only the fixed filenames there. It does not authenticate the
  caller beyond the local server's RPC surface. Any local client able to call the RPC could pass
  another existing absolute directory and create/replace those three filenames. The GUI always
  passes the selected project's board folder (its root unless the user chose one).
- **Exported board files are sensitive.** They contain task titles, notes, branches, worktree
  paths, project roots, and session IDs. Exporting into a git project can leave an untracked or
  modified file. Treat it like project metadata.

## What the plugin can access

Reads:

- `session.list`, `session.active`, `session.get` through the app's data store;
- `message.list` for the recent message page used to find the newest completed todo tool call;
- `vcs.get`, `vcs.base`, `vcs.branch.list`, `vcs.status` for branches and changes;
- `project.list` and the app's synced project data;
- `<project>/kanban-board.json` through `nmdra.kanban-desktop.board.load` (fixed filename,
  5,000,000-byte cap);
- its own plugin storage keys.

Writes:

- `worktree.create`, `worktree.remove`, `worktree.refresh`;
- `session.create`, `session.prompt` (only from explicit task creation/Start agent/auto-prompt
  actions);
- `data.session.sync` to make a session known to the app;
- creating a session, prefilling its composer, opening a session tab (`ctx.tabs.open`);
- `nmdra.kanban-desktop.board.save` writes `<board folder>/kanban-board.json`,
  `kanban-board.json.bak`, or `kanban-board.backup.json` atomically (fixed filenames,
  5,000,000-byte cap);
- its own board and preferences stores;
- the clipboard (`ctx.system.copy`) and the file manager (`ctx.desktop.reveal`) on explicit
  actions;
- app notifications (`ctx.attention.notify`), subject to Desktop's settings.

The board-file RPC reads and writes only those fixed filenames under the supplied absolute
directory. Writes use a temporary file plus rename. Reads reject relative paths, missing files,
non-files, oversized content, invalid JSON, and aborted requests. Writes reject relative or
missing directories, invalid JSON, oversized content, unknown targets, and aborted requests.

## What the plugin does not do

- run a shell, `git`, or any child process;
- kill sessions, agents, or processes;
- use direct `fetch`, WebSocket, HTTP client, telemetry, or external URLs (it uses the SDK clients
  Desktop provides for the local server);
- write message bodies to disk or send them anywhere; it keeps only the parsed todo summary in
  memory;
- read or write files other than the fixed board filenames under an explicitly supplied directory;
- send credentials anywhere, or store credentials of its own;
- execute code, HTML, or styles from a board file. Strings are rendered as text, and colors are
  validated as six-digit hex.

The plugin does request a recent page of messages to find todo tool calls. The SDK response may
contain message content in memory; the plugin parses only todo-shaped tool parts and does not
persist or transmit the rest.

## Controls in place

- Destructive actions use the app's confirm dialogs.
- Deleting a task asks once; worktree removal is a second choice. A failed non-forced removal
  requires a second, explicit force confirmation that shows the server error.
- Deleting a task does not stop its session. Removing a worktree does not delete its branch.
- `Reset board data` has its own confirmation and never removes worktrees or sessions.
- Reload confirms when the selected project's board has any task, writes a pre-reload backup first,
  and cancels if that backup fails.
- Export writes atomically and aborts if the previous file cannot be preserved as `.bak`.
- Reload normalizes imported data and rejects non-board shapes.
- No credentials of its own.
- The committed bundle is rebuilt and checked in CI before release.

## Data locations

- **Board and preferences:** Desktop `Store.global`, backed by
  `~/.config/ai.opencode.desktop/drafts.sqlite` on Linux. In this build they are `state` rows named
  `opencode.global.dat` / `plugin.nmdra.kanban-desktop.boards` and
  `plugin.nmdra.kanban-desktop.prefs`. The older `plugin.nmdra.kanban-desktop.board` row is read
  once during migration and then kept empty. A backup of that database restores all Desktop plugin
  storage, not only Kanban.
- **Exported snapshots:** `<board folder>/kanban-board.json`, with
  `kanban-board.json.bak` and `kanban-board.backup.json` as described in
  [`docs/board-file.md`](docs/board-file.md). The board folder is the project root unless the user
  chose another folder for that project.
- **Worktrees, branches, sessions, messages:** managed by OpenCode, outside the plugin.

## Handling a report

Confirmed issues are fixed on the default branch with tests where practical, a new tag, and a note
in the commit message. Reporters are credited unless they ask otherwise.
