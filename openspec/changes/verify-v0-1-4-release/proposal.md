# Proposal

## Why

v0.1.3 has only been exercised as an in-place update on the main development machine. A clean
install from a release tag, with the plugin removed from the Desktop config and a fresh checkout,
has not been verified. v0.1.4 should close that gap before the next release line is declared.

## What Changes

- Verify a clean install from the v0.1.3 tag in a disposable checkout and config swap.
- Confirm board data, preferences, tags, columns, archive state, session links, and worktree
  references survive the reinstall.
- Check the current `@opencode/plugin` and `@opencode/client` versions and re-pin only if a newer
  Desktop release is available.
- Record macOS and Windows status; do not claim a pass without hardware.
- Record the custom-icon SDK status; keep it blocked until the SDK exposes registration.
- If a product defect is found, fix it in a scoped follow-up before releasing v0.1.4.
- Release v0.1.4 only after the fresh-install pass and the affected gates succeed.

## Capabilities

No spec-level behavior is changing. This is a release-verification and documentation change, so
`.openspec.yaml` sets `skip_specs: true`. If verification uncovers a product defect, that defect
gets its own change or a delta spec instead of being folded into this verification plan.

### New Capabilities

None.

### Modified Capabilities

None.

## Impact

- `~/.config/opencode/opencode.json` is temporarily changed to remove and re-add the plugin.
- Desktop is restarted at least twice.
- `~/.config/ai.opencode.desktop/drafts.sqlite` is read by the plugin; it is backed up before the
  config swap.
- No board schema, plugin storage schema, or task model change is planned.
- Release metadata and docs change only when v0.1.4 is closed.
