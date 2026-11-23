import { For, Show, Switch, Match, createEffect, createSignal, on, onCleanup } from "solid-js"
import {
  usePlugin,
  type MountedSession,
  type PanelTab,
} from "@opencode/plugin/gui"
import type { definition } from "./definition.ts"
import type { KanbanServices } from "./api.ts"
import type { LiveSnapshot } from "./data/live.ts"
import type { Task } from "./model/types.ts"
import {
  categories,
  claimTask,
  hasManagedWorktree,
  moveTaskBy,
  moveTaskToCategory,
  tagsOf,
} from "./model/board.ts"
import { firstVisibleTask, visibleTasks } from "./model/select.ts"
import { findProject, mergeProject, projectRows } from "./model/projects.ts"
import { projectKey } from "./model/boards.ts"
import { BoardView } from "./components/board.tsx"
import { DetailView } from "./components/detail.tsx"
import { ArchiveView } from "./components/archive.tsx"
import { HelpView } from "./components/help.tsx"

type WorkspaceProps = {
  session: MountedSession
  services: KanbanServices
  initialProjectID?: string
  dialog?: boolean
}

type PanelProps = {
  session: MountedSession
  tab: PanelTab
  services: KanbanServices
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function BoardWorkspace(props: WorkspaceProps) {
  const ctx = usePlugin<typeof definition>()
  const ui = ctx.ui
  const prefs = () => ctx.stores.prefs.value
  const serverID = props.session.server.id
  const compact = () => (prefs().density ?? "comfortable") === "compact"
  const toggleCompact = () =>
    ctx.stores.prefs.set({ ...prefs(), density: compact() ? "comfortable" : "compact" })
  const [query, setQuery] = createSignal("")
  const [state, setState] = createSignal<LiveSnapshot | undefined>()
  const [reloading, setReloading] = createSignal(false)
  const [exporting, setExporting] = createSignal(false)
  const [selectedTagIDs, setSelectedTagIDs] = createSignal<string[]>([])
  let searchRef: HTMLInputElement | undefined

  const projects = () => mergeProject(projectRows(props.session.server.data.project.list()), props.session.project)
  const routed = () => props.services.projectFor(props.session)
  const boardRoot = () => {
    const id = projectID()
    const row = findProject(projects(), id)
    if (row) return row.root
    const routedProject = routed()
    return routedProject && routedProject.id === id ? routedProject.root : ""
  }
  const board = () => props.services.boardFor(boardRoot(), projectID())
  const saveBoard = (next: ReturnType<typeof claimTask>) =>
    props.services.saveBoard(boardRoot(), next, projectID())

  const [projectID, setProjectID] = createSignal<string | undefined>(
    props.initialProjectID ?? routed()?.id ?? prefs().lastProjectID,
  )

  createEffect(
    on(
      () => props.session.key,
      () => {
        const project = routed()
        if (project) setProjectID(project.id)
      },
    ),
  )

  createEffect(
    on(
      () => projects().map((project) => project.id).join("|"),
      () => {
        if (projects().length === 0) return
        if (!projectID() || !findProject(projects(), projectID())) {
          const fallback = routed() ?? projects()[0]
          if (fallback) setProjectID(fallback.id)
        }
      },
    ),
  )

  createEffect(
    on(projectID, (id) => {
      if (!id) return
      const root = findProject(projects(), id)?.root ?? ""
      ctx.stores.prefs.set({ ...prefs(), lastProjectID: id, lastBoardKey: projectKey(root, id) })
      const selectedID = props.services.selectedTaskID()
      if (selectedID && !board().tasks.some((task) => task.id === selectedID)) {
        props.services.selectTask(undefined)
      }
    }),
  )

  // Legacy tasks predate the server id; claim every one whose project this server knows about.
  createEffect(() => {
    const known = new Set(projects().map((project) => project.id))
    if (known.size === 0) return
    const legacy = board().tasks.filter((task) => !task.serverID && known.has(task.projectID))
    if (legacy.length === 0) return
    let next = board()
    for (const task of legacy) next = claimTask(next, task.id, serverID)
    saveBoard(next)
  })

  createEffect(() => {
    void props.session.server.data.project.sync().catch(() => undefined)
  })

  let stop: (() => void) | undefined
  createEffect(
    on(
      () => [props.session.server.id, projectID(), props.session.pending] as const,
      () => {
        stop?.()
        stop = undefined
        setState(undefined)
        const id = projectID()
        if (!id || props.session.pending) return
        stop = props.services.live.watch(props.services.target(props.session, id), setState)
      },
    ),
  )
  onCleanup(() => stop?.())

  createEffect(
    on(
      () =>
        board()
          .tasks.filter(
            (task) =>
              task.projectID === projectID() && (!task.serverID || task.serverID === serverID),
          )
          .map(
            (task) =>
              `${task.id}:${task.serverID ?? ""}:${task.sessionID ?? ""}:${task.worktreePath ?? ""}:${task.archived ? 1 : 0}`,
          )
          .join("|"),
      () => {
        const id = projectID()
        if (id) props.services.live.invalidate(props.session.server.id, id)
      },
      { defer: true },
    ),
  )

  createEffect(
    on(
      () => props.services.searchPulse(),
      (pulse) => {
        if (pulse === 0) return
        setView("board")
        queueMicrotask(() => searchRef?.focus())
      },
    ),
  )

  const projectTags = () => tagsOf(board(), projectID())

  createEffect(
    on(
      () => projectTags().map((tag) => tag.id).join("|"),
      () => {
        const valid = new Set(projectTags().map((tag) => tag.id))
        setSelectedTagIDs((ids) => ids.filter((id) => valid.has(id)))
      },
    ),
  )

  createEffect(on(projectID, () => setSelectedTagIDs([]), { defer: true }))

  const toggleTag = (tagID: string) =>
    setSelectedTagIDs((ids) =>
      ids.includes(tagID) ? ids.filter((id) => id !== tagID) : [...ids, tagID],
    )

  const selectedTask = (): Task | undefined => {
    const id = props.services.selectedTaskID()
    if (!id) return undefined
    const task = board().tasks.find((item) => item.id === id)
    return task && task.projectID === projectID() && (!task.serverID || task.serverID === serverID)
      ? task
      : undefined
  }

  createEffect(
    on(
      () => [prefs().view, projectID(), state()?.updatedAt] as const,
      () => {
        if (prefs().view !== "detail" || selectedTask()) return
        const first = firstVisibleTask(board(), projectID() ?? "", undefined, query(), selectedTagIDs(), serverID)
        if (first) props.services.selectTask(first.id)
      },
    ),
  )

  const liveOf = (task: Task | undefined) =>
    task ? state()?.tasks[task.id] : undefined

  const runningCount = () =>
    board().tasks.filter(
      (task) =>
        task.projectID === projectID() &&
        (!task.serverID || task.serverID === serverID) &&
        !task.archived &&
        state()?.tasks[task.id]?.status === "running",
    ).length
  const projectTaskCount = () =>
    board().tasks.filter(
      (task) =>
        task.projectID === projectID() &&
        (!task.serverID || task.serverID === serverID) &&
        !task.archived,
    ).length

  const setView = (view: "board" | "detail" | "archive" | "help") => {
    ctx.stores.prefs.set({ ...prefs(), view })
    if (view === "detail" && !selectedTask()) {
      const first = firstVisibleTask(board(), projectID() ?? "", undefined, query(), selectedTagIDs(), serverID)
      if (first) props.services.selectTask(first.id)
    }
  }

  const openNewTask = (categoryID: string) => {
    const id = projectID()
    if (!id) {
      ctx.toast.show({ variant: "error", title: ctx.t("toast.noProject") })
      return
    }
    props.services.openTaskDialog(props.session, id, undefined, categoryID)
  }

  const defaultCategoryID = () => {
    const id = projectID()
    if (!id) return undefined
    const list = categories(board(), id)
    const preferred = prefs().defaultCategoryID
    return list.find((category) => category.id === preferred)?.id ?? list[0]?.id
  }

  const refresh = () => {
    const id = projectID()
    if (!id) return
    void props.services
      .refresh(props.session, id)
      .catch((error) =>
        ctx.toast.show({ variant: "error", title: ctx.t("toast.refreshFailed"), description: errorText(error) }),
      )
  }

  const exportBoard = async () => {
    const id = projectID()
    if (!id || exporting()) return
    setExporting(true)
    try {
      await props.services.exportBoard(props.session, id)
    } finally {
      setExporting(false)
    }
  }

  const reloadBoard = async () => {
    const id = projectID()
    if (!id || reloading()) return
    setReloading(true)
    try {
      await props.services.reloadBoard(props.session, id)
    } finally {
      setReloading(false)
    }
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
      if (props.services.selectedTaskID() === task.id) props.services.selectTask(undefined)
    } catch (error) {
      ctx.toast.show({
        variant: "error",
        title: ctx.t("task.error.deleteWorktree"),
        description: errorText(error),
      })
    }
  }

  const moveSelection = (dx: number, dy: number, shift: boolean) => {
    const id = projectID()
    if (!id) return
    const columns = categories(board(), id)
    const current = selectedTask()
    if (!current) {
      const first = firstVisibleTask(board(), id, undefined, query(), selectedTagIDs(), serverID)
      if (first) props.services.selectTask(first.id)
      return
    }
    if (shift) {
      if (dx !== 0) {
        const next = moveTaskToCategory(board(), current.id, dx)
        saveBoard(next)
        props.services.live.invalidate(props.session.server.id, id)
      }
      if (dy !== 0) {
        saveBoard(moveTaskBy(board(), current.id, dy))
        props.services.live.invalidate(props.session.server.id, id)
      }
      return
    }

    if (dx !== 0) {
      const index = columns.findIndex((category) => category.id === current.categoryID)
      const target = columns[Math.max(0, Math.min(columns.length - 1, index + dx))]
      if (!target) return
      const list = visibleTasks(board(), id, target.id, query(), selectedTagIDs(), serverID)
      const position = visibleTasks(board(), id, current.categoryID, query(), selectedTagIDs(), serverID).findIndex(
        (task) => task.id === current.id,
      )
      const next = list[Math.max(0, Math.min(list.length - 1, position))]
      if (next) props.services.selectTask(next.id)
      return
    }

    if (dy !== 0) {
      const list = visibleTasks(board(), id, current.categoryID, query(), selectedTagIDs(), serverID)
      const index = list.findIndex((task) => task.id === current.id)
      const next = list[Math.max(0, Math.min(list.length - 1, index + dy))]
      if (next) props.services.selectTask(next.id)
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
    const target = event.target as HTMLElement | null
    const editable =
      target?.tagName === "INPUT" ||
      target?.tagName === "TEXTAREA" ||
      target?.tagName === "SELECT" ||
      target?.isContentEditable === true
    const chrome = target?.closest("button, [role='menu'], .kb-switch, .kb-actions, .kb-search")

    if (event.key === "Escape") {
      if (query()) setQuery("")
      else props.services.selectTask(undefined)
      return
    }
    if (editable || chrome) return

    const task = selectedTask()
    switch (event.key) {
      case "n":
        event.preventDefault()
        openNewTask(defaultCategoryID() ?? "todo")
        return
      case "e":
        event.preventDefault()
        if (task) props.services.openTaskDialog(props.session, task.projectID, task)
        else ctx.toast.show({ variant: "default", title: ctx.t("toast.noTask") })
        return
      case "a":
        event.preventDefault()
        if (task) props.services.archiveTask(task)
        else ctx.toast.show({ variant: "default", title: ctx.t("toast.noTask") })
        return
      case "v":
        event.preventDefault()
        if (event.shiftKey) setView("archive")
        else setView(prefs().view === "detail" ? "board" : "detail")
        return
      case "c":
        event.preventDefault()
        toggleCompact()
        return
      case "Enter":
        event.preventDefault()
        if (task) void props.services.openTask(props.session, task)
        return
      case "/":
        event.preventDefault()
        searchRef?.focus()
        return
      case "ArrowLeft":
        event.preventDefault()
        moveSelection(-1, 0, event.shiftKey)
        return
      case "ArrowRight":
        event.preventDefault()
        moveSelection(1, 0, event.shiftKey)
        return
      case "ArrowUp":
        event.preventDefault()
        moveSelection(0, -1, event.shiftKey)
        return
      case "ArrowDown":
        event.preventDefault()
        moveSelection(0, 1, event.shiftKey)
        return
    }
  }

  const projectOptions = () => projects().map((project) => ({ value: project.id, label: project.name }))
  const projectLabel = () => findProject(projects(), projectID())?.name ?? ctx.t("project.unknown")

  return (
    <div
      class={props.dialog ? "kb kb-in-dialog" : "kb"}
      data-mode={ctx.appearance.mode()}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div class="kb-head">
        <div class="kb-title-row">
          <ui.Icon name={"task"} size="small" />
          <span class="kb-title">{ctx.t("panel.title")}</span>
          <span class="kb-subtitle">{projectLabel()}</span>
          <span class="kb-chip" data-tone={runningCount() > 0 ? "warning" : undefined}>
            {runningCount() > 0
              ? ctx.t("pill.running", { count: runningCount() })
              : ctx.t("pill.tasks", { count: projectTaskCount() })}
          </span>
          <div class="kb-actions">
            <ui.Tooltip value={ctx.t("action.newTask")}>
              <ui.IconButton
                icon="plus"
                label={ctx.t("action.newTask")}
                size="small"
                onClick={() => openNewTask(defaultCategoryID() ?? "todo")}
              />
            </ui.Tooltip>
            <ui.Tooltip value={ctx.t("action.newColumn")}>
              <ui.IconButton
                icon="outline-sliders"
                label={ctx.t("action.newColumn")}
                size="small"
                onClick={() => {
                  const id = projectID()
                  if (id) props.services.openColumnsDialog(id, projectLabel(), boardRoot())
                }}
              />
            </ui.Tooltip>
            <ui.Tooltip value={compact() ? ctx.t("action.comfortable") : ctx.t("action.compact")}>
              <ui.IconButton
                icon={compact() ? "expand" : "collapse"}
                label={compact() ? ctx.t("action.comfortable") : ctx.t("action.compact")}
                size="small"
                pressed={compact()}
                onClick={toggleCompact}
              />
            </ui.Tooltip>
            <ui.Tooltip value={ctx.t("action.tags")}>
              <ui.IconButton
                icon="bullet-list"
                label={ctx.t("action.tags")}
                size="small"
                onClick={() => {
                  const id = projectID()
                  if (id) props.services.openTagsDialog(id, projectLabel(), boardRoot())
                }}
              />
            </ui.Tooltip>
            <ui.Tooltip value={ctx.t("action.refresh")}>
              <ui.IconButton
                icon="outline-rotate-clockwise"
                label={ctx.t("action.refresh")}
                size="small"
                busy={!!state()?.loading}
                onClick={refresh}
              />
            </ui.Tooltip>
            <ui.Tooltip value={ctx.t("action.exportBoard")}>
              <ui.IconButton
                icon="cloud-upload"
                label={ctx.t("action.exportBoard")}
                size="small"
                busy={exporting()}
                onClick={() => void exportBoard()}
              />
            </ui.Tooltip>
            <ui.Tooltip value={ctx.t("action.reloadBoard")}>
              <ui.IconButton
                icon="download"
                label={ctx.t("action.reloadBoard")}
                size="small"
                busy={reloading()}
                onClick={() => void reloadBoard()}
              />
            </ui.Tooltip>
            <ui.Tooltip value={ctx.t("action.boardFolder")}>
              <ui.IconButton
                icon="folder"
                label={ctx.t("action.boardFolder")}
                size="small"
                onClick={() => {
                  const id = projectID()
                  if (id) void props.services.chooseBoardFolder(props.session, id)
                }}
              />
            </ui.Tooltip>
            <Show when={!props.dialog}>
              <ui.Tooltip value={ctx.t("command.board")}>
                <ui.IconButton
                  icon="outline-expand"
                  label={ctx.t("command.board")}
                  size="small"
                  onClick={() => props.services.openFullBoard(props.session)}
                />
              </ui.Tooltip>
            </Show>
            <ui.Tooltip value={ctx.t("action.help")}>
              <ui.IconButton
                icon="help"
                label={ctx.t("action.help")}
                size="small"
                pressed={prefs().view === "help"}
                onClick={() => setView(prefs().view === "help" ? "board" : "help")}
              />
            </ui.Tooltip>
          </div>
        </div>

        <div class="kb-project-row">
          <span class="kb-project-label">{ctx.t("project.label")}</span>
          <ui.Select
            label={ctx.t("project.label")}
            options={projectOptions()}
            value={projectID()}
            onChange={(value) => setProjectID(value)}
            placeholder={ctx.t("project.noProjects")}
            disabled={projectOptions().length === 0}
          />
        </div>

        <div class="kb-search">
          <input
            ref={(element) => {
              searchRef = element
            }}
            type="search"
            aria-label={ctx.t("search.label")}
            placeholder={ctx.t("search.placeholder")}
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation()
                setQuery("")
                event.currentTarget.blur()
              }
            }}
          />
          <Show when={query()}>
            <button
              type="button"
              class="kb-search-clear"
              aria-label={ctx.t("search.clear")}
              onClick={() => {
                setQuery("")
                searchRef?.focus()
              }}
            >
              ×
            </button>
          </Show>
        </div>

        <Show when={projectTags().length > 0}>
          <div class="kb-tags-filter" role="group" aria-label={ctx.t("tags.filter")} title={ctx.t("tags.filter.hint")}>
            <For each={projectTags()}>
              {(tag) => (
                <button
                  type="button"
                  class="kb-tag"
                  style={`--kb-tag:${tag.color}`}
                  data-active={selectedTagIDs().includes(tag.id) ? "true" : undefined}
                  aria-pressed={selectedTagIDs().includes(tag.id)}
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.name}
                </button>
              )}
            </For>
            <Show when={selectedTagIDs().length > 0}>
              <button
                type="button"
                class="kb-search-clear"
                onClick={() => setSelectedTagIDs([])}
              >
                {ctx.t("tags.clear")}
              </button>
            </Show>
          </div>
        </Show>

        <div class="kb-switch" role="group" aria-label={ctx.t("aria.view")}>
          {(["board", "detail", "archive"] as const).map((view) => (
            <button
              type="button"
              data-active={prefs().view === view ? "true" : undefined}
              aria-pressed={prefs().view === view}
              onClick={() => setView(view)}
            >
              {ctx.t(`view.${view}`)}
            </button>
          ))}
        </div>
        <hr class="kb-divider" />
      </div>

      <div class="kb-body">
        <Show when={!state()}>
          <div class="kb-notice">
            <ui.Loader size="small" /> {ctx.t("board.loading")}
          </div>
        </Show>
        <Show when={state()?.stale}>
          <div class="kb-notice" data-danger={state()?.error ? "true" : undefined}>
            {state()?.error ? ctx.t("board.failed") : ctx.t("board.stale")}
            <button type="button" class="kb-search-clear" onClick={refresh}>
              {ctx.t("action.retry")}
            </button>
          </div>
        </Show>

        <Switch>
          <Match when={prefs().view === "board"}>
            <BoardView
              session={props.session}
              projectID={projectID() ?? ""}
              projectRoot={boardRoot()}
              serverID={serverID}
              projects={projects()}
              query={query()}
              selectedID={props.services.selectedTaskID()}
              tagIDs={selectedTagIDs()}
              onToggleTag={toggleTag}
              onSelect={props.services.selectTask}
              onNewTask={openNewTask}
              onEdit={(task) => props.services.openTaskDialog(props.session, task.projectID, task)}
              services={props.services}
              state={state}
            />
          </Match>
          <Match when={prefs().view === "detail"}>
            <div class="kb-scroll">
              <DetailView
                session={props.session}
                task={selectedTask()}
                live={liveOf(selectedTask())}
                services={props.services}
                onBack={() => setView("board")}
                onEdit={(task) => props.services.openTaskDialog(props.session, task.projectID, task)}
                onArchive={(task) => props.services.archiveTask(task)}
                onDelete={(task) => void removeTask(task)}
              />
            </div>
          </Match>
          <Match when={prefs().view === "archive"}>
            <div class="kb-scroll">
              <ArchiveView
                session={props.session}
                projectID={projectID() ?? ""}
                projectRoot={boardRoot()}
                serverID={serverID}
                query={query()}
                tagIDs={selectedTagIDs()}
                services={props.services}
              />
            </div>
          </Match>
          <Match when={prefs().view === "help"}>
            <div class="kb-scroll">
              <HelpView />
            </div>
          </Match>
        </Switch>
      </div>
    </div>
  )
}

export function KanbanPanel(props: PanelProps) {
  return <BoardWorkspace session={props.session} services={props.services} />
}
