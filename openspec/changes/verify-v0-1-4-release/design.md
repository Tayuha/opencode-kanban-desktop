# Design

## Context

See `proposal.md` — Why. The current install is an upgrade-in-place checkout referenced by absolute
path from `~/.config/opencode/opencode.json`. The board and preferences live in Desktop plugin
storage, not in the checkout. v0.1.3 is the current release tag and the intended clean-install
baseline.

The verification machine is Linux with OpenCode Desktop 2.3.2. macOS and Windows are not available
on this machine.

## Goals / Non-Goals

**Goals:**

- Prove the plugin installs and loads from a clean checkout and a clean config entry.
- Prove board data, preferences, tags, columns, archive state, session links, and worktree
  references survive the reinstall.
- Produce a rollback path that restores the working install without losing board data.
- Record the re-pin, macOS/Windows, and custom-icon status for the v0.1.4 release decision.

**Non-Goals:**

- No board schema, plugin storage schema, or task model change.
- No new features or UI changes.
- No macOS or Windows pass without hardware.
- No custom icon implementation while the SDK exposes only the icon catalog.

## Decisions

### Disposable checkout instead of mutating the working checkout

Use a fresh clone of the v0.1.3 tag in a separate directory (for example
`/tmp/opencode/kanban-v0.1.3-fresh`). Point the config at it during the test, then restore the
development checkout.

Why: it proves a clean checkout with no local edits, no untracked files, and no stale
`node_modules`. Alternative considered: `git clean -xdf` in the existing checkout, which is faster
but risks deleting local work and does not prove a fresh clone.

### Remove the config entry, then re-add it

Back up `~/.config/opencode/opencode.json`, remove the Kanban entry, fully quit Desktop, restart,
confirm the plugin is gone, then re-add the entry pointing at the disposable checkout and restart
again.

Why: adding a second entry or relying on a symlink would not prove a clean install and can create
duplicate plugin entries. Alternative considered: install into `~/.config/opencode/plugins/`, which
is not the supported install path for this checkout and is explicitly discouraged.

### Back up plugin storage and exported boards

Before changing config, copy `~/.config/ai.opencode.desktop/drafts.sqlite` to a timestamped file and
export the boards. Restore the backup if the clean install cannot load the existing data.

Why: the plugin storage is the authoritative board, and the fresh install should not be allowed to
destroy it. Alternative considered: relying only on exported `kanban-board.json` files, which do
not contain preferences and are project-scoped.

### Use the committed `dist`

The v0.1.3 tag contains `dist/gui-experimental.cjs`. Do not run `npm run build` during the clean
install unless the tag is missing `dist`; `npm ci` is enough.

Why: the release artifact is the committed bundle; rebuilding during verification would test a
different artifact. Alternative considered: build from source to prove reproducibility, which is
covered by the release gates and the fresh-clone build comparison instead.

## Risks / Trade-offs

- **Removing the config entry leaves Desktop without the plugin until re-added** → Keep the config
  backup and restore it if the re-add fails.
- **Desktop caches the plugin bundle** → Fully quit the app, not just the window, between config
  changes; verify `opencode plugin list` and Settings → Extensions → Plugins.
- **A stale second path or symlink loads the old bundle** → Search `~/.config/opencode` for
  `kanban-desktop`; keep exactly one absolute package path.
- **Board data appears missing after the swap** → Check the project switcher and filters first, then
  restore `drafts.sqlite`; do not reinstall over the live storage.
- **macOS/Windows cannot be exercised here** → Record them as unverified and do not claim a pass.
- **Custom icons remain unavailable** → Keep the follow-up blocked; do not add a workaround.

## Migration Plan

1. Back up the config and `drafts.sqlite`; export the boards.
2. Clone the v0.1.3 tag to a disposable path; run `npm ci`; confirm `dist` exists.
3. Remove the Kanban config entry; fully quit Desktop; restart; confirm the plugin is absent.
4. Re-add the entry pointing at the disposable checkout; restart.
5. Verify plugin list, settings, boards, tags, columns, archive, session links, and preferences.
6. If the pass succeeds, record it and decide the v0.1.4 release. If it fails, restore the config and
   `drafts.sqlite`, then report the failure before changing code.

Rollback is the same backup restore plus pointing the config back at the original checkout.

## Open Questions

- Are macOS or Windows machines available for a smoke test this cycle?
- Does Desktop 2.3.2 still expose only the icon catalog, or has a newer SDK added custom icon
  registration?
- If no code changes are found, is v0.1.4 a docs/verification patch or should it stay open until the
  platform and re-pin items are resolved?
