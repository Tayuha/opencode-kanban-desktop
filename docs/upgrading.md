# Upgrading and releasing the plugin

This is the operating plan for updates to the local/private plugin. There is no npm release: the
installed plugin is a git checkout referenced by absolute path in the global `opencode.json`.

## Versioning

Use semantic versions and annotated tags:

| Change | Version |
|---|---|
| Bug fix, documentation-only patch, no data migration | `v0.1.x` patch |
| New feature, settings, or compatible board schema addition | `v0.2.0` minor |
| Breaking board schema, configuration, or Desktop API change | `v1.0.0` or a new major |

Every release updates `package.json`, `package-lock.json`, `CHANGELOG.md`, and the README version.
The tag is immutable; never move a published tag. Create a new patch instead.

Current line:

- `v0.1.0` — first local/private release.
- `v0.1.1` — project-list duplicate fix; no board data migration.
- `v0.1.2` (staged, untagged) — per-project boards and project-scoped board files; one-time
  split of the v0.1.1 global board.

## Release process

1. **Preflight**
   - `npm run typecheck`
   - `npm test` (currently 136 cases)
   - `npm run build`, then build again and compare the bundles byte for byte
   - `npm audit --audit-level=high`
   - Run the affected manual cases in [`test-plan.md`](test-plan.md) and the release gates in
     [`release-checklist.md`](release-checklist.md).
2. **Version and notes**
   - `npm version X.Y.Z --no-git-tag-version`
   - Add a `CHANGELOG.md` entry with fixes, upgrade notes, and any migration.
   - Update the README release scope and the docs' version references.
3. **Commit and tag**
   ```bash
   git add -A
   git commit -m "Release vX.Y.Z"
   git tag -a vX.Y.Z -m "opencode-kanban-desktop vX.Y.Z"
   git push origin main
   git push origin vX.Y.Z
   ```
4. **Publish the update**
   - Create a GitHub Release from the tag, using the changelog entry.
   - Do not publish to npm; `package.json` stays `private: true`.
5. **Keep rollback material**
   - Keep the previous tag and checkout available.
   - Do not rewrite a released tag.

## Upgrade an existing install

The user upgrades the same checkout; the `opencode.json` plugin path does not change.

1. Fully quit OpenCode Desktop.
2. From the configured checkout:

   ```bash
   git fetch --tags
   git checkout vX.Y.Z
   npm ci
   ```

   If the tag contains the committed `dist/`, no build is needed. Build only when upgrading from a
   branch or a tag without `dist/`:

   ```bash
   npm run build
   ```

3. Reopen Desktop.
4. Verify:
   - **Settings → Extensions → Plugins** lists `nmdra.kanban-desktop`, enabled.
   - `opencode plugin list` shows the same checkout path.
   - The board opens and keeps its tasks, columns, tags, links, and preferences.

Do not use `opencode plugin update` for a local-path install; it manages package/git specifiers,
not this checkout. Use `git checkout` + `npm ci` + restart.

### Notebook or second machine

Install from the tag as a fresh checkout:

```bash
git clone --branch vX.Y.Z https://github.com/Tayuha/opencode-kanban-desktop.git
cd opencode-kanban-desktop
npm ci
```

Add that checkout's absolute path to the machine's `~/.config/opencode/opencode.json`, then restart
Desktop. Boards are per project folder; use **Export board** / **Reload board** or a controlled
`drafts.sqlite` copy to move data.

## Data and migration

The board and preferences live in Desktop's plugin storage, not in the git checkout. A normal
upgrade replaces code only.

- **Patch releases** should require no data migration.
- **Minor releases** may add optional board fields; `normalizeBoard` repairs old data at startup.
- **Major releases** must document export/backup and any required migration.
- Before a risky upgrade, export each project board you care about and keep `kanban-board.json.bak`
  and a copy of `~/.config/ai.opencode.desktop/drafts.sqlite` with Desktop closed.
- Auto-export and auto-reload mean the project-root `kanban-board.json` is also a current snapshot;
  it is not the authoritative store.

`v0.1.0 → v0.1.1` requires no migration. Project-list deduplication is a UI fix; the duplicate
project records in OpenCode's database remain but are hidden.

`v0.1.1 → v0.1.2` performs a one-time board split:

- The old `plugin.nmdra.kanban-desktop.board` row is normalized and grouped by each task's
  `projectRoot` (or `id:<projectID>` when no root was stored).
- Each group becomes one board under `plugin.nmdra.kanban-desktop.boards`, keyed by the canonical
  project folder.
- The old row is reset to the empty default and is never migrated again.
- With auto-export on, the upgrade writes the selected project's board once, so its old
  `kanban-board.json` becomes project-scoped promptly; the previous file is kept as `.bak`.
- Each project's `kanban-board.json` is now project-scoped. A legacy whole-installation file is
  narrowed to the selected project on reload; tasks for other folders are ignored.

Before upgrading, export the current board and keep a closed-Desktop copy of `drafts.sqlite`. The
old global `kanban-board.json` is a useful fallback for the project it belongs to, but it is no
longer the shape new exports produce.

## Rollback

1. Quit Desktop.
2. `git checkout vPREVIOUS`
3. `npm ci`
4. Reopen Desktop.

If board data was damaged, restore `kanban-board.json` and reload, or restore the backed-up
`drafts.sqlite` with Desktop closed. Worktrees, branches, and sessions are not removed by an
upgrade or rollback.

## Desktop compatibility

The plugin pins `@opencode/plugin` and `@opencode/client` to the tested Desktop version (2.3.2).
When Desktop updates:

1. Re-pin both packages to the new version.
2. `npm install`, `npm run typecheck`, `npm test`, `npm run build`.
3. Run the GUI acceptance and worktree/session checks.
4. Release a new version using this process.

Linux is the exercised platform. macOS and Windows need dedicated smoke tests.

## Communication checklist

- [ ] `CHANGELOG.md` entry
- [ ] README release scope and upgrade link
- [ ] GitHub Release from the tag
- [ ] Board card for the release/update
- [ ] Notebook/second-machine install verified
- [ ] Previous tag kept for rollback
