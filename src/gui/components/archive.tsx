import { For, Show } from "solid-js"
import { usePlugin, type MountedSession } from "@opencode/plugin/gui"
import type { definition } from "../definition.ts"
import type { KanbanServices } from "../api.ts"
import type { Task } from "../model/types.ts"
import { visibleArchive } from "../model/select.ts"
import { hasManagedWorktree, taskTags } from "../model/board.ts"
import { baseName, timeAgo } from "../format.ts"

type ArchiveProps = {
  session: MountedSession
  projectID: string
  serverID: string
  query: string
  tagIDs: readonly string[]
  services: KanbanServices
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function ArchiveView(props: ArchiveProps) {
  const ctx = usePlugin<typeof definition>()
  const ui = ctx.ui
  const board = () => ctx.stores.board.value
  const tasks = () => visibleArchive(board(), props.projectID, props.query, props.tagIDs, props.serverID)
  const locationOf = (task: Task) =>
    task.directory ?? (hasManagedWorktree(task) ? task.worktreePath : undefined)

  const remove = async (task: Task, removeWorktree: boolean) => {
    const ok = await ctx.dialogs.confirm({
      title: ctx.t("task.delete.title"),
      description: ctx.t("task.delete.description", { title: task.title }),
      confirm: ctx.t("action.delete"),
      danger: true,
    })
    if (!ok) return
    try {
      await props.services.deleteTask(props.session, task, removeWorktree)
    } catch (error) {
      ctx.toast.show({
        variant: "error",
        title: ctx.t("task.error.deleteWorktree"),
        description: errorText(error),
      })
    }
  }

  return (
    <div class="kb-archive">
      <Show
        when={tasks().length > 0}
        fallback={
          <div class="kb-empty">
            <span class="kb-empty-title">
              {props.query.trim()
                ? ctx.t("archive.empty.search")
                : props.tagIDs.length > 0
                  ? ctx.t("archive.empty.tags")
                  : ctx.t("archive.empty")}
            </span>
          </div>
        }
      >
        <For each={tasks()}>
          {(task) => (
            <div class="kb-archive-row">
              <div class="kb-archive-main">
                <span class="kb-archive-title">{task.title}</span>
                <span class="kb-archive-meta">
                  {locationOf(task) ? baseName(locationOf(task)!) : task.projectName} ·{" "}
                  {ctx.t("archive.archivedAt", {
                    time: timeAgo(task.archivedAt ?? task.updatedAt, Date.now(), ctx.locale.locale()),
                  })}
                </span>
                <span class="kb-archive-meta kb-mono">{task.branch}</span>
                <Show when={taskTags(board(), task).length > 0}>
                  <div class="kb-card-tags">
                    <For each={taskTags(board(), task)}>
                      {(tag) => (
                        <span class="kb-tag" style={`--kb-tag:${tag.color}`}>
                          {tag.name}
                        </span>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
              <ui.Button
                variant="ghost"
                size="small"
                icon="arrow-undo-down"
                onClick={() => props.services.restoreTask(task)}
              >
                {ctx.t("action.restore")}
              </ui.Button>
              <ui.Menu
                label={task.title}
                items={[
                  {
                    label: ctx.t("archive.delete"),
                    icon: "trash",
                    onSelect: () => void remove(task, false),
                  },
                  ...(hasManagedWorktree(task)
                    ? [
                        {
                          label: `${ctx.t("archive.delete")} · ${ctx.t("detail.worktree")}`,
                          icon: "outline-worktree" as const,
                          onSelect: () => void remove(task, true),
                        },
                      ]
                    : []),
                ]}
              />
            </div>
          )}
        </For>
      </Show>
    </div>
  )
}
