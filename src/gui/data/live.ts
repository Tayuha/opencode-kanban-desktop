import type { OpenCodeClient } from "@opencode/client/promise"
import type { Data } from "@opencode/client/solid"
import { createSignal } from "solid-js"
import type { LiveTask, SessionRow, Task, TaskStatus, TodoSummary } from "../model/types.ts"
import { completed, deriveLive, normalizePath, sessionRows } from "../model/status.ts"
import { parseTodos } from "../model/todo.ts"

export type LiveTarget = {
  serverID: string
  projectID: string
  /** Read where used: a restarted server gets a new client under the same id. */
  client: () => OpenCodeClient
  data: () => Data
  tasks: () => readonly Task[]
  projectName: () => string
}

export type LiveSnapshot = {
  tasks: Record<string, LiveTask>
  sessions: SessionRow[]
  updatedAt: number
  loading: boolean
  stale: boolean
  error?: string
}

export type LiveTransition = {
  taskID: string
  task: Task
  serverID: string
  sessionID: string
  sessionUpdated?: number
  projectName: string
  from: TaskStatus
  to: TaskStatus
  at: number
}

export type LiveListener = (state: LiveSnapshot) => void

export type LiveOptions = {
  debounceMs?: () => number
  pollMs?: () => number
  /** Called when a bound session stops running. */
  onTransition?: (transition: LiveTransition) => void
  /** Called when a pinned session is confirmed deleted by the server. */
  onMissingPin?: (event: {
    serverID: string
    projectID: string
    sessionID: string
    taskIDs: string[]
  }) => void
}

type ServerSub = { data: Data; stop: () => void }

type TodoCacheEntry = { at: number; summary?: TodoSummary }

type Entry = {
  key: string
  serverID: string
  projectID: string
  target: LiveTarget
  state: LiveSnapshot
  listeners: Set<LiveListener>
  timer?: ReturnType<typeof setTimeout>
  poll?: ReturnType<typeof setInterval>
  task?: Promise<void>
  abort?: AbortController
  dirty: boolean
  active: boolean
  /** Pinned sessions that recently failed to load; retried after a short TTL. */
  pinnedMisses: Map<string, number>
  previous?: Record<string, LiveTask>
  todos: Map<string, TodoCacheEntry>
}

const EMPTY: LiveSnapshot = { tasks: {}, sessions: [], updatedAt: 0, loading: false, stale: false }
const DEFAULT_DEBOUNCE_MS = 500
const DEFAULT_POLL_MS = 15_000
const TODO_TTL_MS = 60_000
const TODO_EMPTY_TTL_MS = 30_000
const TODO_LIMIT = 100
const PINNED_MISS_TTL_MS = 60_000
const PINNED_FETCH_LIMIT = 50

function keyOf(serverID: string, projectID: string): string {
  return `${serverID}\n${projectID}`
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

/** Detects a server-confirmed missing session without importing the client runtime. */
function sessionNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const value = error as { _tag?: unknown; status?: unknown; type?: unknown; message?: unknown }
  if (value._tag === "SessionNotFoundError") return true
  if (value.status === 404) return true
  const text = `${String(value.type ?? "")} ${String(value.message ?? "")}`.toLowerCase()
  return text.includes("session") && (text.includes("not found") || text.includes("not_found"))
}

/**
 * One live board per server and project. Refreshes on session events, keeps the last
 * good snapshot when a read fails, and fetches todo lists behind the session status.
 */
export function createLiveBoard(options: LiveOptions = {}) {
  const entries = new Map<string, Entry>()
  const serverSubs = new Map<string, ServerSub>()
  const [version, bump] = createSignal(0)
  let disposed = false

  const debounceMs = () => options.debounceMs?.() ?? DEFAULT_DEBOUNCE_MS
  const pollMs = () => options.pollMs?.() ?? DEFAULT_POLL_MS

  const emit = (entry: Entry) => {
    for (const listener of entry.listeners) listener(entry.state)
    bump((value) => value + 1)
  }

  const stopPoll = (entry: Entry) => {
    if (entry.poll) clearInterval(entry.poll)
    entry.poll = undefined
  }

  const startPoll = (entry: Entry) => {
    stopPoll(entry)
    const ms = pollMs()
    if (ms > 0) entry.poll = setInterval(() => void runRefresh(entry), ms)
  }

  const schedule = (entry: Entry, delay = debounceMs()) => {
    if (!entry.active || entry.timer) return
    entry.timer = setTimeout(() => {
      entry.timer = undefined
      void runRefresh(entry)
    }, delay)
  }

  const subscribe = (serverID: string, data: Data, invalidate: () => void) => {
    const current = serverSubs.get(serverID)
    if (current?.data === data) return
    current?.stop()

    const cleanups = [
      data.on("session.created", invalidate),
      data.on("session.deleted", invalidate),
      data.on("session.moved", invalidate),
      data.on("session.archived", invalidate),
      data.on("session.unarchived", invalidate),
      data.on("session.status", invalidate),
      data.on("session.execution.started", invalidate),
      data.on("session.execution.succeeded", invalidate),
      data.on("session.execution.failed", invalidate),
      data.on("session.execution.interrupted", invalidate),
      data.on("worktree.updated", invalidate),
    ]
    serverSubs.set(serverID, { data, stop: () => cleanups.forEach((cleanup) => cleanup()) })
  }

  const invalidateServer = (serverID: string) => {
    for (const entry of entries.values()) {
      if (entry.serverID === serverID) schedule(entry)
    }
  }

  const cachedTodos = (entry: Entry, sessionID: string): TodoSummary | undefined => {
    const cached = entry.todos.get(sessionID)
    if (!cached) return undefined
    const ttl = cached.summary ? TODO_TTL_MS : TODO_EMPTY_TTL_MS
    if (Date.now() - cached.at > ttl) return undefined
    return cached.summary
  }

  const fetchTodos = async (entry: Entry, sessionID: string, signal: AbortSignal) => {
    const cached = entry.todos.get(sessionID)
    const ttl = cached?.summary ? TODO_TTL_MS : TODO_EMPTY_TTL_MS
    if (cached && Date.now() - cached.at < ttl) return false
    try {
      const response = await entry.target
        .client()
        .message.list({ sessionID, limit: TODO_LIMIT, order: "desc" }, { signal })
      entry.todos.set(sessionID, { at: Date.now(), summary: parseTodos(response.data) })
      return true
    } catch {
      entry.todos.set(sessionID, { at: Date.now(), summary: cached?.summary })
      return false
    }
  }

  const hydrateTodos = async (entry: Entry, snapshot: LiveSnapshot, signal: AbortSignal) => {
    const sessionIDs: string[] = []
    for (const live of Object.values(snapshot.tasks)) {
      if (!live.sessionID) continue
      sessionIDs.push(live.sessionID)
      const running = live.subagents.filter((subagent) => subagent.status === "running").slice(0, 5)
      sessionIDs.push(...running.map((subagent) => subagent.id))
    }
    if (sessionIDs.length === 0) return
    let changed = false
    for (let index = 0; index < sessionIDs.length; index += 3) {
      const batch = sessionIDs.slice(index, index + 3)
      const results = await Promise.all(batch.map((id) => fetchTodos(entry, id, signal)))
      changed = results.some(Boolean) || changed
    }
    if (!changed || signal.aborted || !entry.active) return
    entry.state = { ...entry.state, tasks: rebuild(entry, entry.state.sessions) }
    emit(entry)
  }

  const rebuild = (entry: Entry, sessions: SessionRow[]): Record<string, LiveTask> => {
    const now = Date.now()
    const tasks = entry.target
      .tasks()
      .filter(
        (task) =>
          task.projectID === entry.projectID && (!task.serverID || task.serverID === entry.serverID),
      )
    return Object.fromEntries(
      tasks.map((task) => [task.id, deriveLive(task, sessions, (id) => cachedTodos(entry, id), now)]),
    )
  }

  const runRefresh = (entry: Entry): Promise<void> => {
    if (!entry.active) return Promise.resolve()
    if (entry.task) {
      entry.dirty = true
      return entry.task
    }
    if (entry.timer) clearTimeout(entry.timer)
    entry.timer = undefined
    entry.dirty = false

    const abort = new AbortController()
    entry.abort = abort
    entry.state = { ...entry.state, loading: true }
    emit(entry)

    entry.task = (async () => {
      try {
        const client = entry.target.client()
        const data = entry.target.data()
        subscribe(entry.serverID, data, () => invalidateServer(entry.serverID))

        const [projectSessions, active] = await Promise.all([
          client.session.list({ project: entry.projectID, limit: 200, archived: false }, { signal: abort.signal }),
          client.session.active({ signal: abort.signal }),
        ])
        if (!entry.active || abort.signal.aborted) return

        let sessions = projectSessions.data
        if (sessions.length === 0) {
          // Older servers ignore the project filter; fall back to the server-wide page.
          const all = await client.session.list({ limit: 200, archived: false }, { signal: abort.signal })
          if (!entry.active || abort.signal.aborted) return
          sessions = all.data
        }

        const pinned = new Set(
          entry.target
            .tasks()
            .filter(
              (task) =>
                task.projectID === entry.projectID &&
                (!task.serverID || task.serverID === entry.serverID) &&
                task.sessionID,
            )
            .map((task) => task.sessionID!),
        )
        const known = new Set(sessions.map((session) => session.id))
        const lookupAt = Date.now()
        const missingPins = [...pinned]
          .filter(
            (id) =>
              !known.has(id) &&
              (entry.pinnedMisses.get(id) ?? 0) < lookupAt - PINNED_MISS_TTL_MS,
          )
          .slice(0, PINNED_FETCH_LIMIT)
        if (missingPins.length > 0 && typeof client.session.get === "function") {
          const fetched = await Promise.all(
            missingPins.map(async (sessionID) => {
              try {
                const info = await client.session.get({ sessionID }, { signal: abort.signal })
                if (!info) {
                  entry.pinnedMisses.set(sessionID, lookupAt)
                  return undefined
                }
                entry.pinnedMisses.delete(sessionID)
                return info
              } catch (error) {
                entry.pinnedMisses.set(sessionID, lookupAt)
                if (sessionNotFound(error)) {
                  const taskIDs = entry.target
                    .tasks()
                    .filter(
                      (task) =>
                        task.projectID === entry.projectID &&
                        (!task.serverID || task.serverID === entry.serverID) &&
                        task.sessionID === sessionID,
                    )
                    .map((task) => task.id)
                  if (taskIDs.length > 0) {
                    options.onMissingPin?.({
                      serverID: entry.serverID,
                      projectID: entry.projectID,
                      sessionID,
                      taskIDs,
                    })
                  }
                }
                return undefined
              }
            }),
          )
          if (!entry.active || abort.signal.aborted) return
          const extra = fetched.filter((info): info is NonNullable<typeof info> => info !== undefined)
          if (extra.length > 0) sessions = [...sessions, ...extra]
        }

        const worktrees = new Set(
          entry.target
            .tasks()
            .filter(
              (task) =>
                task.projectID === entry.projectID &&
                (!task.serverID || task.serverID === entry.serverID) &&
                (task.directory || task.worktreePath),
            )
            .map((task) => normalizePath((task.directory ?? task.worktreePath)!)),
        )
        const rows = sessionRows(
          sessions.filter(
            (session) =>
              (!session.time.archived || pinned.has(session.id)) &&
              (session.projectID === entry.projectID ||
                pinned.has(session.id) ||
                (session.location?.directory && worktrees.has(normalizePath(session.location.directory)))),
          ),
          active,
        )
        const tasks = rebuild(entry, rows)
        const previous = entry.previous

        if (previous) {
          for (const [taskID, live] of Object.entries(tasks)) {
            const before = previous[taskID]
            if (!completed(before, live) || !live.sessionID) continue
            const task = entry.target.tasks().find((item) => item.id === taskID)
            if (!task || task.archived) continue
            options.onTransition?.({
              taskID,
              task,
              serverID: entry.serverID,
              sessionID: live.sessionID,
              sessionUpdated: live.sessionUpdated,
              projectName: entry.target.projectName(),
              from: before!.status,
              to: live.status,
              at: Date.now(),
            })
          }
        }

        entry.previous = tasks
        entry.state = {
          tasks,
          sessions: rows,
          updatedAt: Date.now(),
          loading: false,
          stale: false,
        }
        emit(entry)
        await hydrateTodos(entry, entry.state, abort.signal)
      } catch (error) {
        if (!entry.active || abort.signal.aborted) return
        entry.state = {
          ...entry.state,
          loading: false,
          stale: true,
          error: errorMessage(error),
        }
      } finally {
        entry.task = undefined
        entry.abort = undefined
        if (entry.active) {
          emit(entry)
          if (entry.dirty) schedule(entry)
        }
      }
    })()

    return entry.task
  }

  const stopEntry = (entry: Entry) => {
    entry.active = false
    entry.abort?.abort()
    if (entry.timer) clearTimeout(entry.timer)
    stopPoll(entry)
    entries.delete(entry.key)
    let stillUsed = false
    for (const other of entries.values()) {
      if (other.serverID === entry.serverID) {
        stillUsed = true
        break
      }
    }
    if (!stillUsed) {
      serverSubs.get(entry.serverID)?.stop()
      serverSubs.delete(entry.serverID)
    }
  }

  const watch = (target: LiveTarget, listener: LiveListener): (() => void) => {
    if (disposed) return () => {}
    const key = keyOf(target.serverID, target.projectID)
    let entry = entries.get(key)
    if (!entry) {
      entry = {
        key,
        serverID: target.serverID,
        projectID: target.projectID,
        target,
        state: EMPTY,
        listeners: new Set(),
        dirty: false,
        active: true,
        todos: new Map(),
        pinnedMisses: new Map(),
      }
      entries.set(key, entry)
      subscribe(target.serverID, target.data(), () => invalidateServer(target.serverID))
      startPoll(entry)
    } else {
      entry.target = target
    }

    entry.listeners.add(listener)
    listener(entry.state)
    if (entry.state.updatedAt === 0 && !entry.task) void runRefresh(entry)

    const watched = entry
    let watching = true
    return () => {
      if (!watching) return
      watching = false
      watched.listeners.delete(listener)
      if (watched.listeners.size === 0) stopEntry(watched)
    }
  }

  return {
    watch,

    refresh(serverID: string, projectID: string): Promise<void> {
      const entry = entries.get(keyOf(serverID, projectID))
      if (!entry) return Promise.resolve()
      return runRefresh(entry)
    },

    invalidate(serverID?: string, projectID?: string): void {
      for (const entry of entries.values()) {
        if (serverID && entry.serverID !== serverID) continue
        if (projectID && entry.projectID !== projectID) continue
        schedule(entry, 0)
      }
    },

    /** Cached state, reactive through the registry's revision signal. */
    peek(serverID: string, projectID: string): LiveSnapshot | undefined {
      version()
      return entries.get(keyOf(serverID, projectID))?.state
    },

    /** Re-arms poll intervals after a settings change. */
    applyPoll(): void {
      for (const entry of entries.values()) startPoll(entry)
    },

    forget(serverID: string, projectID: string): void {
      const entry = entries.get(keyOf(serverID, projectID))
      if (entry) stopEntry(entry)
    },

    dispose(): void {
      if (disposed) return
      disposed = true
      for (const entry of [...entries.values()]) stopEntry(entry)
      for (const sub of serverSubs.values()) sub.stop()
      serverSubs.clear()
      entries.clear()
    },
  }
}

export type LiveBoard = ReturnType<typeof createLiveBoard>
