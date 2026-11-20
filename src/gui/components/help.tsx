import { usePlugin } from "@opencode/plugin/gui"
import type { definition } from "../definition.ts"

export function HelpView() {
  const ctx = usePlugin<typeof definition>()

  const rows: { keys: readonly string[]; text: string }[] = [
    { keys: ctx.keybinds.keybind(`${ctx.id}.open`), text: ctx.t("help.key.panel") },
    { keys: ctx.keybinds.keybind(`${ctx.id}.board`), text: ctx.t("help.key.dialog") },
    { keys: ["N"], text: ctx.t("help.key.n") },
    { keys: ["E"], text: ctx.t("help.key.e") },
    { keys: ["A"], text: ctx.t("help.key.a") },
    { keys: ["V"], text: ctx.t("help.key.v") },
    { keys: ["Shift", "V"], text: ctx.t("help.key.shiftv") },
    { keys: ["Enter"], text: ctx.t("help.key.enter") },
    { keys: ["/"], text: ctx.t("help.key.slash") },
    { keys: ["C"], text: ctx.t("help.key.c") },
    { keys: ["↑", "↓", "←", "→"], text: ctx.t("help.key.arrows") },
    { keys: ["Shift", "↑↓←→"], text: ctx.t("help.key.shiftarrows") },
    { keys: ["Esc"], text: ctx.t("help.key.escape") },
  ]

  return (
    <div class="kb-help">
      <div class="kb-section">
        <span class="kb-section-title">{ctx.t("help.title")}</span>
        <span class="kb-note">{ctx.t("help.intro")}</span>
      </div>

      <div class="kb-section">
        <span class="kb-section-title">{ctx.t("help.keys")}</span>
        <div class="kb-list">
          {rows.map((row) => (
            <div class="kb-help-row">
              <span>
                {row.keys.length > 0 ? <ctx.ui.Keybind keys={row.keys} /> : <kbd>—</kbd>}
              </span>
              <span>{row.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div class="kb-section">
        <span class="kb-section-title">{ctx.t("help.statuses")}</span>
        <div class="kb-list">
          <div class="kb-row">
            <span class="kb-dot" data-status="running" />
            <span class="kb-row-main">{ctx.t("help.status.running")}</span>
          </div>
          <div class="kb-row">
            <span class="kb-dot" data-status="idle" />
            <span class="kb-row-main">{ctx.t("help.status.idle")}</span>
          </div>
          <div class="kb-row">
            <span class="kb-dot" data-status="none" />
            <span class="kb-row-main">{ctx.t("help.status.none")}</span>
          </div>
        </div>
      </div>

      <div class="kb-section">
        <span class="kb-note">{ctx.t("help.todos")}</span>
        <span class="kb-note">{ctx.t("help.worktrees")}</span>
        <span class="kb-note">{ctx.t("help.storage")}</span>
        <span class="kb-note">{ctx.t("help.reload")}</span>
      </div>
    </div>
  )
}
