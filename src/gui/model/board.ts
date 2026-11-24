import type { Board, Category, Prefs, Tag, Task } from "./types.ts"

export const BOARD_VERSION = 1

export const COLORS = [
  "#5b8def",
  "#c47f2c",
  "#8b5cf6",
  "#2f9e6e",
  "#d05c5c",
  "#3f9aa8",
  "#b05c9e",
  "#7a8699",
]

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "todo", name: "Todo", color: COLORS[0], position: 0 },
  { id: "in-progress", name: "In progress", color: COLORS[1], position: 1 },
  { id: "done", name: "Done", color: COLORS[3], position: 2 },
]

export const DEFAULT_PREFS: Prefs = {
  view: "board",
  alignment: "fit",
  columnWidth: 280,
  density: "comfortable",
  pollMs: 15_000,
  autoExport: true,
  autoReload: true,
  notify: true,
  pill: true,
  openMode: "reuse",
  openOnCreate: true,
  autoPrompt: false,
  initialPrompt: "",
}

const ADJECTIVES = [
  "amber",
  "brave",
  "calm",
  "eager",
  "fuzzy",
  "gentle",
  "happy",
  "keen",
  "lively",
  "mellow",
  "nimble",
  "proud",
  "quiet",
  "rapid",
  "sunny",
  "tidy",
  "vivid",
  "witty",
]

const NOUNS = [
  "otter",
  "falcon",
  "harbor",
  "lens",
  "meadow",
  "comet",
  "panda",
  "quartz",
  "river",
  "saddle",
  "timber",
  "violin",
  "willow",
  "zebra",
  "anchor",
  "beacon",
  "cinder",
  "drift",
]

const HEX_COLOR = /^#[0-9a-f]{6}$/i

/** Keeps a stored or hand-edited color from reaching a style attribute unvalidated. */
export function safeColor(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback
}

export function newID(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return `${prefix}_${uuid}`
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

function randomInt(max: number): number {
  const crypto = globalThis.crypto
  if (crypto?.getRandomValues) {
    const bytes = new Uint32Array(1)
    crypto.getRandomValues(bytes)
    return bytes[0]! % max
  }
  return Math.floor(Math.random() * max)
}

/** A branch that is readable in a worktree list and unique enough to avoid collisions. */
export function generateBranch(prefix = "feature"): string {
  const adjective = ADJECTIVES[randomInt(ADJECTIVES.length)]!
  const noun = NOUNS[randomInt(NOUNS.length)]!
  const suffix = String(randomInt(1000)).padStart(3, "0")
  return `${prefix}/${adjective}-${noun}-${suffix}`
}

/** Conservative git branch validation, enough to catch the mistakes the dialog can make. */
export function validateBranch(branch: string): string | undefined {
  const value = branch.trim()
  if (!value) return "branch-required"
  if (value.startsWith("-")) return "branch-leading-dash"
  if (value.includes("..")) return "branch-double-dot"
  if (value.endsWith(".lock")) return "branch-lock"
  if (value.endsWith("/") || value.startsWith("/")) return "branch-slash"
  if (/[\s~^:?*[\\\x00-\x1f\x7f]/.test(value)) return "branch-invalid"
  if (value === "@") return "branch-invalid"
  return undefined
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** A cheap shape check before a file is allowed to replace the board. */
export function isBoardLike(value: unknown): value is Board {
  if (!isRecord(value)) return false
  if (!Array.isArray(value.categories) || value.categories.length === 0) return false
  if (!Array.isArray(value.tasks)) return false
  if (!value.categories.every((category) => isRecord(category) && typeof category.id === "string")) return false
  return value.tasks.every(
    (task) =>
      isRecord(task) &&
      typeof task.id === "string" &&
      typeof task.title === "string" &&
      typeof task.projectID === "string" &&
      typeof task.branch === "string" &&
      typeof task.categoryID === "string",
  )
}

export function defaultBoard(): Board {
  return {
    version: BOARD_VERSION,
    tags: [],
    categories: DEFAULT_CATEGORIES.map((category) => ({ ...category })),
    tasks: [],
  }
}

export function tagsOf(board: Board, projectID?: string): readonly Tag[] {
  if (projectID) {
    const project = board.tagsByProject?.[projectID]
    if (project) return project
  }
  return board.tags ?? []
}

function writeTags(board: Board, projectID: string, tags: readonly Tag[]): Board {
  return {
    ...board,
    tagsByProject: {
      ...(board.tagsByProject ?? {}),
      [projectID]: [...tags],
    },
  }
}

function sortedCategories(categories: readonly Category[]): Category[] {
  return [...categories].sort((a, b) => a.position - b.position)
}

function renumberCategories(categories: readonly Category[]): Category[] {
  return sortedCategories(categories).map((category, index) => ({ ...category, position: index }))
}

function categorySet(board: Board, projectID?: string): readonly Category[] {
  if (projectID) {
    const project = board.categoriesByProject?.[projectID]
    if (project && project.length > 0) return project
  }
  return board.categories
}

/** Stores a project's own columns. The global set stays untouched as the shared default. */
function writeCategories(board: Board, projectID: string, categories: readonly Category[]): Board {
  return {
    ...board,
    categoriesByProject: {
      ...(board.categoriesByProject ?? {}),
      [projectID]: categories.map((category, position) => ({ ...category, position })),
    },
  }
}

/** Legacy tasks without a server id are visible on any server that lists the project. */
export function taskInScope(task: Task, projectID: string, serverID?: string): boolean {
  return task.projectID === projectID && (!serverID || !task.serverID || task.serverID === serverID)
}

/** The directory a task runs in: an explicit existing folder, its worktree, or the project root. */
export function taskDirectory(task: Pick<Task, "directory" | "worktreePath" | "projectRoot">): string {
  return task.directory ?? task.worktreePath ?? task.projectRoot
}

/** Only a plugin-created worktree is eligible for removal; an existing folder is never removed. */
export function hasManagedWorktree(task: Pick<Task, "directory" | "worktreePath">): boolean {
  return !!task.worktreePath && !task.directory
}

function groupOf(tasks: readonly Task[], projectID: string, categoryID: string, serverID?: string): Task[] {
  return tasks
    .filter(
      (task) => taskInScope(task, projectID, serverID) && task.categoryID === categoryID,
    )
    .sort((a, b) => a.position - b.position || a.createdAt - b.createdAt)
}

function renumberGroup(tasks: readonly Task[], projectID: string, categoryID: string, serverID?: string): Task[] {
  const group = groupOf(tasks, projectID, categoryID, serverID)
  const positions = new Map(group.map((task, index) => [task.id, index]))
  return tasks.map((task) =>
    taskInScope(task, projectID, serverID) && task.categoryID === categoryID
      ? { ...task, position: positions.get(task.id) ?? task.position }
      : task,
  )
}

export function categoryPosition(board: Board, projectID: string, categoryID: string): number {
  return sortedCategories(categorySet(board, projectID)).findIndex((category) => category.id === categoryID)
}

export type CreateTaskInput = {
  title: string
  branch: string
  projectID: string
  projectRoot: string
  projectName: string
  serverID?: string
  categoryID: string
  baseBranch?: string
  worktreePath?: string
  directory?: string
  sessionID?: string
  notes?: string
  tagIDs?: string[]
  now?: number
  id?: string
}

export function createTask(board: Board, input: CreateTaskInput): Board {
  const branch = input.branch.trim()
  if (!branch) throw new Error("branch-required")
  const columns = sortedCategories(categorySet(board, input.projectID))
  const category = columns.find((item) => item.id === input.categoryID) ?? columns[0]
  if (!category) throw new Error("category-required")

  const now = input.now ?? Date.now()
  const position = groupOf(board.tasks, input.projectID, category.id, input.serverID).length
  const tagIDs = [...new Set(input.tagIDs ?? [])].filter((id) =>
    tagsOf(board, input.projectID).some((tag) => tag.id === id),
  )
  const task: Task = {
    id: input.id ?? newID("task"),
    title: input.title.trim() || branch,
    projectID: input.projectID,
    projectRoot: input.projectRoot,
    projectName: input.projectName,
    serverID: input.serverID,
    branch,
    baseBranch: input.baseBranch?.trim() || undefined,
    worktreePath: input.worktreePath,
    directory: input.directory,
    categoryID: category.id,
    position,
    tagIDs: tagIDs.length ? tagIDs : undefined,
    sessionID: input.sessionID,
    notes: input.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    archived: false,
  }

  return { ...board, tasks: [...board.tasks, task] }
}

/**
 * A per-project board must use the project id OpenCode currently routes to that folder.
 * Duplicate project records can otherwise hide every card while leaving columns and tags visible.
 */
export function adoptProject(board: Board, projectID: string, projectRoot: string): Board {
  if (!projectID || !projectRoot) return board
  let changed = false
  const tasks = board.tasks.map((task) => {
    if (task.projectID === projectID && task.projectRoot === projectRoot) return task
    changed = true
    return { ...task, projectID, projectRoot }
  })
  return changed ? { ...board, tasks } : board
}

export type UpdateTaskPatch = {
  title?: string
  notes?: string
  categoryID?: string
  tagIDs?: string[]
}

export function updateTask(board: Board, taskID: string, patch: UpdateTaskPatch, now = Date.now()): Board {
  const task = board.tasks.find((item) => item.id === taskID)
  if (!task) return board

  const moved =
    patch.categoryID && patch.categoryID !== task.categoryID
      ? moveTask(board, taskID, patch.categoryID, Number.MAX_SAFE_INTEGER, now)
      : board

  const tagIDs =
    patch.tagIDs === undefined
      ? undefined
      : [...new Set(patch.tagIDs)].filter((id) => tagsOf(moved, task.projectID).some((tag) => tag.id === id))

  return {
    ...moved,
    tasks: moved.tasks.map((item) =>
      item.id === taskID
        ? {
            ...item,
            title: patch.title?.trim() || item.title,
            notes: patch.notes?.trim() || undefined,
            tagIDs: patch.tagIDs === undefined ? item.tagIDs : tagIDs?.length ? tagIDs : undefined,
            updatedAt: now,
          }
        : item,
    ),
  }
}

/** Records the server that owns a legacy task without touching its session or position. */
export function claimTask(board: Board, taskID: string, serverID: string, now = Date.now()): Board {
  return {
    ...board,
    tasks: board.tasks.map((task) =>
      task.id === taskID && !task.serverID ? { ...task, serverID, updatedAt: now } : task,
    ),
  }
}

/** Binds a task to a session, claiming a legacy task for the current server. */
export function bindSession(
  board: Board,
  taskID: string,
  sessionID: string | undefined,
  now = Date.now(),
  serverID?: string,
): Board {
  return {
    ...board,
    tasks: board.tasks.map((task) =>
      task.id === taskID
        ? { ...task, sessionID, serverID: task.serverID ?? serverID, updatedAt: now }
        : task,
    ),
  }
}

export function moveTask(
  board: Board,
  taskID: string,
  categoryID: string,
  index: number,
  now = Date.now(),
): Board {
  const task = board.tasks.find((item) => item.id === taskID)
  if (!task || !sortedCategories(categorySet(board, task.projectID)).some((category) => category.id === categoryID)) {
    return board
  }

  const source = groupOf(board.tasks, task.projectID, task.categoryID, task.serverID).filter((item) => item.id !== taskID)
  const target = categoryID === task.categoryID
    ? source
    : groupOf(board.tasks, task.projectID, categoryID, task.serverID).filter((item) => item.id !== taskID)

  const insertAt = Math.max(0, Math.min(index, target.length))
  target.splice(insertAt, 0, { ...task, categoryID, updatedAt: now })

  const positions = new Map<string, number>()
  source.forEach((item, position) => positions.set(item.id, position))
  target.forEach((item, position) => positions.set(item.id, position))

  return {
    ...board,
    tasks: board.tasks.map((item) => {
      if (!taskInScope(item, task.projectID, task.serverID)) return item
      if (item.categoryID !== task.categoryID && item.categoryID !== categoryID) return item
      const position = positions.get(item.id)
      if (position === undefined) return item
      if (item.id === taskID) return { ...item, categoryID, position, updatedAt: now }
      return { ...item, position }
    }),
  }
}

export function moveTaskBy(board: Board, taskID: string, delta: number, now = Date.now()): Board {
  const task = board.tasks.find((item) => item.id === taskID)
  if (!task) return board
  const group = groupOf(board.tasks, task.projectID, task.categoryID, task.serverID)
  const current = group.findIndex((item) => item.id === taskID)
  if (current < 0) return board
  const next = Math.max(0, Math.min(group.length - 1, current + delta))
  if (next === current) return board
  return moveTask(board, taskID, task.categoryID, next, now)
}

export function moveTaskToCategory(board: Board, taskID: string, delta: number, now = Date.now()): Board {
  const task = board.tasks.find((item) => item.id === taskID)
  if (!task) return board
  const categories = sortedCategories(categorySet(board, task.projectID))
  const current = categories.findIndex((category) => category.id === task.categoryID)
  if (current < 0) return board
  const next = Math.max(0, Math.min(categories.length - 1, current + delta))
  if (next === current) return board
  const target = categories[next]!
  return moveTask(board, taskID, target.id, Number.MAX_SAFE_INTEGER, now)
}

export function archiveTask(board: Board, taskID: string, now = Date.now()): Board {
  return {
    ...board,
    tasks: board.tasks.map((task) =>
      task.id === taskID ? { ...task, archived: true, archivedAt: now, updatedAt: now } : task,
    ),
  }
}

export function restoreTask(board: Board, taskID: string, now = Date.now()): Board {
  return {
    ...board,
    tasks: board.tasks.map((task) =>
      task.id === taskID ? { ...task, archived: false, archivedAt: undefined, updatedAt: now } : task,
    ),
  }
}

export function deleteTask(board: Board, taskID: string): Board {
  const task = board.tasks.find((item) => item.id === taskID)
  if (!task) return board
  const tasks = board.tasks.filter((item) => item.id !== taskID)
  return {
    ...board,
    tasks: renumberGroup(tasks, task.projectID, task.categoryID, task.serverID),
  }
}

/** Re-inserts a task snapshot after a delete, clamped to the current column and tag set. */
export function restoreDeletedTask(board: Board, task: Task): Board {
  if (board.tasks.some((item) => item.id === task.id)) return board
  const projectCategories = sortedCategories(categorySet(board, task.projectID))
  const category = projectCategories.find((item) => item.id === task.categoryID) ?? projectCategories[0]
  if (!category) return board

  const projectTags = tagsOf(board, task.projectID)
  const tagIDs = (task.tagIDs ?? []).filter((id) => projectTags.some((tag) => tag.id === id))
  const restored: Task = {
    ...task,
    categoryID: category.id,
    tagIDs: tagIDs.length ? tagIDs : undefined,
  }

  const group = groupOf(board.tasks, task.projectID, category.id, task.serverID)
  const index = Math.max(0, Math.min(task.position, group.length))
  group.splice(index, 0, restored)
  const positions = new Map(group.map((item, position) => [item.id, position]))

  return {
    ...board,
    tasks: [
      ...board.tasks.map((item) => {
        if (!taskInScope(item, task.projectID, task.serverID) || item.categoryID !== category.id) return item
        const position = positions.get(item.id)
        return position === undefined ? item : { ...item, position }
      }),
      restored,
    ],
  }
}

export function addTag(board: Board, projectID: string, name: string, color?: string): Board {
  const current = tagsOf(board, projectID)
  const tag: Tag = {
    id: newID("tag"),
    name: name.trim() || "Tag",
    color: safeColor(color, COLORS[current.length % COLORS.length]!),
  }
  return writeTags(board, projectID, [...current, tag])
}

export function updateTag(
  board: Board,
  projectID: string,
  tagID: string,
  patch: { name?: string; color?: string },
): Board {
  const current = tagsOf(board, projectID)
  if (!current.some((tag) => tag.id === tagID)) return board
  return writeTags(
    board,
    projectID,
    current.map((tag) =>
      tag.id === tagID
        ? {
            ...tag,
            name: patch.name?.trim() || tag.name,
            color: patch.color ? safeColor(patch.color, tag.color) : tag.color,
          }
        : tag,
    ),
  )
}

/** Deletes a project's tag and removes it from that project's tasks only. */
export function deleteTag(board: Board, projectID: string, tagID: string): Board {
  const current = tagsOf(board, projectID)
  if (!current.some((tag) => tag.id === tagID)) return board
  return {
    ...writeTags(
      board,
      projectID,
      current.filter((tag) => tag.id !== tagID),
    ),
    tasks: board.tasks.map((task) => {
      if (task.projectID !== projectID || !task.tagIDs?.includes(tagID)) return task
      const tagIDs = task.tagIDs.filter((id) => id !== tagID)
      return { ...task, tagIDs: tagIDs.length ? tagIDs : undefined }
    }),
  }
}

export function taskTags(board: Board, task: Task): Tag[] {
  const ids = new Set(task.tagIDs ?? [])
  return tagsOf(board, task.projectID).filter((tag) => ids.has(tag.id))
}

export function addCategory(board: Board, projectID: string, name: string, color?: string): Board {
  const current = sortedCategories(categorySet(board, projectID))
  const category: Category = {
    id: newID("category"),
    name: name.trim() || "Column",
    color: safeColor(color, COLORS[current.length % COLORS.length]!),
    position: current.length,
  }
  return writeCategories(board, projectID, [...current, category])
}

export function updateCategory(
  board: Board,
  projectID: string,
  categoryID: string,
  patch: { name?: string; color?: string },
): Board {
  const current = sortedCategories(categorySet(board, projectID))
  if (!current.some((category) => category.id === categoryID)) return board
  return writeCategories(
    board,
    projectID,
    current.map((category) =>
      category.id === categoryID
        ? {
            ...category,
            name: patch.name?.trim() || category.name,
            color: patch.color ? safeColor(patch.color, category.color) : category.color,
          }
        : category,
    ),
  )
}

export function moveCategory(board: Board, projectID: string, categoryID: string, delta: number): Board {
  const categories = sortedCategories(categorySet(board, projectID))
  const current = categories.findIndex((category) => category.id === categoryID)
  if (current < 0) return board
  const next = Math.max(0, Math.min(categories.length - 1, current + delta))
  if (next === current) return board
  const [moved] = categories.splice(current, 1)
  if (!moved) return board
  categories.splice(next, 0, moved)
  return writeCategories(board, projectID, categories)
}

/** Deletes a project's column and re-homes its tasks. The last column cannot be deleted. */
export function deleteCategory(board: Board, projectID: string, categoryID: string): Board {
  const current = sortedCategories(categorySet(board, projectID))
  if (!current.some((category) => category.id === categoryID)) return board
  if (current.length <= 1) return board
  const remaining = current.filter((category) => category.id !== categoryID)
  const fallback = remaining[0]
  if (!fallback) return board

  const mapped = board.tasks.map((task) =>
    task.projectID === projectID && task.categoryID === categoryID
      ? { ...task, categoryID: fallback.id }
      : task,
  )
  const tasks = renumberGroup(mapped, projectID, fallback.id)

  return {
    ...writeCategories(board, projectID, remaining),
    tasks,
  }
}

function normalizeCategoryList(input: unknown): Category[] {
  const rawList = Array.isArray(input) ? input : []
  const categories: Category[] = []
  const seen = new Set<string>()
  for (const raw of rawList) {
    if (!raw || typeof raw.id !== "string" || !raw.id || seen.has(raw.id)) continue
    seen.add(raw.id)
    categories.push({
      id: raw.id,
      name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Column",
      color: safeColor(raw.color, COLORS[categories.length % COLORS.length]!),
      position: typeof raw.position === "number" && Number.isFinite(raw.position) ? raw.position : categories.length,
    })
  }
  return renumberCategories(categories)
}

function normalizeTagList(input: unknown): Tag[] {
  const rawList = Array.isArray(input) ? input : []
  const tags: Tag[] = []
  const seen = new Set<string>()
  for (const raw of rawList) {
    if (!raw || typeof raw.id !== "string" || !raw.id || seen.has(raw.id)) continue
    seen.add(raw.id)
    tags.push({
      id: raw.id,
      name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Tag",
      color: safeColor(raw.color, COLORS[tags.length % COLORS.length]!),
    })
  }
  return tags
}

/** A stable board key for equality checks; object key order does not matter. */
export function boardKey(board: Board): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical)
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.keys(value as Record<string, unknown>)
          .sort()
          .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
      )
    }
    return value
  }
  return JSON.stringify(canonical(board))
}

export function sameBoard(a: Board, b: Board): boolean {
  return boardKey(a) === boardKey(b)
}

/** Repairs stored data after a schema change or hand-edited storage. */
export function normalizeBoard(input: Partial<Board> | undefined): Board {
  const categories = normalizeCategoryList(input?.categories)
  if (categories.length === 0) categories.push(...defaultBoard().categories)
  const orderedCategories = renumberCategories(categories)

  const rawByProject = isRecord(input?.categoriesByProject) ? input!.categoriesByProject : {}
  const byProject: Record<string, Category[]> = {}
  for (const [projectID, rawList] of Object.entries(rawByProject)) {
    if (!projectID) continue
    const list = normalizeCategoryList(rawList)
    if (list.length > 0) byProject[projectID] = list
  }

  const tags = normalizeTagList(input?.tags)
  const rawTagsByProject = isRecord(input?.tagsByProject) ? input!.tagsByProject : {}
  const tagsByProject: Record<string, Tag[]> = {}
  for (const [projectID, rawList] of Object.entries(rawTagsByProject)) {
    if (!projectID) continue
    tagsByProject[projectID] = normalizeTagList(rawList)
  }

  const tasksInput = Array.isArray(input?.tasks) ? input!.tasks : []
  if (tags.length > 0) {
    for (const raw of tasksInput) {
      if (!raw || typeof raw.id !== "string" || typeof raw.projectID !== "string" || !raw.projectID) continue
      if (Object.prototype.hasOwnProperty.call(tagsByProject, raw.projectID)) continue
      tagsByProject[raw.projectID] = tags.map((tag) => ({ ...tag }))
    }
  }

  const tasks: Task[] = []
  const seenTasks = new Set<string>()
  for (const raw of tasksInput) {
    if (!raw || typeof raw.id !== "string" || !raw.id || seenTasks.has(raw.id)) continue
    if (typeof raw.branch !== "string" || typeof raw.projectID !== "string") continue
    seenTasks.add(raw.id)
    const projectCategories = byProject[raw.projectID] ?? orderedCategories
    const latest = new Map(projectCategories.map((category) => [category.id, category.position]))
    const fallback = projectCategories[0]!.id
    const categoryID = typeof raw.categoryID === "string" && latest.has(raw.categoryID) ? raw.categoryID : fallback
    const createdAt = typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now()
    const rawTagIDs: string[] = Array.isArray(raw.tagIDs)
      ? (raw.tagIDs as unknown[]).filter((id): id is string => typeof id === "string")
      : []
    const projectTags = tagsByProject[raw.projectID] ?? tags
    const tagIDs = [...new Set<string>(rawTagIDs)].filter((id: string) =>
      projectTags.some((tag) => tag.id === id),
    )
    tasks.push({
      id: raw.id,
      title: typeof raw.title === "string" && raw.title.trim() ? raw.title : raw.branch,
      projectID: raw.projectID,
      projectRoot: typeof raw.projectRoot === "string" ? raw.projectRoot : "",
      projectName: typeof raw.projectName === "string" && raw.projectName ? raw.projectName : raw.projectID,
      serverID: typeof raw.serverID === "string" && raw.serverID ? raw.serverID : undefined,
      branch: raw.branch,
      baseBranch: typeof raw.baseBranch === "string" ? raw.baseBranch : undefined,
      worktreePath: typeof raw.worktreePath === "string" ? raw.worktreePath : undefined,
      directory: typeof raw.directory === "string" && raw.directory ? raw.directory : undefined,
      categoryID,
      position: typeof raw.position === "number" && Number.isFinite(raw.position) ? raw.position : 0,
      tagIDs: tagIDs.length ? tagIDs : undefined,
      sessionID: typeof raw.sessionID === "string" ? raw.sessionID : undefined,
      notes: typeof raw.notes === "string" ? raw.notes : undefined,
      createdAt,
      updatedAt: typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt) ? raw.updatedAt : createdAt,
      archived: raw.archived === true,
      archivedAt: typeof raw.archivedAt === "number" ? raw.archivedAt : undefined,
    })
  }

  let renumbered = tasks
  for (const projectID of new Set(tasks.map((task) => task.projectID))) {
    for (const category of byProject[projectID] ?? orderedCategories) {
      renumbered = renumberGroup(renumbered, projectID, category.id)
    }
  }

  return {
    version: BOARD_VERSION,
    tags,
    ...(Object.keys(tagsByProject).length > 0 ? { tagsByProject } : {}),
    categories: orderedCategories,
    ...(Object.keys(byProject).length > 0 ? { categoriesByProject: byProject } : {}),
    tasks: renumbered,
  }
}

export function categories(board: Board, projectID?: string): Category[] {
  return sortedCategories(categorySet(board, projectID))
}

export function tasksFor(
  board: Board,
  projectID: string,
  categoryID: string,
  archived = false,
  serverID?: string,
): Task[] {
  return groupOf(board.tasks, projectID, categoryID, serverID).filter((task) => task.archived === archived)
}

export function archivedTasks(board: Board, projectID: string, serverID?: string): Task[] {
  return board.tasks
    .filter((task) => taskInScope(task, projectID, serverID) && task.archived)
    .sort((a, b) => (b.archivedAt ?? b.updatedAt) - (a.archivedAt ?? a.updatedAt))
}

/** Keeps a task's current session binding when the imported file omits one. */
export function mergeSessionBindings(imported: Board, current: Board): Board {
  const byID = new Map(current.tasks.map((task) => [task.id, task]))
  return {
    ...imported,
    tasks: imported.tasks.map((task) => ({
      ...task,
      sessionID: task.sessionID ?? byID.get(task.id)?.sessionID,
    })),
  }
}

export function projectTaskCounts(
  board: Board,
  projectID: string,
  serverID?: string,
): { total: number; archived: number } {
  const tasks = board.tasks.filter((task) => taskInScope(task, projectID, serverID))
  return { total: tasks.filter((task) => !task.archived).length, archived: tasks.filter((task) => task.archived).length }
}

export function categoryAt(board: Board, projectID: string, index: number): Category | undefined {
  return sortedCategories(categorySet(board, projectID))[index]
}

export function categoryOf(board: Board, task: Task): Category | undefined {
  return categorySet(board, task.projectID).find((category) => category.id === task.categoryID)
}

export function categoryIndex(board: Board, projectID: string, categoryID: string): number {
  return categoryPosition(board, projectID, categoryID)
}

export function hasBranch(
  board: Board,
  projectID: string,
  branch: string,
  exceptTaskID?: string,
  serverID?: string,
): boolean {
  return board.tasks.some(
    (task) =>
      taskInScope(task, projectID, serverID) &&
      task.branch === branch &&
      task.id !== exceptTaskID,
  )
}

export function taskByID(board: Board, taskID: string): Task | undefined {
  return board.tasks.find((task) => task.id === taskID)
}
