import { For, Show, createSignal } from "solid-js"
import { usePlugin } from "@opencode/plugin/gui"
import type { definition } from "../definition.ts"
import type { KanbanServices } from "../api.ts"
import type { Board, LiveTask, ProjectRow, Task, TaskStatus } from "../model/types.ts"
import {
  categories,
  COLORS,
  deleteCategory,
  hasManagedWorktree,
  moveCategory,
  moveTask,
  taskTags,
  tasksFor,
  updateCategory,
} from "../model/board.ts"
import { statusLabelKey, visibleTasks } from "../model/select.ts"
import { Empty, Progress, StatusDot } from "../components.tsx"
import { baseName, formatCost } from "../format.ts"
import type { MountedSession } from "@opencode/plugin/gui"

type BoardViewProps = {
  session: MountedSession
  projectID: string
  serverID: string
  projects: ProjectRow[]
  query: string
  selectedID: string | undefined
  tagIDs: readonly string[]
  onToggleTag(tagID: string): void
  onSelect(taskID: string | undefined): void
  onNewTask(categoryID: string): void
  onEdit(task: Task): void
  services: KanbanServices
  state: () => { tasks: Record<string, LiveTask> } | undefined
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function BoardView(props: BoardViewProps) {
  const ctx = usePlugin<typeof definition>()
  const ui = ctx.ui
  const board = () => ctx.stores.board.value
  const prefs = () => ctx.stores.prefs.value
  const compact = () => (prefs().density ?? "comfortable") === "compact"
  const [dragging, setDragging] = createSignal<string | undefined>()
  const [over, setOver] = createSignal<string | undefined>()

  const save = (next: Board) => {
    ctx.stores.board.set(next)
    props.services.live.invalidate(props.session.server.id, props.projectID)
  }

  const liveOf = (task: Task): LiveTask | undefined => props.state()?.tasks[task.id]
  const columns = () => categories(board(), props.projectID)
  const defaultCategory = () => {
    const list = columns()
    const preferred = prefs().defaultCategoryID
    return list.find((category) => category.id === preferred)?.id ?? list[0]?.id ?? "todo"
  }
  const colorOf = (task: Task): string =>
    columns().find((category) => category.id === task.categoryID)?.color ?? COLORS[0]!

  const hasMatches = () =>
    columns().some(
      (category) =>
        visibleTasks(board(), props.projectID, category.id, props.query, props.tagIDs, props.serverID).length > 0,
    )
  const showBoard = () => hasMatches()

  const emptyTitle = () => {
    if (props.query.trim()) return ctx.t("board.empty.search")
    if (props.tagIDs.length > 0) return ctx.t("board.empty.tags")
    return ctx.t("board.empty.title")
  }
  const emptyBody = () => {
    if (props.query.trim() || props.tagIDs.length > 0) return undefined
    return ctx.t("board.empty.body")
  }

  const move = (taskID: string, categoryID: string, index: number) => {
    save(moveTask(board(), taskID, categoryID, index))
  }

  const drop = (event: DragEvent, categoryID: string, index?: number) => {
    event.preventDefault()
    event.stopPropagation()
    const id = event.dataTransfer?.getData("text/plain") || dragging()
    setOver(undefined)
    setDragging(undefined)
    if (!id) return
    move(id, categoryID, index ?? tasksFor(board(), props.projectID, categoryID, false, props.serverID).length)
  }

  const renameColumn = async (categoryID: string, current: string) => {
    const name = await ctx.dialogs.prompt({
      title: ctx.t("column.rename"),
      value: current,
      submit: ctx.t("action.save"),
    })
    if (name) save(updateCategory(board(), props.projectID, categoryID, { name }))
  }

  const recolorColumn = async (categoryID: string, current: string) => {
    const color = await ctx.dialogs.select<string>({
      title: ctx.t("column.color"),
      current,
      options: COLORS.map((value) => ({ title: value, value, group: ctx.t("column.color") })),
    })
    if (color) save(updateCategory(board(), props.projectID, categoryID, { color }))
  }

  const removeColumn = async (categoryID: string, name: string) => {
    if (columns().length <= 1) {
      ctx.toast.show({ variant: "error", title: ctx.t("columns.title"), description: ctx.t("column.last") })
      return
    }
    const ok = await ctx.dialogs.confirm({
      title: ctx.t("column.delete.title"),
      description: `${name}. ${ctx.t("column.delete.description")}`,
      confirm: ctx.t("action.delete"),
      danger: true,
    })
    if (ok) save(deleteCategory(board(), props.projectID, categoryID))
  }

  const archive = (task: Task) => {
    props.services.archiveTask(task)
    if (props.selectedID === task.id) props.onSelect(undefined)
  }

  const removeTask = async (task: Task) => {
    const ok = await ctx.dialogs.confirm({
      title: ctx.t("task.delete.title"),
      description: ctx.t("task.delete.description", { title: task.title }),
      confirm: ctx.t("action.delete"),
      danger: true,
    })
    if (!ok) return

    let removeWorktree = false
    if (hasManagedWorktree(task)) {
      removeWorktree = await ctx.dialogs.confirm({
        title: ctx.t("task.delete.worktree"),
        description: ctx.t("task.delete.worktree.description"),
        confirm: ctx.t("action.delete"),
        danger: true,
      })
    }

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
    <Show
      when={showBoard()}
      fallback={
        <Empty title={emptyTitle()} body={emptyBody()}>
          <Show when={!props.query.trim() && props.tagIDs.length === 0}>
            <div>
              <ui.Button
                variant="neutral"
                size="small"
                icon="plus"
                onClick={() => props.onNewTask(defaultCategory())}
              >
                {ctx.t("action.newTask")}
              </ui.Button>
            </div>
          </Show>
        </Empty>
      }
    >
      <div
        class="kb-board"
        data-align={prefs().alignment}
        data-density={compact() ? "compact" : "comfortable"}
        style={`--kb-col-width:${prefs().columnWidth}px`}
        role="list"
        aria-label={ctx.t("panel.title")}
      >
      <For each={columns()}>
        {(category) => {
          const tasks = () =>
            visibleTasks(board(), props.projectID, category.id, props.query, props.tagIDs, props.serverID)
          const index = () => columns().findIndex((item) => item.id === category.id)
          return (
            <section
              class="kb-col"
              style={`--kb-accent:${category.color}`}
              data-over={over() === category.id ? "true" : undefined}
              role="listitem"
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer && (event.dataTransfer.dropEffect = "move")
                setOver(category.id)
              }}
              onDragLeave={() => {
                if (over() === category.id) setOver(undefined)
              }}
              onDrop={(event) => drop(event, category.id)}
            >
              <header class="kb-col-head">
                <span class="kb-col-dot" aria-hidden="true" />
                <span class="kb-col-title" title={category.name}>
                  {category.name}
                </span>
                <span class="kb-col-count">{tasks().length}</span>
                <ui.Menu
                  label={category.name}
                  items={[
                    {
                      label: ctx.t("column.rename"),
                      icon: "edit",
                      onSelect: () => void renameColumn(category.id, category.name),
                    },
                    {
                      label: ctx.t("column.color"),
                      icon: "appearance",
                      onSelect: () => void recolorColumn(category.id, category.color),
                    },
                    {
                      label: ctx.t("action.moveUp"),
                      icon: "arrow-up",
                      disabled: index() === 0,
                      onSelect: () => save(moveCategory(board(), props.projectID, category.id, -1)),
                    },
                    {
                      label: ctx.t("action.moveDown"),
                      icon: "arrow-down-to-line",
                      disabled: index() === columns().length - 1,
                      onSelect: () => save(moveCategory(board(), props.projectID, category.id, 1)),
                    },
                    { type: "separator" },
                    {
                      label: ctx.t("column.delete"),
                      icon: "trash",
                      disabled: columns().length <= 1,
                      onSelect: () => void removeColumn(category.id, category.name),
                    },
                  ]}
                />
                <button
                  type="button"
                  class="kb-col-add"
                  aria-label={ctx.t("column.add", { column: category.name })}
                  title={ctx.t("action.newTask")}
                  onClick={() => props.onNewTask(category.id)}
                >
                  +
                </button>
              </header>

              <div class="kb-col-body">
                <For each={tasks()}>
                  {(task) => {
                    const live = () => liveOf(task)
                    return (
                      <div
                        class="kb-card"
                        style={`--kb-accent:${colorOf(task)}`}
                        title={compact() ? `${task.title}\n${task.branch}` : undefined}
                        draggable={true}
                        data-selected={props.selectedID === task.id ? "true" : undefined}
                        data-dragging={dragging() === task.id ? "true" : undefined}
                        role="button"
                        tabIndex={0}
                        aria-pressed={props.selectedID === task.id}
                        onDragStart={(event) => {
                          setDragging(task.id)
                          event.dataTransfer?.setData("text/plain", task.id)
                          if (event.dataTransfer) event.dataTransfer.effectAllowed = "move"
                        }}
                        onDragEnd={() => {
                          setDragging(undefined)
                          setOver(undefined)
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          const full = tasksFor(board(), props.projectID, category.id, false, props.serverID)
                          const at = full.findIndex((item) => item.id === task.id)
                          drop(event, category.id, at < 0 ? full.length : at)
                        }}
                        onClick={() => props.onSelect(task.id)}
                        onDblClick={() => {
                          props.onSelect(task.id)
                          void props.services.openTask(props.session, task)
                        }}
                        onKeyDown={(event) => {
                          if (event.target !== event.currentTarget) return
                          if (event.key === "Enter") {
                            event.preventDefault()
                            props.onSelect(task.id)
                            void props.services.openTask(props.session, task)
                          }
                          if (event.key === " ") {
                            event.preventDefault()
                            props.onSelect(task.id)
                          }
                        }}
                      >
                        <span class="kb-card-status">
                          <StatusDot
                            status={live()?.status ?? ("none" as TaskStatus)}
                            label={ctx.t(statusLabelKey(live()?.status ?? "none"))}
                          />
                        </span>
                        <div class="kb-card-head">
                          <span class="kb-card-title">{task.title}</span>
                          <span class="kb-card-menu" draggable={false} onDragStart={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                            <ui.Menu
                              label={task.title}
                              items={[
                                {
                                  label: task.sessionID || live()?.sessionID ? ctx.t("action.openSession") : ctx.t("action.open"),
                                  icon: "terminal",
                                  onSelect: () => void props.services.openTask(props.session, task),
                                },
                                {
                                  label: ctx.t("action.newSession"),
                                  icon: "new-session",
                                  onSelect: () => void props.services.openTask(props.session, task, "new"),
                                },
                                { type: "separator" },
                                {
                                  label: ctx.t("action.linkCurrent"),
                                  icon: "link",
                                  onSelect: () => void props.services.linkTaskToCurrent(props.session, task),
                                },
                                {
                                  label: ctx.t("action.linkSession"),
                                  icon: "link",
                                  onSelect: () => void props.services.linkTaskSession(props.session, task),
                                },
                                ...(task.sessionID
                                  ? [
                                      {
                                        label: ctx.t("action.unlinkSession"),
                                        icon: "xmark-small" as const,
                                        onSelect: () => props.services.unlinkTaskSession(task),
                                      },
                                    ]
                                  : []),
                                {
                                  label: ctx.t("action.edit"),
                                  icon: "edit",
                                  onSelect: () =>
                                    props.services.openTaskDialog(props.session, props.projectID, task),
                                },
                                {
                                  label: ctx.t("action.archive"),
                                  icon: "archive",
                                  onSelect: () => archive(task),
                                },
                                { type: "separator" },
                                {
                                  label: ctx.t("action.delete"),
                                  icon: "trash",
                                  onSelect: () => void removeTask(task),
                                },
                              ]}
                            />
                          </span>
                        </div>

                        <Show when={taskTags(board(), task).length > 0}>
                          <div class="kb-card-tags">
                            <For each={taskTags(board(), task).slice(0, 3)}>
                              {(tag) => (
                                <button
                                  type="button"
                                  class="kb-tag"
                                  style={`--kb-tag:${tag.color}`}
                                  draggable={false}
                                  data-active={props.tagIDs.includes(tag.id) ? "true" : undefined}
                                  aria-pressed={props.tagIDs.includes(tag.id)}
                                  onDragStart={(event) => event.stopPropagation()}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    props.onToggleTag(tag.id)
                                  }}
                                >
                                  {tag.name}
                                </button>
                              )}
                            </For>
                            <Show when={taskTags(board(), task).length > 3}>
                              <span class="kb-tag kb-tag-more">
                                +{taskTags(board(), task).length - 3}
                              </span>
                            </Show>
                          </div>
                        </Show>

                        <div class="kb-card-line">
                          <ui.Icon name="branch" size="small" />
                          <span class="kb-card-branch" title={task.branch}>
                            {task.branch}
                          </span>
                        </div>

                        <Show when={hasManagedWorktree(task)}>
                          <div class="kb-card-line">
                            <ui.Icon name="outline-worktree" size="small" />
                            <span title={task.worktreePath}>{baseName(task.worktreePath)}</span>
                          </div>
                        </Show>

                        <Show when={task.directory}>
                          <div class="kb-card-line">
                            <ui.Icon name="folder" size="small" />
                            <span title={task.directory}>{baseName(task.directory)}</span>
                          </div>
                        </Show>

                        <div class="kb-card-foot">
                          <StatusDot
                            status={live()?.status ?? ("none" as TaskStatus)}
                            label={ctx.t(statusLabelKey(live()?.status ?? "none"))}
                          />
                          <Show when={live()?.todos && live()!.todos!.total > 0}>
                            <Progress todos={live()!.todos} />
                          </Show>
                          <Show when={(live()?.runningSubagents ?? 0) > 0}>
                            <span class="kb-tone-warning">
                              {ctx.t("card.runningSubagents", { count: live()!.runningSubagents })}
                            </span>
                          </Show>
                          <span class="kb-foot-grow" />
                          <Show when={(live()?.cost ?? 0) > 0}>
                            <span>{formatCost(live()!.cost)}</span>
                          </Show>
                        </div>
                      </div>
                    )
                  }}
                </For>

                <Show when={tasks().length === 0}>
                  <div class="kb-col-empty">{ctx.t("column.empty")}</div>
                </Show>
              </div>
            </section>
          )
        }}
      </For>
      </div>
    </Show>
  )
}
