import type { SessionActive, SessionInfo } from "@opencode/client/promise"
import type { LiveTask, SessionRow, SubagentLive, Task, TaskStatus, TodoSummary } from "./types.ts"

export type ActiveMap = Record<string, SessionActive | undefined>

/** Compares workspace directories without caring about a trailing slash or Windows separators. */
export function normalizePath(path: string): string {
  const slashed = path.replace(/\\/g, "/").replace(/\/+$/, "")
  return /^[a-zA-Z]:\//.test(slashed) ? slashed.toLowerCase() : slashed
}

export function samePath(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  return normalizePath(a) === normalizePath(b)
}

export function sessionRows(sessions: readonly SessionInfo[], active: ActiveMap): SessionRow[] {
  return sessions.map((session) => ({
    id: session.id,
    parentID: session.parentID,
    projectID: session.projectID,
    directory: session.location?.directory ?? "",
    title: session.title,
    cost: session.cost ?? 0,
    updated: session.time?.updated ?? session.time?.created ?? 0,
    running: active[session.id] !== undefined,
  }))
}

/** The session a task owns: its pinned session, else (for unpinned tasks) the newest root in its directory. */
export function matchTaskSession(
  task: Pick<Task, "sessionID" | "projectID" | "worktreePath" | "directory">,
  sessions: readonly SessionRow[],
): SessionRow | undefined {
  const roots = sessions.filter((session) => !session.parentID)
  if (task.sessionID) {
    // A pin is authoritative. Never substitute a different worktree session when it is absent.
    return roots.find((session) => session.id === task.sessionID)
  }
  const directory = task.directory ?? task.worktreePath
  if (!directory) return undefined
  const candidates = roots
    .filter(
      (session) => session.projectID === task.projectID && samePath(session.directory, directory),
    )
    .sort((a, b) => b.updated - a.updated)
  if (candidates[0]) return candidates[0]
  // A worktree can be listed under a sibling project record; its path is still unique.
  return roots
    .filter((session) => samePath(session.directory, directory))
    .sort((a, b) => b.updated - a.updated)[0]
}

export function descendants(rootID: string, sessions: readonly SessionRow[]): SessionRow[] {
  const children = new Map<string, SessionRow[]>()
  for (const session of sessions) {
    if (!session.parentID) continue
    const list = children.get(session.parentID) ?? []
    list.push(session)
    children.set(session.parentID, list)
  }

  const result: SessionRow[] = []
  const queue = [...(children.get(rootID) ?? [])]
  const seen = new Set<string>([rootID])
  while (queue.length > 0) {
    const session = queue.shift()!
    if (seen.has(session.id)) continue
    seen.add(session.id)
    result.push(session)
    queue.push(...(children.get(session.id) ?? []))
  }
  return result
}

export function statusOf(session: SessionRow | undefined): TaskStatus {
  if (!session) return "none"
  return session.running ? "running" : "idle"
}

export type TodoLookup = (sessionID: string) => TodoSummary | undefined

export function deriveLive(
  task: Task,
  sessions: readonly SessionRow[],
  todos?: TodoLookup,
  now = Date.now(),
): LiveTask {
  const root = matchTaskSession(task, sessions)
  const subagents: SubagentLive[] = root
    ? descendants(root.id, sessions).map((session) => ({
        id: session.id,
        title: session.title?.trim() || session.id,
        status: statusOf(session),
        cost: session.cost,
        updated: session.updated,
        todos: todos?.(session.id),
      }))
    : []

  return {
    taskID: task.id,
    status: statusOf(root),
    sessionID: root?.id,
    sessionTitle: root?.title,
    sessionUpdated: root?.updated,
    cost: (root?.cost ?? 0) + subagents.reduce((sum, session) => sum + session.cost, 0),
    subagents,
    runningSubagents: subagents.filter((session) => session.status === "running").length,
    todos: root ? todos?.(root.id) : undefined,
    updatedAt: now,
  }
}

export function emptyLive(task: Task, now = Date.now()): LiveTask {
  return {
    taskID: task.id,
    status: "none",
    cost: 0,
    subagents: [],
    runningSubagents: 0,
    updatedAt: now,
  }
}

/** True when a task's session went from running to idle, the moment worth a notification. */
export function completed(previous: LiveTask | undefined, next: LiveTask): boolean {
  return previous?.status === "running" && (next.status === "idle" || next.status === "none")
}

export function todoDone(summary: TodoSummary | undefined): number {
  return summary?.done ?? 0
}

export function todoTotal(summary: TodoSummary | undefined): number {
  return summary?.total ?? 0
}
