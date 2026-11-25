# README screenshots (v0.1.3)

Required files, saved in this folder:

| File | View |
|---|---|
| `board.png` | Board with columns, cards, tags, status dots, and counts |
| `detail.png` | Detail view of a real worktree/session task with status, todos, and changes |
| `task-dialog.png` | New-task dialog including the lower worktree/open/prompt controls |
| `composer-pill.png` | Composer pill showing running tasks |
| `edit-task.png` | Optional: edit-task dialog |

## General rules

- Use the **current v0.1.2+ UI**. It has no task **Existing folder** field and no board-folder icon.
- PNG only. Crop to the panel, dialog, or relevant window area. Keep the text readable.
- Do not include API keys, tokens, private notes, or sensitive paths. Use sample project names or
  the plugin repository. Avoid the temporary `financial-analyst` folder.
- Use one theme and one zoom level across the set.
- No cursor, tooltip, toast, or hover state unless the image needs it.
- The README image links will be added after the files exist.

## Per-image checklist

### `board.png`

- Full panel width or full board dialog.
- Three or four columns with several cards, not one nearly empty column.
- At least one tag visible, plus status dots and column counts.
- Good candidate: the working project board with a mix of Todo / In progress / Done cards.

### `detail.png`

- A task that uses a **real worktree and a real session**, not the screenshot task itself.
- Show:
  - Project, Branch, Base, Worktree
  - Status and cost
  - Todos section, with a real todo list if possible
  - Changes section
- Confirm the labels read **Created** and **Updated**, not literal `{{time}}`.
- Confirm the Changes empty copy reads **No uncommitted changes.** when nothing is changed.

### `task-dialog.png`

- Open **New task** with **Create a git worktree** on for a git project.
- Include:
  - Title, project, branch, base, column, tags, notes
  - The worktree switch
  - Open a session after creating
  - Send the initial prompt automatically
  - Initial prompt textarea
- The dialog scrolls; scroll to the lower controls before capturing. It is fine if the title field
  is above the crop, as long as the worktree/open/prompt controls are visible.
- The **Existing folder** field and board-folder icon must not appear.

### `composer-pill.png`

- Capture the pill above the composer in a session.
- Preferred: at least one task is **running**, so the pill shows “N running”.
- Include a little of the composer below the pill so the context is clear.
- If nothing is running, a “N tasks” pill is acceptable, but running is the better README image.

### `edit-task.png` (optional)

- Edit dialog for a worktree task.
- Show the locked branch/worktree copy and the editable title, column, tags, and notes.

## Capturing on Linux

Use the desktop’s screenshot tool:

- GNOME: `gnome-screenshot -a` or Shift+Print
- KDE: Spectacle, rectangular region
- Sway/Hyprland: the compositor’s screenshot binding or a tool such as `grim`/`slurp`
- Fallback: `ffmpeg -f x11grab` only if the normal tool is unavailable

CLI capture may fail on Wayland; the desktop’s screenshot shortcut is the reliable path.

## Handoff

After saving the files:

```bash
cd /home/tayuha/Projects/opencode-plugins-creation/opencode-kanban-desktop
file assets/*.png
ls -l assets
```

Tell me the filenames are in place. I’ll:

1. Add the images to the README with alt text and captions.
2. Verify no outdated folder pickers or placeholder labels are visible.
3. Close the screenshot card.
4. Include the screenshots in the v0.1.3 release when you close it.
