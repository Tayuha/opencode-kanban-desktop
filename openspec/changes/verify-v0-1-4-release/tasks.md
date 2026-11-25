# Tasks

## 1. Preflight and backups

- [ ] 1.1 Record the current checkout path, `git describe --tags --exact-match`, and `node -e "console.log(require('./package.json').version)"`; verify they show the expected v0.1.3 install.
- [ ] 1.2 Export each project board from the Kanban panel and confirm the files exist in the project roots.
- [ ] 1.3 Quit Desktop, copy `~/.config/ai.opencode.desktop/drafts.sqlite` to a timestamped backup, and verify the backup opens with `sqlite3 <backup> "select count(*) from state"`.
- [ ] 1.4 Copy `~/.config/opencode/opencode.json` to a timestamped backup and record the current Kanban package path; verify the backup contains exactly one `nmdra.kanban-desktop` entry.

## 2. Clean checkout

- [ ] 2.1 Clone the v0.1.3 tag into a disposable directory and run `npm ci`; verify `git describe --tags --exact-match` is `v0.1.3` and `dist/gui-experimental.cjs` exists.
- [ ] 2.2 Run `npm run typecheck` and `npm test` in the disposable checkout; verify 138 tests pass.
- [ ] 2.3 Compare the disposable checkout's committed `dist/gui-experimental.cjs` with a fresh `npm run build`; verify the files are byte-identical.

## 3. Clean install

- [ ] 3.1 Remove the Kanban entry from the active `opencode.json`, fully quit Desktop, restart, and verify `opencode plugin list` and Settings → Extensions → Plugins no longer show `nmdra.kanban-desktop`.
- [ ] 3.2 Add one Kanban entry pointing at the disposable checkout, restart Desktop, and verify `opencode plugin list` shows `nmdra.kanban-desktop` at that path.
- [ ] 3.3 Confirm there is no second Kanban checkout, symlink, or duplicate entry under `~/.config/opencode`; verify `grep -R "kanban-desktop" ~/.config/opencode` returns only the intended entry and backup files.

## 4. Persistence and behavior

- [ ] 4.1 Open the Kanban panel on each existing project and compare the cards, columns, tags, archive state, and counts with the pre-install notes; verify no data is missing.
- [ ] 4.2 Verify preferences survive: alignment, width, density, poll interval, open mode, notifications, pill, default column, and initial prompt.
- [ ] 4.3 Verify linked sessions, pinned sessions, worktree paths, and archived cards still open or restore as expected.
- [ ] 4.4 Create a test task in a git project, open its session, and delete it; verify the task workflow and delete/keep worktree choice still work.
- [ ] 4.5 Restore the original config path, restart Desktop, and verify the development checkout still loads with the same board state.

## 5. Upstream and platform status

- [ ] 5.1 Run `npm view @opencode/plugin version` and `npm view @opencode/client version`; verify the result is recorded and re-pin only if a newer Desktop release exists.
- [ ] 5.2 Inspect the 2.3.2 SDK for custom icon registration; verify the result is recorded and keep the custom-icon follow-up blocked if only the icon catalog is exposed.
- [ ] 5.3 Record macOS and Windows as unavailable or run the smoke test if hardware is available; verify the release notes do not claim an unverified platform pass.

## 6. Defects and release decision

- [ ] 6.1 If any check fails, capture the exact error, affected file or config, and reproduction steps; verify the failure is recorded before changing code.
- [ ] 6.2 Fix any product defect in a scoped change with tests and documentation; verify the affected checks pass again.
- [ ] 6.3 Decide with the user whether v0.1.4 is a docs/verification patch or stays open for blocked platform and icon work; verify the decision is recorded on the release card.

## 7. Release and cleanup

- [ ] 7.1 If closing v0.1.4, update `CHANGELOG.md`, `package.json`, and version references; verify the version is `0.1.4` and the changelog has a dated section.
- [ ] 7.2 Run `npm run typecheck`, `npm test`, a deterministic `npm run build`, and `npm audit --audit-level=high`; verify all gates pass.
- [ ] 7.3 Commit the release, create the annotated `v0.1.4` tag, and push `main` plus the tag; verify `git ls-remote --tags origin v0.1.4` returns the tag.
- [ ] 7.4 Remove the disposable checkout and restore the normal config path; verify Desktop still loads the plugin and the board is intact.

## Workflow follow-up

- Validate this OpenSpec plan with the user before implementation.
- After validation, create the corresponding tasks in the board's Todo column.
- Archive the OpenSpec change only after the release decision and any scoped fixes are complete.
