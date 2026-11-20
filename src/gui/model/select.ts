import type { Board, Task } from "./types.ts"
import { tasksFor, archivedTasks, categories } from "./board.ts"

export function matchesQuery(task: Task, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return [task.title, task.branch, task.projectName, task.notes ?? ""].some((value) =>
    value.toLowerCase().includes(needle),
  )
}

/** Tags use AND semantics: a task must carry every selected tag. */
export function matchesTags(task: Task, tagIDs: readonly string[]): boolean {
  if (tagIDs.length === 0) return true
  const assigned = new Set(task.tagIDs ?? [])
  return tagIDs.every((id) => assigned.has(id))
}

export function visibleTasks(
  board: Board,
  projectID: string,
  categoryID: string,
  query: string,
  tagIDs: readonly string[] = [],
  serverID?: string,
): Task[] {
  return tasksFor(board, projectID, categoryID, false, serverID).filter(
    (task) => matchesQuery(task, query) && matchesTags(task, tagIDs),
  )
}

export function visibleArchive(
  board: Board,
  projectID: string,
  query: string,
  tagIDs: readonly string[] = [],
  serverID?: string,
): Task[] {
  return archivedTasks(board, projectID, serverID).filter(
    (task) => matchesQuery(task, query) && matchesTags(task, tagIDs),
  )
}

export function visibleBoard(
  board: Board,
  projectID: string,
  query: string,
  tagIDs: readonly string[] = [],
  serverID?: string,
): { categoryID: string; tasks: Task[] }[] {
  return categories(board, projectID).map((category) => ({
    categoryID: category.id,
    tasks: visibleTasks(board, projectID, category.id, query, tagIDs, serverID),
  }))
}

export function firstVisibleTask(
  board: Board,
  projectID: string,
  categoryID: string | undefined,
  query: string,
  tagIDs: readonly string[] = [],
  serverID?: string,
): Task | undefined {
  const ordered = categoryID
    ? visibleTasks(board, projectID, categoryID, query, tagIDs, serverID)
    : visibleBoard(board, projectID, query, tagIDs, serverID).flatMap((column) => column.tasks)
  return ordered[0]
}

export function neighbours(
  board: Board,
  task: Task,
  query: string,
  tagIDs: readonly string[] = [],
): { previous?: Task; next?: Task } {
  const list = visibleTasks(board, task.projectID, task.categoryID, query, tagIDs, task.serverID)
  const index = list.findIndex((item) => item.id === task.id)
  if (index < 0) return {}
  return { previous: list[index - 1], next: list[index + 1] }
}

export function statusLabelKey(status: string): string {
  switch (status) {
    case "running":
      return "status.running"
    case "idle":
      return "status.idle"
    default:
      return "status.noSession"
  }
}
