import type { Board, BoardMap, Category, Prefs, Task, Tag } from "./types.ts"
import { BOARD_VERSION, defaultBoard, normalizeBoard, sameBoard, tagsOf } from "./board.ts"
import { normalizePath } from "./status.ts"

/**
 * A board's storage key is its canonical project folder. Tasks from duplicate
 * OpenCode project ids for the same folder therefore share one board.
 * A task without a root falls back to `id:<projectID>` for migration.
 */
export function projectKey(root: string | undefined, fallbackID = ""): string {
  const clean = normalizePath(root ?? "")
  if (clean) return clean
  return fallbackID ? `id:${fallbackID}` : ""
}

/** Resolves the key to read/write, keeping a migrated root-less board addressable. */
export function boardKeyFor(
  map: BoardMap,
  root: string | undefined,
  projectID?: string,
): string {
  const key = projectKey(root, projectID)
  const legacy = projectID ? projectKey(undefined, projectID) : ""
  if (key && map[key]) return key
  if (legacy && map[legacy]) return legacy
  return key
}

export function boardIn(map: BoardMap, key: string | undefined): Board {
  return key && map[key] ? map[key]! : defaultBoard()
}

export function boardForProject(
  map: BoardMap,
  root: string | undefined,
  projectID?: string,
): Board {
  return boardIn(map, boardKeyFor(map, root, projectID))
}

export function findTaskIn(
  map: BoardMap,
  taskID: string | undefined,
): { key: string; board: Board; task: Task } | undefined {
  if (!taskID) return undefined
  for (const [key, board] of Object.entries(map)) {
    const task = board.tasks.find((item) => item.id === taskID)
    if (task) return { key, board, task }
  }
  return undefined
}

export function withBoard(map: BoardMap, key: string, board: Board): BoardMap {
  if (!key) return map
  const current = map[key]
  if (current && sameBoard(current, board)) return map
  return { ...map, [key]: board }
}

/** The folder a project's snapshot is read from and written to. */
export function boardDirectory(prefs: Pick<Prefs, "boardDirs">, key: string, fallback: string): string {
  const override = prefs.boardDirs?.[key]?.trim()
  return override || fallback
}

function projectSlice(board: Board, key: string, projectID?: string): Board {
  if (!key && !projectID) return defaultBoard()
  const match = (task: Task) =>
    (!!key && projectKey(task.projectRoot, task.projectID) === key) ||
    (!!projectID && !task.projectRoot && task.projectID === projectID)
  const tasks = board.tasks.filter(match)
  if (tasks.length === 0) return defaultBoard()

  const owner = tasks[0]!.projectID
  const columns: readonly Category[] =
    board.categoriesByProject?.[owner] ?? board.categories
  const tags: readonly Tag[] = tagsOf(board, owner)
  return normalizeBoard({
    version: BOARD_VERSION,
    categories: columns,
    tags: [...tags],
    tasks,
  })
}

/**
 * Keeps only one project's slice of a board file. This makes a legacy whole-installation
 * snapshot safe to load per project and ignores hand-edited tasks for other folders.
 */
export function scopeBoardToProject(board: Board, key: string, projectID?: string): Board {
  return projectSlice(normalizeBoard(board), key, projectID)
}

/** Splits the legacy single global board into one board per project folder. */
export function splitLegacyBoard(legacy: Board): BoardMap {
  const normalized = normalizeBoard(legacy)
  const groups = new Map<string, Task[]>()
  for (const task of normalized.tasks) {
    const key = projectKey(task.projectRoot, task.projectID)
    if (!key) continue
    const group = groups.get(key)
    if (group) group.push(task)
    else groups.set(key, [task])
  }

  const map: Record<string, Board> = {}
  for (const [key, tasks] of groups) {
    const owner = tasks[0]?.projectID
    const columns = owner
      ? (normalized.categoriesByProject?.[owner] ?? normalized.categories)
      : normalized.categories
    const tags = owner ? tagsOf(normalized, owner) : (normalized.tags ?? [])
    map[key] = normalizeBoard({
      version: BOARD_VERSION,
      categories: columns,
      tags: [...tags],
      tasks,
    })
  }
  return map
}
