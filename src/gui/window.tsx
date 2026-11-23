import { createEffect, createSignal, on, onCleanup } from "solid-js"
import {
  Command,
  ComposerPill,
  MenuItem,
  Panel,
  SettingsPage,
  Style,
  createKeyed,
  usePlugin,
  type ComposerPill as ComposerPillItem,
  type MenuItem as MenuItemEntry,
  type MountedSession,
  type PanelTab,
  type Plugin,
  type SessionRef,
} from "@opencode/plugin/gui"
import type { definition, StoredPrefs } from "./definition.ts"
import type { CreateTaskArgs, KanbanServices } from "./api.ts"
import type { OpenMode } from "./model/types.ts"
import type { Task } from "./model/types.ts"
import {
  archiveTask as archiveTaskModel,
  bindSession,
  boardKey,
  categories,
  claimTask,
  createTask as createTaskModel,
  defaultBoard,
  deleteTask as deleteTaskModel,
  hasManagedWorktree,
  isBoardLike,
  mergeSessionBindings,
  moveTaskBy,
  moveTaskToCategory,
  newID,
  normalizeBoard,
  restoreTask as restoreTaskModel,
  restoreDeletedTask,
  sameBoard,
  taskDirectory,
  updateTask as updateTaskModel,
} from "./model/board.ts"
import { findProject, mergeProject, projectForSession, projectRows } from "./model/projects.ts"
import { createLiveBoard } from "./data/live.ts"
import { createWorktree, ensureSessionKnown, listBranches, removeWorktree, startSession, vcsChanges } from "./data/actions.ts"
import { BoardWorkspace, KanbanPanel } from "./panel.tsx"
import { baseName } from "./format.ts"
import { KanbanBoard } from "../rpc.ts"
import { ColumnsDialog, TagsDialog, TaskDialog } from "./components/dialogs.tsx"
import { styles } from "./style.ts"

const TAB_ID = "board"

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function rpcErrorType(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined
  const record = error as { type?: unknown; message?: unknown }
  if (typeof record.type === "string") return record.type
  if (typeof record.message === "string") {
    const match = /(?:not_found|invalid|unreadable|rpc\.[a-z_]+)/.exec(record.message)
    if (match) return match[0]
  }
  return undefined
}

function FullBoardDialog(props: {
  session: MountedSession
  projectID: string | undefined
  services: KanbanServices
  close: () => void
}) {
  const ctx = usePlugin<typeof definition>()
  return (
    <ctx.ui.Dialog
      title={ctx.t("panel.title")}
      size="x-large"
      footer={
        <ctx.ui.Button variant="contrast" onClick={props.close}>
          {ctx.t("action.close")}
        </ctx.ui.Button>
      }
    >
      <BoardWorkspace
        session={props.session}
        services={props.services}
        initialProjectID={props.projectID}
        dialog
      />
    </ctx.ui.Dialog>
  )
}

function KanbanSettings() {
  const ctx = usePlugin<typeof definition>()
  const prefs = () => ctx.stores.prefs.value
  const board = () => ctx.stores.board.value
  const save = (patch: Partial<StoredPrefs>) => ctx.stores.prefs.set({ ...prefs(), ...patch })

  const alignmentOptions = (): { value: "fit" | "scroll"; label: string }[] => [
    { value: "fit", label: ctx.t("alignment.fit") },
    { value: "scroll", label: ctx.t("alignment.scroll") },
  ]

  const densityOptions = (): { value: "comfortable" | "compact"; label: string }[] => [
    { value: "comfortable", label: ctx.t("density.comfortable") },
    { value: "compact", label: ctx.t("density.compact") },
  ]

  const widthOptions = (): { value: string; label: string }[] => [
    { value: "240", label: ctx.t("width.240") },
    { value: "280", label: ctx.t("width.280") },
    { value: "340", label: ctx.t("width.340") },
  ]

  const pollOptions = (): { value: string; label: string }[] => [
    { value: "0", label: ctx.t("interval.0") },
    { value: "5000", label: ctx.t("interval.5000") },
    { value: "15000", label: ctx.t("interval.15000") },
    { value: "30000", label: ctx.t("interval.30000") },
    { value: "60000", label: ctx.t("interval.60000") },
  ]

  const categoryOptions = () =>
    categories(board()).map((category) => ({ value: category.id, label: category.name }))

  const reset = async () => {
    const ok = await ctx.dialogs.confirm({
      title: ctx.t("settings.reset.confirm"),
      description: ctx.t("settings.reset.body"),
      confirm: ctx.t("settings.reset"),
      danger: true,
    })
    if (!ok) return
    ctx.stores.board.set(defaultBoard())
    ctx.toast.show({ variant: "success", title: ctx.t("settings.reset.done") })
  }

  return (
    <ctx.ui.SettingsLayout title={ctx.t("settings.title")} description={ctx.t("settings.description")}>
      <ctx.ui.SettingsSection title={ctx.t("settings.section.board")}>
        <ctx.ui.SettingsRow
          id="kanban-alignment"
          title={ctx.t("settings.alignment")}
          description={ctx.t("settings.alignment.description")}
        >
          <ctx.ui.Select
            label={ctx.t("settings.alignment")}
            options={alignmentOptions()}
            value={prefs().alignment}
            onChange={(value) => save({ alignment: value })}
          />
        </ctx.ui.SettingsRow>

        <ctx.ui.SettingsRow
          id="kanban-density"
          title={ctx.t("settings.density")}
          description={ctx.t("settings.density.description")}
        >
          <ctx.ui.Select
            label={ctx.t("settings.density")}
            options={densityOptions()}
            value={prefs().density ?? "comfortable"}
            onChange={(value) => save({ density: value })}
          />
        </ctx.ui.SettingsRow>

        <ctx.ui.SettingsRow
          id="kanban-width"
          title={ctx.t("settings.columnWidth")}
          description={ctx.t("settings.columnWidth.description")}
        >
          <ctx.ui.Select
            label={ctx.t("settings.columnWidth")}
            options={widthOptions()}
            value={String(prefs().columnWidth)}
            onChange={(value) => save({ columnWidth: Number(value) })}
          />
        </ctx.ui.SettingsRow>

        <ctx.ui.SettingsRow
          id="kanban-auto-export"
          title={ctx.t("settings.autoExport")}
          description={ctx.t("settings.autoExport.description")}
        >
          <ctx.ui.Switch
            label={ctx.t("settings.autoExport")}
            hideLabel
            checked={prefs().autoExport !== false}
            onChange={(checked) => save({ autoExport: checked })}
          />
        </ctx.ui.SettingsRow>

        <ctx.ui.SettingsRow
          id="kanban-auto-reload"
          title={ctx.t("settings.autoReload")}
          description={ctx.t("settings.autoReload.description")}
        >
          <ctx.ui.Switch
            label={ctx.t("settings.autoReload")}
            hideLabel
            checked={prefs().autoReload !== false}
            onChange={(checked) => save({ autoReload: checked })}
          />
        </ctx.ui.SettingsRow>

        <ctx.ui.SettingsRow
          id="kanban-default-category"
          title={ctx.t("settings.defaultCategory")}
          description={ctx.t("settings.defaultCategory.description")}
        >
          <ctx.ui.Select
            label={ctx.t("settings.defaultCategory")}
            options={categoryOptions()}
            value={prefs().defaultCategoryID}
            onChange={(value) => save({ defaultCategoryID: value })}
            placeholder={ctx.t("column.label")}
          />
        </ctx.ui.SettingsRow>
      </ctx.ui.SettingsSection>

      <ctx.ui.SettingsSection title={ctx.t("settings.section.work")}>
        <ctx.ui.SettingsRow
          id="kanban-open-mode"
          title={ctx.t("settings.openMode")}
          description={ctx.t("settings.openMode.description")}
        >
          <ctx.ui.Select
            label={ctx.t("settings.openMode")}
            options={[
              { value: "reuse", label: ctx.t("mode.reuse") },
              { value: "new", label: ctx.t("mode.new") },
              { value: "ask", label: ctx.t("mode.ask") },
            ]}
            value={prefs().openMode ?? "reuse"}
            onChange={(value) => save({ openMode: value })}
          />
        </ctx.ui.SettingsRow>

        <ctx.ui.SettingsRow id="kanban-open-on-create" title={ctx.t("settings.openOnCreate")} description={ctx.t("settings.openOnCreate.description")}>
          <ctx.ui.Switch
            label={ctx.t("settings.openOnCreate")}
            hideLabel
            checked={prefs().openOnCreate}
            onChange={(checked) => save({ openOnCreate: checked })}
          />
        </ctx.ui.SettingsRow>

        <ctx.ui.SettingsRow id="kanban-auto-prompt" title={ctx.t("settings.autoPrompt")} description={ctx.t("settings.autoPrompt.description")}>
          <ctx.ui.Switch
            label={ctx.t("settings.autoPrompt")}
            hideLabel
            checked={prefs().autoPrompt}
            onChange={(checked) => save({ autoPrompt: checked })}
          />
        </ctx.ui.SettingsRow>

        <ctx.ui.SettingsRow id="kanban-prompt" title={ctx.t("settings.prompt")} description={ctx.t("settings.prompt.description")}>
          <ctx.ui.TextInput
            label={ctx.t("settings.prompt")}
            value={prefs().initialPrompt}
            placeholder={ctx.t("settings.prompt.placeholder")}
            onInput={(value) => save({ initialPrompt: value })}
          />
        </ctx.ui.SettingsRow>

        <ctx.ui.SettingsRow
          id="kanban-poll"
          title={ctx.t("settings.poll")}
          description={ctx.t("settings.poll.description")}
        >
          <ctx.ui.Select
            label={ctx.t("settings.poll")}
            options={pollOptions()}
            value={String(prefs().pollMs)}
            onChange={(value) => save({ pollMs: Number(value) })}
          />
        </ctx.ui.SettingsRow>
      </ctx.ui.SettingsSection>

      <ctx.ui.SettingsSection title={ctx.t("settings.section.notify")}>
        <ctx.ui.SettingsRow id="kanban-notify" title={ctx.t("settings.notify")} description={ctx.t("settings.notify.description")}>
          <ctx.ui.Switch
            label={ctx.t("settings.notify")}
            hideLabel
            checked={prefs().notify}
            onChange={(checked) => save({ notify: checked })}
          />
        </ctx.ui.SettingsRow>

        <ctx.ui.SettingsRow id="kanban-pill" title={ctx.t("settings.pill")} description={ctx.t("settings.pill.description")}>
          <ctx.ui.Switch
            label={ctx.t("settings.pill")}
            hideLabel
            checked={prefs().pill}
            onChange={(checked) => save({ pill: checked })}
          />
        </ctx.ui.SettingsRow>
      </ctx.ui.SettingsSection>

      <ctx.ui.SettingsSection title={ctx.t("settings.reset")}>
        <ctx.ui.SettingsRow
          id="kanban-reset"
          title={ctx.t("settings.reset")}
          description={ctx.t("settings.reset.description")}
        >
          <ctx.ui.Button variant="danger" size="small" onClick={() => void reset()}>
            {ctx.t("settings.reset")}
          </ctx.ui.Button>
        </ctx.ui.SettingsRow>
      </ctx.ui.SettingsSection>
    </ctx.ui.SettingsLayout>
  )
}

export const setup: Plugin.Setup<typeof definition> = (ctx) => {
  const board = () => ctx.stores.board.value
  const prefs = () => ctx.stores.prefs.value
  const [selectedTaskID, setSelectedTaskID] = createSignal<string | undefined>()
  const [searchPulse, setSearchPulse] = createSignal(0)

  const notifiedSessions = new Set<string>()
  const pendingPrompts = new Map<string, string>()

  const live = createLiveBoard({
    debounceMs: () => 400,
    pollMs: () => ctx.stores.prefs.value.pollMs,
    onMissingPin: (event) => {
      const ids = new Set(event.taskIDs)
      let cleared = false
      let next = board()
      for (const task of next.tasks) {
        if (!ids.has(task.id) || task.sessionID !== event.sessionID) continue
        next = bindSession(next, task.id, undefined)
        cleared = true
      }
      if (!cleared) return
      ctx.stores.board.set(next)
      ctx.toast.show({ variant: "default", title: ctx.t("toast.sessionReleased") })
    },
    onTransition: (event) => {
      if (event.to !== "idle" || !ctx.stores.prefs.value.notify) return
      const key = `${event.sessionID}:${event.sessionUpdated ?? 0}`
      if (notifiedSessions.has(key)) return
      notifiedSessions.add(key)
      if (notifiedSessions.size > 200) notifiedSessions.clear()
      void ctx.attention.notify({
        title: ctx.t("notify.done", { title: event.task.title }),
        message: ctx.t("notify.done.body", { project: event.projectName }),
        variant: "default",
        session: { server: event.serverID, id: event.sessionID },
        id: `kanban:${event.sessionID}:${event.sessionUpdated ?? 0}`,
      })
    },
  })

  createEffect(() => {
    const current = ctx.sessions.current()
    const screen = ctx.screen.current()
    if (!current || !screen) return
    const prompt = pendingPrompts.get(current.id)
    if (prompt === undefined) return
    pendingPrompts.delete(current.id)
    if (!prompt.trim()) return
    screen.composer.setText(prompt)
    screen.composer.focus()
  })

  const sessionInfo = (server: MountedSession["server"], sessionID: string) => {
    try {
      return server.data.session.get(sessionID)
    } catch {
      return undefined
    }
  }

  const sessionTitle = (server: MountedSession["server"], sessionID: string) =>
    sessionInfo(server, sessionID)?.title?.trim() || sessionID

  const bindTaskSession = (server: MountedSession["server"], task: Task, sessionID: string) => {
    if (task.serverID && task.serverID !== server.id) {
      notify("error", ctx.t("toast.sessionOtherServer"))
      return false
    }
    const info = sessionInfo(server, sessionID)
    if (!info) {
      notify("error", ctx.t("toast.pinFailed"))
      return false
    }
    if (info.parentID) {
      notify("error", ctx.t("toast.sessionSubagent"))
      return false
    }
    if (info.projectID !== task.projectID) {
      notify("error", ctx.t("toast.sessionOtherProject"))
      return false
    }
    if (task.sessionID === sessionID) {
      notify("default", ctx.t("toast.alreadyLinked"))
      return false
    }
    ctx.stores.board.set(bindSession(board(), task.id, sessionID, Date.now(), server.id))
    live.invalidate(server.id, task.projectID)
    notify("success", ctx.t("toast.sessionLinked", { title: sessionTitle(server, sessionID) }))
    return true
  }

  const projectsOf = (session: MountedSession) =>
    mergeProject(projectRows(session.server.data.project.list()), session.project)

  const projectFor = (session: MountedSession) => {
    let projectID: string | undefined
    try {
      projectID = session.server.data.session.get(session.id).projectID
    } catch {
      projectID = undefined
    }
    return projectForSession({ projectID, directory: session.directory, project: session.project })
  }

  const notify = (variant: "default" | "success" | "error", title: string, description?: string) => {
    ctx.toast.show({ variant, title, description })
  }

  const undoArchive = (task: Task) => {
    const current = board().tasks.find((item) => item.id === task.id)
    if (!current?.archived) return
    ctx.stores.board.set(restoreTaskModel(board(), task.id))
    live.invalidate()
  }

  const undoDelete = (task: Task) => {
    if (board().tasks.some((item) => item.id === task.id)) return
    ctx.stores.board.set(restoreDeletedTask(board(), task))
    live.invalidate()
  }

  const showUndo = (title: string, task: Task, run: () => void, description?: string) => {
    ctx.toast.show({
      variant: "success",
      title,
      description: description ?? task.title,
      duration: 8000,
      actions: [{ label: ctx.t("action.undo"), run }],
    })
  }

  const normalized = normalizeBoard(ctx.stores.board.value)
  if (!sameBoard(normalized, ctx.stores.board.value)) {
    ctx.stores.board.set(normalized)
  }

  let lastWritten = boardKey(normalized)
  let lastBoard = lastWritten
  let lastFile: string | undefined
  let autoTimer: ReturnType<typeof setTimeout> | undefined
  let autoInFlight = false
  let autoAgain = false
  let lastAutoError: string | undefined
  let reloadTimer: ReturnType<typeof setInterval> | undefined
  let reloadKey: string | undefined
  let reloadPolling = false
  let reloadConflict = false

  const autoTarget = () => {
    const session = ctx.sessions.current()
    if (!session) return undefined
    const preferred = ctx.stores.prefs.value.lastProjectID
    return (
      (preferred ? findProject(projectsOf(session), preferred) : undefined) ??
      projectFor(session)
    )
  }

  const autoExport = async () => {
    if (ctx.stores.prefs.value.autoExport === false) return
    const session = ctx.sessions.current()
    const project = autoTarget()
    if (!session || !project) return
    const snapshot = boardKey(ctx.stores.board.value)
    if (snapshot === lastWritten) return
    if (autoInFlight) {
      autoAgain = true
      return
    }
    autoInFlight = true
    try {
      const json = JSON.stringify(ctx.stores.board.value, null, 2) + "\n"
      await ctx.client.rpc(KanbanBoard).save({
        directory: project.root,
        json,
      })
      lastWritten = snapshot
      lastBoard = snapshot
      lastFile = json
      lastAutoError = undefined
    } catch (error) {
      const message = errorText(error)
      if (message !== lastAutoError) {
        lastAutoError = message
        const type = rpcErrorType(error)
        notify(
          "error",
          type === "rpc.method_not_found" || type === "rpc.unavailable"
            ? ctx.t("toast.boardReloadUnavailable")
            : ctx.t("toast.autoExportFailed"),
          message,
        )
      }
    } finally {
      autoInFlight = false
      if (autoAgain) {
        autoAgain = false
        scheduleAuto()
      }
    }
  }

  const scheduleAuto = () => {
    if (autoTimer) clearTimeout(autoTimer)
    autoTimer = setTimeout(() => {
      autoTimer = undefined
      void autoExport()
    }, 1500)
  }

  createEffect(() => {
    const state = boardKey(ctx.stores.board.value)
    if (state === lastWritten || ctx.stores.prefs.value.autoExport === false) return
    scheduleAuto()
  })

  createEffect(() => {
    if (!ctx.sessions.current()) return
    if (boardKey(ctx.stores.board.value) === lastWritten) return
    if (ctx.stores.prefs.value.autoExport === false) return
    scheduleAuto()
  })

  createEffect(() => {
    if (!ctx.stores.prefs.value.lastProjectID) return
    if (boardKey(ctx.stores.board.value) === lastWritten) return
    if (ctx.stores.prefs.value.autoExport === false) return
    scheduleAuto()
  })

  const pollExternal = async () => {
    if (ctx.stores.prefs.value.autoReload === false) return
    if (reloadPolling) return
    const session = ctx.sessions.current()
    const project = autoTarget()
    if (!session || !project) return

    const key = `${session.server.id}\n${project.id}\n${project.root}`
    if (key !== reloadKey) {
      reloadKey = key
      lastFile = undefined
      lastBoard = boardKey(ctx.stores.board.value)
      reloadConflict = false
    }

    reloadPolling = true
    try {
      const response = (await ctx.client.rpc(KanbanBoard).load({
        directory: project.root,
      })) as { json: string }
      const fileJson = response.json

      if (lastFile === undefined) {
        lastFile = fileJson
        lastBoard = boardKey(ctx.stores.board.value)
        return
      }
      if (fileJson === lastFile) return

      const current = boardKey(ctx.stores.board.value)
      if (current !== lastBoard) {
        if (!reloadConflict) {
          reloadConflict = true
          ctx.toast.show({ variant: "default", title: ctx.t("toast.boardExternalConflict") })
        }
        return
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(fileJson)
      } catch {
        return
      }
      if (!isBoardLike(parsed)) return

      const next = mergeSessionBindings(normalizeBoard(parsed), board())
      const before = boardKey(ctx.stores.board.value)
      const after = boardKey(next)
      lastFile = fileJson
      lastBoard = after
      reloadConflict = false
      if (after === before) {
        ctx.toast.show({
          variant: "default",
          title: ctx.t("toast.boardFileNoChange"),
          description: ctx.t("toast.boardFileNoChange.body"),
        })
        return
      }
      ctx.stores.board.set(next)
      live.invalidate()
      ctx.toast.show({ variant: "default", title: ctx.t("toast.boardAutoReloaded") })
    } catch {
      // Missing, unreadable, or unavailable file: leave the live board alone.
    } finally {
      reloadPolling = false
    }
  }

  createEffect(() => {
    const enabled = ctx.stores.prefs.value.autoReload !== false
    const session = ctx.sessions.current()
    if (!enabled || !session) {
      if (reloadTimer) {
        clearInterval(reloadTimer)
        reloadTimer = undefined
      }
      return
    }
    if (reloadTimer) return
    void pollExternal()
    reloadTimer = setInterval(() => void pollExternal(), 2000)
  })

  onCleanup(() => {
    if (autoTimer) clearTimeout(autoTimer)
    if (reloadTimer) clearInterval(reloadTimer)
  })

  const services: KanbanServices = {
    live,
    selectedTaskID: () => selectedTaskID(),
    selectTask: (id) => setSelectedTaskID(id),
    searchPulse: () => searchPulse(),
    requestSearch: () => setSearchPulse((value) => value + 1),

    openPanel: (session: SessionRef) => {
      ctx.layout.open(`${ctx.id}:${TAB_ID}`, session, { tab: "select", background: true })
    },

    openFullBoard: (session: MountedSession) => {
      const project = projectFor(session)
      ctx.dialogs.open((dialog) => (
        <FullBoardDialog
          session={session}
          projectID={project?.id}
          services={services}
          close={dialog.close}
        />
      ))
    },

    openTaskDialog: (session, projectID, task, initialCategoryID) => {
      const projects = projectsOf(session)
      ctx.dialogs.open((dialog) => (
        <TaskDialog
          session={session}
          projects={projects}
          initialProjectID={projectID}
          initialCategoryID={initialCategoryID}
          task={task}
          services={services}
          onClose={dialog.close}
        />
      ))
    },

    openColumnsDialog: (projectID, projectName) => {
      ctx.dialogs.open((dialog) => (
        <ColumnsDialog
          projectID={projectID}
          projectName={projectName}
          onClose={dialog.close}
        />
      ))
    },

    openTagsDialog: (projectID, projectName) => {
      ctx.dialogs.open((dialog) => (
        <TagsDialog
          projectID={projectID}
          projectName={projectName}
          onClose={dialog.close}
        />
      ))
    },

    projects: projectsOf,
    projectFor,

    target: (session, projectID) => ({
      serverID: session.server.id,
      projectID,
      client: () => session.server.client,
      data: () => session.server.data,
      tasks: () => ctx.stores.board.value.tasks,
      projectName: () => findProject(projectsOf(session), projectID)?.name ?? projectID,
    }),

    createTask: async (session, input: CreateTaskArgs) => {
      const project = findProject(projectsOf(session), input.projectID)
      if (!project) throw new Error(ctx.t("task.validation.project"))

      const directory = input.directory?.trim() || undefined
      let worktreePath: string | undefined
      if (input.makeWorktree && !directory) {
        try {
          worktreePath = await createWorktree(
            session.server.client,
            project.id,
            input.branch,
            input.baseBranch,
            ctx.signal,
          )
        } catch (error) {
          throw new Error(`${ctx.t("task.error.worktree")} ${errorText(error)}`)
        }
      }

      const id = newID("task")
      const next = createTaskModel(board(), {
        id,
        title: input.title,
        branch: input.branch,
        projectID: project.id,
        projectRoot: project.root,
        projectName: project.name,
        serverID: session.server.id,
        categoryID: input.categoryID,
        tagIDs: input.tagIDs,
        baseBranch: input.baseBranch,
        worktreePath,
        directory,
        notes: input.notes,
      })
      ctx.stores.board.set(next)
      const task = next.tasks.find((item) => item.id === id)!
      live.invalidate(session.server.id, project.id)

      if (input.autoPrompt) {
        try {
          await services.startAgent(session, task, input.prompt)
        } catch (error) {
          notify("error", ctx.t("toast.error"), errorText(error))
        }
      } else {
        if (input.openOnCreate) {
          try {
            const started = await startSession(
              session.server.client,
              session.server.data,
              task.title,
              taskDirectory(task),
              "",
              ctx.signal,
            )
            ctx.stores.board.set(
              bindSession(board(), task.id, started.id, Date.now(), session.server.id),
            )
            live.invalidate(session.server.id, task.projectID)
            const initial = input.prompt || prefs().initialPrompt
            if (initial.trim()) pendingPrompts.set(started.id, initial)
            ctx.tabs.open({ server: session.server.id, id: started.id }, { focus: true })
          } catch (error) {
            notify("error", ctx.t("toast.error"), errorText(error))
          }
        }
        notify(
          "success",
          directory
            ? ctx.t("toast.createdDirectory")
            : worktreePath
              ? ctx.t("toast.createdWorktree")
              : ctx.t("toast.created"),
        )
      }
      return task
    },

    openTask: async (session, task, requested) => {
      try {
        if (task.serverID && task.serverID !== session.server.id) {
          notify("error", ctx.t("toast.sessionOtherServer"))
          return
        }
        const snapshot = live.peek(session.server.id, task.projectID)
        const liveTask = snapshot?.tasks[task.id]
        // A stored pin wins over a live worktree match. Unpinned tasks may use the match.
        const bound = task.sessionID ?? liveTask?.sessionID
        let mode: OpenMode = requested ?? prefs().openMode ?? "reuse"

        if (mode === "ask") {
          if (!bound) {
            mode = "reuse"
          } else {
            const choice = await ctx.dialogs.select<"reuse" | "new">({
              title: ctx.t("open.title"),
              placeholder: ctx.t("open.placeholder"),
              current: "reuse",
              options: [
                {
                  value: "reuse",
                  title: ctx.t("open.reuse"),
                  description: liveTask?.sessionTitle ?? ctx.t("open.reuse.description"),
                  group: ctx.t("open.group"),
                },
                {
                  value: "new",
                  title: ctx.t("open.new"),
                  description: ctx.t("open.new.description"),
                  group: ctx.t("open.group"),
                },
              ],
            })
            if (!choice) return
            mode = choice
          }
        }

        if (mode === "reuse" && bound) {
          if (!task.sessionID) {
            // Turn a worktree discovery into an explicit, persisted pin on first open.
            ctx.stores.board.set(bindSession(board(), task.id, bound, Date.now(), session.server.id))
            live.invalidate(session.server.id, task.projectID)
          }
          await ensureSessionKnown(session.server.data, bound)
          ctx.tabs.open({ server: session.server.id, id: bound }, { focus: true })
          return
        }

        const directory = taskDirectory(task)
        if (!directory) throw new Error(ctx.t("toast.noWorktree"))
        const started = await startSession(
          session.server.client,
          session.server.data,
          task.title,
          directory,
          "",
          ctx.signal,
        )
        ctx.stores.board.set(bindSession(board(), task.id, started.id, Date.now(), session.server.id))
        live.invalidate(session.server.id, task.projectID)
        ctx.tabs.open({ server: session.server.id, id: started.id }, { focus: true })
        notify(
          "success",
          started.promptError
            ? ctx.t("toast.error")
            : mode === "new"
              ? ctx.t("toast.newSession")
              : ctx.t("toast.sessionStarted"),
          started.promptError ? errorText(started.promptError) : undefined,
        )
      } catch (error) {
        notify("error", ctx.t("toast.error"), errorText(error))
      }
    },

    startAgent: async (session, task, prompt) => {
      try {
        if (task.serverID && task.serverID !== session.server.id) {
          notify("error", ctx.t("toast.sessionOtherServer"))
          return
        }
        const directory = taskDirectory(task)
        if (!directory) throw new Error(ctx.t("toast.noWorktree"))
        const started = await startSession(
          session.server.client,
          session.server.data,
          task.title,
          directory,
          prompt ?? prefs().initialPrompt,
          ctx.signal,
        )
        ctx.stores.board.set(bindSession(board(), task.id, started.id, Date.now(), session.server.id))
        live.invalidate(session.server.id, task.projectID)
        ctx.tabs.open({ server: session.server.id, id: started.id }, { focus: true })
        if (started.promptError) {
          notify("error", ctx.t("toast.error"), errorText(started.promptError))
        } else {
          notify("success", ctx.t("toast.sessionStarted"))
        }
      } catch (error) {
        notify("error", ctx.t("toast.error"), errorText(error))
      }
    },

    linkTaskSession: async (session, task) => {
      try {
        const current = ctx.sessions.current()
        const seen = new Set<string>()
        const candidates: { id: string; title: string; detail: string; current: boolean }[] = []

        for (const ref of [current, ...ctx.sessions.list()]) {
          if (!ref || seen.has(ref.id) || ref.pending) continue
          seen.add(ref.id)
          if (ref.server.id !== session.server.id) continue
          const info = sessionInfo(ref.server, ref.id)
          if (!info || info.parentID || info.projectID !== task.projectID) continue
          candidates.push({
            id: ref.id,
            title: info.title?.trim() || ref.id,
            detail: ref.location?.directory ? baseName(ref.location.directory) : ref.id,
            current: ref.id === current?.id,
          })
        }

        candidates.sort(
          (a, b) => Number(b.current) - Number(a.current) || a.title.localeCompare(b.title),
        )

        if (candidates.length === 0) {
          notify("error", ctx.t("toast.noOpenSession"))
          return
        }

        const choice = await ctx.dialogs.select<string>({
          title: ctx.t("link.title"),
          placeholder: ctx.t("link.placeholder"),
          current: task.sessionID,
          options: candidates.map((candidate) => ({
            value: candidate.id,
            title: candidate.title,
            description: candidate.current ? ctx.t("link.current") : candidate.detail,
            group: candidate.current ? ctx.t("link.group.current") : ctx.t("link.group.open"),
          })),
        })
        if (!choice) return
        bindTaskSession(session.server, task, choice)
      } catch (error) {
        notify("error", ctx.t("toast.error"), errorText(error))
      }
    },

    linkTaskToCurrent: async (session, task) => {
      try {
        const current = ctx.sessions.current()
        if (!current) {
          notify("error", ctx.t("toast.noSession"))
          return
        }
        bindTaskSession(session.server, task, current.id)
      } catch (error) {
        notify("error", ctx.t("toast.error"), errorText(error))
      }
    },

    unlinkTaskSession: (task) => {
      if (!task.sessionID) return
      ctx.stores.board.set(bindSession(board(), task.id, undefined))
      live.invalidate()
      notify("success", ctx.t("toast.sessionUnlinked"), task.title)
    },

    deleteTask: async (session, task, removeWorktreeFlag) => {
      if (task.serverID && task.serverID !== session.server.id) {
        notify("error", ctx.t("toast.sessionOtherServer"))
        return
      }
      const worktree = hasManagedWorktree(task) ? task.worktreePath : undefined
      if (removeWorktreeFlag && worktree) {
        try {
          await removeWorktree(
            session.server.client,
            task.projectID,
            worktree,
            false,
            ctx.signal,
          )
        } catch (first) {
          const force = await ctx.dialogs.confirm({
            title: ctx.t("task.delete.force.title"),
            description: `${ctx.t("task.delete.force.description")}\n\n${errorText(first)}`,
            confirm: ctx.t("task.delete.force.confirm"),
            danger: true,
          })
          if (!force) throw first
          await removeWorktree(
            session.server.client,
            task.projectID,
            worktree,
            true,
            ctx.signal,
          )
        }
      }
      ctx.stores.board.set(deleteTaskModel(board(), task.id))
      live.invalidate()
      if (selectedTaskID() === task.id) setSelectedTaskID(undefined)
      const deleted = task.serverID ? task : { ...task, serverID: session.server.id }
      const removedWorktree = removeWorktreeFlag && !!worktree
      if (removedWorktree) {
        notify("success", ctx.t("toast.taskDeleted"), `${deleted.title} · ${ctx.t("toast.worktreeRemoved")}`)
      } else if (worktree) {
        showUndo(
          ctx.t("toast.taskDeleted"),
          deleted,
          () => undoDelete(deleted),
          `${deleted.title} · ${ctx.t("toast.worktreeKept")}`,
        )
      } else {
        showUndo(ctx.t("toast.taskDeleted"), deleted, () => undoDelete(deleted))
      }
    },

    archiveTask: (task: Task) => {
      const current = ctx.sessions.current()
      const next = current ? claimTask(board(), task.id, current.server.id) : board()
      ctx.stores.board.set(archiveTaskModel(next, task.id))
      live.invalidate()
      if (selectedTaskID() === task.id) setSelectedTaskID(undefined)
      showUndo(ctx.t("toast.taskArchived"), task, () => undoArchive(task))
    },

    restoreTask: (task: Task) => {
      const current = ctx.sessions.current()
      const next = current ? claimTask(board(), task.id, current.server.id) : board()
      ctx.stores.board.set(restoreTaskModel(next, task.id))
      live.invalidate()
      notify("success", ctx.t("action.restore"), task.title)
    },

    updateTask: (task: Task, patch) => {
      const current = ctx.sessions.current()
      const next = current ? claimTask(board(), task.id, current.server.id) : board()
      ctx.stores.board.set(updateTaskModel(next, task.id, patch))
      live.invalidate()
    },

    moveTask: (task: Task, direction: "left" | "right" | "up" | "down") => {
      const current = ctx.sessions.current()
      const base = current ? claimTask(board(), task.id, current.server.id) : board()
      const next =
        direction === "left"
          ? moveTaskToCategory(base, task.id, -1)
          : direction === "right"
            ? moveTaskToCategory(base, task.id, 1)
            : moveTaskBy(base, task.id, direction === "up" ? -1 : 1)
      ctx.stores.board.set(next)
      live.invalidate()
    },

    refresh: (session, projectID) => live.refresh(session.server.id, projectID),

    exportBoard: async (session, projectID) => {
      const project = findProject(projectsOf(session), projectID)
      if (!project) {
        notify("error", ctx.t("toast.noProject"))
        return
      }
      try {
        const snapshot = boardKey(ctx.stores.board.value)
        const json = JSON.stringify(ctx.stores.board.value, null, 2) + "\n"
        const response = (await ctx.client.rpc(KanbanBoard).save({
          directory: project.root,
          json,
        })) as { path: string; backupPath?: string }
        lastWritten = snapshot
        lastBoard = snapshot
        lastFile = json
        lastAutoError = undefined
        notify(
          "success",
          ctx.t("toast.boardExported"),
          response.backupPath
            ? `${response.path}\n${ctx.t("toast.boardBackupLabel")}: ${response.backupPath}`
            : response.path,
        )
      } catch (error) {
        const type = rpcErrorType(error)
        if (type === "rpc.method_not_found" || type === "rpc.unavailable") {
          notify("error", ctx.t("toast.boardReloadUnavailable"), errorText(error))
        } else {
          notify("error", ctx.t("toast.boardExportFailed"), errorText(error))
        }
      }
    },

    reloadBoard: async (session, projectID) => {
      const project = findProject(projectsOf(session), projectID)
      if (!project) {
        notify("error", ctx.t("toast.noProject"))
        return
      }
      if (ctx.stores.board.value.tasks.length > 0) {
        const ok = await ctx.dialogs.confirm({
          title: ctx.t("board.reload.confirm.title"),
          description: ctx.t("board.reload.confirm.body"),
          confirm: ctx.t("action.reloadBoard"),
          danger: true,
        })
        if (!ok) return

        try {
          await ctx.client.rpc(KanbanBoard).save({
            directory: project.root,
            json: JSON.stringify(ctx.stores.board.value, null, 2) + "\n",
            target: "backup",
          })
        } catch (error) {
          const type = rpcErrorType(error)
          if (type === "rpc.method_not_found" || type === "rpc.unavailable") {
            notify("error", ctx.t("toast.boardReloadUnavailable"), errorText(error))
          } else {
            notify("error", ctx.t("toast.boardBackupFailed"), errorText(error))
          }
          return
        }
      }

      try {
        const response = (await ctx.client.rpc(KanbanBoard).load({
          directory: project.root,
        })) as { path: string; json: string }
        const parsed: unknown = JSON.parse(response.json)
        if (!isBoardLike(parsed)) throw new Error(ctx.t("toast.boardReloadInvalid"))
        const next = mergeSessionBindings(normalizeBoard(parsed), board())
        ctx.stores.board.set(next)
        live.invalidate()
        lastFile = response.json
        lastBoard = boardKey(next)
        reloadConflict = false
        notify(
          "success",
          ctx.t("toast.boardReloaded"),
          ctx.t("toast.boardReloaded.body", { count: next.tasks.length }),
        )
      } catch (error) {
        const type = rpcErrorType(error)
        if (type === "not_found") {
          notify("error", ctx.t("toast.boardReloadMissing"), project.root)
        } else if (type === "invalid") {
          notify("error", ctx.t("toast.boardReloadInvalid"), errorText(error))
        } else if (type === "rpc.method_not_found" || type === "rpc.unavailable") {
          notify("error", ctx.t("toast.boardReloadUnavailable"), errorText(error))
        } else {
          notify("error", ctx.t("toast.boardReloadFailed"), errorText(error))
        }
      }
    },

    branches: (session, root) => listBranches(session.server.client, root, ctx.signal),

    vcs: (session, task) =>
      vcsChanges(session.server.client, taskDirectory(task), ctx.signal),

    reveal: async (path) => {
      if (!ctx.desktop) throw new Error("only available in OpenCode Desktop")
      const ok = await ctx.desktop.reveal(path)
      if (!ok) throw new Error(path)
      notify("success", ctx.t("toast.revealed"))
    },

    copy: async (text) => {
      try {
        await ctx.system.copy(text)
        notify("success", ctx.t("toast.copied"))
      } catch {
        notify("error", ctx.t("toast.copyFailed"))
      }
    },
  }

  const currentSession = (): MountedSession | undefined => {
    const session = ctx.sessions.current()
    if (!session) {
      notify("error", ctx.t("toast.noSession"))
      return undefined
    }
    return session
  }

  const requireSession = () => {
    const session = currentSession()
    if (!session) return undefined
    const project = projectFor(session)
    if (!project) {
      notify("error", ctx.t("toast.noProject"))
      return undefined
    }
    return { session, project }
  }

  const selectedTask = (): Task | undefined => {
    const id = selectedTaskID()
    if (!id) return undefined
    const task = board().tasks.find((item) => item.id === id)
    const current = ctx.sessions.current()
    if (task?.serverID && current && task.serverID !== current.server.id) return undefined
    return task
  }

  const requireTask = (): Task | undefined => {
    const task = selectedTask()
    if (!task) notify("default", ctx.t("toast.noTask"))
    return task
  }

  const setView = (view: "board" | "detail" | "archive" | "help") => {
    ctx.stores.prefs.set({ ...prefs(), view })
  }

  const openAtView = (view: "board" | "detail" | "archive" | "help") => {
    const target = requireSession()
    if (!target) return
    setView(view)
    services.openPanel(target.session)
  }

  const panelTab: PanelTab = {
    id: TAB_ID,
    get title() {
      return ctx.t("panel.title")
    },
    closable: "compact",
    fallback: true,
  }

  ctx.add(Panel, {
    id: TAB_ID,
    region: "side",
    width: 560,
    wide: true,
    mobile: {
      get title() {
        return ctx.t("panel.title")
      },
      order: 50,
      kind: "menu",
      icon: "task",
    },
    list: (input) => (input.open.includes(TAB_ID) ? [panelTab] : []),
    render: (props) => <KanbanPanel session={props.session} tab={props.tab} services={services} />,
  })

  ctx.add(MenuItem, (): MenuItemEntry => {
    const session = ctx.sessions.current()
    return {
      menu: "session.panel",
      id: TAB_ID,
      title: ctx.t("panel.title"),
      icon: "task",
      keybind: `${ctx.id}.open`,
      opened: !!session && ctx.layout.state(`${ctx.id}:${TAB_ID}`, session) !== "closed",
      run: () => {
        const current = ctx.sessions.current()
        if (current) services.openPanel(current)
      },
    }
  })

  ctx.add(
    Command,
    (): Command => ({
      id: "open",
      title: ctx.t("command.open"),
      keywords: "kanban board tasks worktree sessions",
      group: ctx.t("panel.title"),
      section: "session",
      bind: "mod+alt+k",
      slash: { name: "kanban" },
      enabled: !!ctx.sessions.current(),
      run: () => {
        const target = requireSession()
        if (target) services.openPanel(target.session)
      },
    }),
  )

  ctx.add(
    Command,
    (): Command => ({
      id: "board",
      title: ctx.t("command.board"),
      keywords: "kanban full board dialog",
      group: ctx.t("panel.title"),
      section: "session",
      bind: "mod+alt+shift+k",
      enabled: !!ctx.sessions.current(),
      run: () => {
        const target = requireSession()
        if (target) services.openFullBoard(target.session)
      },
    }),
  )

  ctx.add(
    Command,
    (): Command => ({
      id: "new-task",
      title: ctx.t("command.newTask"),
      keywords: "kanban new task create ticket card",
      group: ctx.t("panel.title"),
      section: "session",
      bind: "mod+alt+n",
      enabled: !!ctx.sessions.current(),
      run: () => {
        const target = requireSession()
        if (!target) return
        services.openTaskDialog(target.session, target.project.id)
      },
    }),
  )

  ctx.add(
    Command,
    (): Command => ({
      id: "new-column",
      title: ctx.t("command.newColumn"),
      keywords: "kanban columns categories rename color reorder",
      group: ctx.t("panel.title"),
      section: "session",
      run: () => {
        const target = requireSession()
        if (target) services.openColumnsDialog(target.project.id, target.project.name)
      },
    }),
  )

  ctx.add(
    Command,
    (): Command => ({
      id: "tags",
      title: ctx.t("command.tags"),
      keywords: "kanban tags labels manage",
      group: ctx.t("panel.title"),
      section: "session",
      run: () => {
        const target = requireSession()
        if (target) services.openTagsDialog(target.project.id, target.project.name)
      },
    }),
  )

  ctx.add(
    Command,
    (): Command => ({
      id: "detail",
      title: ctx.t("command.detail"),
      keywords: "kanban detail task",
      group: ctx.t("panel.title"),
      section: "session",
      enabled: !!ctx.sessions.current(),
      run: () => openAtView("detail"),
    }),
  )

  ctx.add(
    Command,
    (): Command => ({
      id: "archive-view",
      title: ctx.t("command.archiveView"),
      keywords: "kanban archive archived",
      group: ctx.t("panel.title"),
      section: "session",
      enabled: !!ctx.sessions.current(),
      run: () => openAtView("archive"),
    }),
  )

  ctx.add(
    Command,
    (): Command => ({
      id: "help",
      title: ctx.t("command.help"),
      keywords: "kanban help controls keys",
      group: ctx.t("panel.title"),
      section: "session",
      enabled: !!ctx.sessions.current(),
      run: () => openAtView("help"),
    }),
  )

  ctx.add(
    Command,
    (): Command => ({
      id: "archive-task",
      title: ctx.t("command.archive"),
      keywords: "kanban archive task",
      group: ctx.t("panel.title"),
      section: "session",
      enabled: selectedTaskID() !== undefined,
      run: () => {
        const task = requireTask()
        if (task) services.archiveTask(task)
      },
    }),
  )

  ctx.add(
    Command,
    (): Command => ({
      id: "open-session",
      title: ctx.t("command.openSession"),
      keywords: "kanban open attach session task",
      group: ctx.t("panel.title"),
      section: "session",
      enabled: selectedTaskID() !== undefined,
      run: () => {
        const target = requireSession()
        const task = requireTask()
        if (target && task) void services.openTask(target.session, task)
      },
    }),
  )

  ctx.add(
    Command,
    (): Command => ({
      id: "new-session",
      title: ctx.t("command.newSession"),
      keywords: "kanban new session fresh context task",
      group: ctx.t("panel.title"),
      section: "session",
      enabled: selectedTaskID() !== undefined,
      run: () => {
        const target = requireSession()
        const task = requireTask()
        if (target && task) void services.openTask(target.session, task, "new")
      },
    }),
  )

  ctx.add(
    Command,
    (): Command => ({
      id: "link-session",
      title: ctx.t("command.linkSession"),
      keywords: "kanban link attach session open task",
      group: ctx.t("panel.title"),
      section: "session",
      enabled: selectedTaskID() !== undefined,
      run: () => {
        const target = requireSession()
        const task = requireTask()
        if (target && task) void services.linkTaskSession(target.session, task)
      },
    }),
  )

  ctx.add(
    Command,
    (): Command => ({
      id: "link-current-session",
      title: ctx.t("command.linkCurrentSession"),
      keywords: "kanban link attach current session task",
      group: ctx.t("panel.title"),
      section: "session",
      enabled: selectedTaskID() !== undefined,
      run: () => {
        const target = requireSession()
        const task = requireTask()
        if (target && task) void services.linkTaskToCurrent(target.session, task)
      },
    }),
  )

  ctx.add(
    Command,
    (): Command => ({
      id: "unlink-session",
      title: ctx.t("command.unlinkSession"),
      keywords: "kanban unlink detach session task",
      group: ctx.t("panel.title"),
      section: "session",
      enabled: selectedTask()?.sessionID !== undefined,
      run: () => {
        const task = requireTask()
        if (task) services.unlinkTaskSession(task)
      },
    }),
  )

  ctx.add(
    Command,
    (): Command => ({
      id: "refresh",
      title: ctx.t("command.refresh"),
      keywords: "kanban refresh sessions status",
      group: ctx.t("panel.title"),
      section: "session",
      run: () => live.invalidate(),
    }),
  )

  ctx.add(
    Command,
    (): Command => ({
      id: "toggle-compact",
      title: ctx.t("command.compact"),
      keywords: "kanban compact dense columns density toggle",
      group: ctx.t("panel.title"),
      section: "session",
      run: () => {
        const current = ctx.stores.prefs.value.density ?? "comfortable"
        ctx.stores.prefs.set({
          ...ctx.stores.prefs.value,
          density: current === "compact" ? "comfortable" : "compact",
        })
      },
    }),
  )

  ctx.add(
    Command,
    (): Command => ({
      id: "export-board",
      title: ctx.t("command.exportBoard"),
      keywords: "kanban export save board json backup",
      group: ctx.t("panel.title"),
      section: "session",
      enabled: !!ctx.sessions.current(),
      run: () => {
        const target = requireSession()
        if (target) void services.exportBoard(target.session, target.project.id)
      },
    }),
  )

  ctx.add(
    Command,
    (): Command => ({
      id: "reload-board",
      title: ctx.t("command.reloadBoard"),
      keywords: "kanban reload import board json backup restore",
      group: ctx.t("panel.title"),
      section: "session",
      enabled: !!ctx.sessions.current(),
      run: () => {
        const target = requireSession()
        if (target) void services.reloadBoard(target.session, target.project.id)
      },
    }),
  )

  ctx.add(
    Command,
    (): Command => ({
      id: "search",
      title: ctx.t("command.search"),
      keywords: "kanban search filter find",
      group: ctx.t("panel.title"),
      section: "session",
      enabled: !!ctx.sessions.current(),
      run: () => {
        const target = requireSession()
        if (!target) return
        services.requestSearch()
        services.openPanel(target.session)
      },
    }),
  )

  const moveCommands: {
    id: string
    titleKey: string
    keywords: string
    direction: "left" | "right" | "up" | "down"
  }[] = [
    { id: "move-left", titleKey: "command.moveLeft", keywords: "kanban move task left column", direction: "left" },
    { id: "move-right", titleKey: "command.moveRight", keywords: "kanban move task right column", direction: "right" },
    { id: "move-up", titleKey: "command.moveUp", keywords: "kanban move task up reorder", direction: "up" },
    { id: "move-down", titleKey: "command.moveDown", keywords: "kanban move task down reorder", direction: "down" },
  ]

  for (const command of moveCommands) {
    ctx.add(
      Command,
      (): Command => ({
        id: command.id,
        title: ctx.t(command.titleKey),
        keywords: command.keywords,
        group: ctx.t("panel.title"),
        section: "session",
        enabled: selectedTaskID() !== undefined,
        run: () => {
          const task = requireTask()
          if (task) services.moveTask(task, command.direction)
        },
      }),
    )
  }

  ctx.add(Style, styles)

  ctx.add(SettingsPage, {
    id: "kanban-desktop",
    icon: "task",
    get title() {
      return ctx.t("settings.title")
    },
    get entries() {
      return [
        { id: "kanban-alignment", title: ctx.t("settings.alignment"), description: ctx.t("settings.alignment.description") },
        { id: "kanban-density", title: ctx.t("settings.density"), description: ctx.t("settings.density.description") },
        { id: "kanban-width", title: ctx.t("settings.columnWidth"), description: ctx.t("settings.columnWidth.description") },
        { id: "kanban-auto-export", title: ctx.t("settings.autoExport"), description: ctx.t("settings.autoExport.description") },
        { id: "kanban-auto-reload", title: ctx.t("settings.autoReload"), description: ctx.t("settings.autoReload.description") },
        { id: "kanban-default-category", title: ctx.t("settings.defaultCategory"), description: ctx.t("settings.defaultCategory.description") },
        { id: "kanban-open-mode", title: ctx.t("settings.openMode"), description: ctx.t("settings.openMode.description") },
        { id: "kanban-open-on-create", title: ctx.t("settings.openOnCreate"), description: ctx.t("settings.openOnCreate.description") },
        { id: "kanban-auto-prompt", title: ctx.t("settings.autoPrompt"), description: ctx.t("settings.autoPrompt.description") },
        { id: "kanban-prompt", title: ctx.t("settings.prompt"), description: ctx.t("settings.prompt.description") },
        { id: "kanban-poll", title: ctx.t("settings.poll"), description: ctx.t("settings.poll.description") },
        { id: "kanban-notify", title: ctx.t("settings.notify"), description: ctx.t("settings.notify.description") },
        { id: "kanban-pill", title: ctx.t("settings.pill"), description: ctx.t("settings.pill.description") },
        { id: "kanban-reset", title: ctx.t("settings.reset"), description: ctx.t("settings.reset.description") },
      ]
    },
    render: () => <KanbanSettings />,
  })

  const pillEnabled = () => ctx.options.pill !== false && ctx.stores.prefs.value.pill

  ctx.add(
    ComposerPill,
    (): ComposerPillItem => ({
      id: "status",
      order: 30,
      show: (input) => {
        if (!pillEnabled()) return undefined
        const project = projectFor(input.session)
        if (!project) return undefined
        const snapshot = live.peek(input.session.server.id, project.id)
        const tasks = ctx.stores.board.value.tasks.filter(
          (task) =>
            task.projectID === project.id &&
            (!task.serverID || task.serverID === input.session.server.id) &&
            !task.archived,
        )
        if (!snapshot || tasks.length === 0) return undefined
        const running = tasks.filter((task) => snapshot.tasks[task.id]?.status === "running")
        return {
          icon: "task",
          label:
            running.length > 0
              ? ctx.t("pill.running", { count: running.length })
              : ctx.t("pill.tasks", { count: tasks.length }),
          tone: running.length > 0 ? "warning" : undefined,
          title: ctx.t("pill.title"),
          rows: running.slice(0, 5).map((task) => ({
            id: task.id,
            label: task.title,
            icon: "task" as const,
            detail: snapshot.tasks[task.id]?.sessionTitle ?? ctx.t("status.running"),
            run: () => void services.openTask(input.session, task),
          })),
          run: () => services.openPanel(input.session),
        }
      },
    }),
  )

  createKeyed(
    () => {
      const session = ctx.sessions.current()
      if (!session || !(pillEnabled() || ctx.stores.prefs.value.notify)) return undefined
      const project = projectFor(session)
      return project ? `${session.server.id}\n${project.id}` : undefined
    },
    () => {
      const session = ctx.sessions.current()
      if (!session) return
      const project = projectFor(session)
      if (!project) return
      const stop = live.watch(services.target(session, project.id), () => {})
      onCleanup(stop)
    },
  )

  createEffect(on(() => ctx.stores.prefs.value.pollMs, () => live.applyPoll(), { defer: true }))

  return () => {
    live.dispose()
  }
}
