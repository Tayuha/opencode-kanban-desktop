/** Persisted task board types and the live shapes derived from OpenCode sessions. */

export type Category = {
  id: string
  name: string
  color: string
  position: number
}

export type Tag = {
  id: string
  name: string
  color: string
}

export type Task = {
  id: string
  title: string
  projectID: string
  projectRoot: string
  projectName: string
  /** The OpenCode server that owns this task; absent on legacy boards. */
  serverID?: string
  branch: string
  baseBranch?: string
  worktreePath?: string
  /** An existing folder chosen for the task; never removed by the plugin. */
  directory?: string
  categoryID: string
  position: number
  tagIDs?: readonly string[]
  sessionID?: string
  notes?: string
  createdAt: number
  updatedAt: number
  archived: boolean
  archivedAt?: number
}

export type Board = {
  version: number
  /** The shared tag list, used as the seed for projects without their own set. */
  tags?: readonly Tag[]
  /** Independent tag sets keyed by project id; an empty array means no tags. */
  tagsByProject?: Readonly<Record<string, readonly Tag[]>>
  /** The default columns, used by projects without their own set. */
  categories: readonly Category[]
  /** Independent column sets keyed by project id; absent projects use `categories`. */
  categoriesByProject?: Readonly<Record<string, readonly Category[]>>
  tasks: readonly Task[]
}

/** Every project folder owns one board, keyed by its canonical project root. */
export type BoardMap = Readonly<Record<string, Board>>

export type BoardView = "board" | "detail" | "archive" | "help"
export type Alignment = "fit" | "scroll"
export type Density = "comfortable" | "compact"
export type OpenMode = "reuse" | "new" | "ask"

export type Prefs = {
  view: BoardView
  alignment: Alignment
  columnWidth: number
  density?: Density
  pollMs: number
  autoExport?: boolean
  autoReload?: boolean
  notify: boolean
  pill: boolean
  openMode?: OpenMode
  defaultCategoryID?: string
  openOnCreate: boolean
  autoPrompt: boolean
  initialPrompt: string
  lastProjectID?: string
  /** The board key last shown in the panel, used by settings and palette commands. */
  lastBoardKey?: string
}

export type ProjectRow = {
  id: string
  name: string
  root: string
}

/** A session reduced to the fields a board reads, so the model stays free of SDK types. */
export type SessionRow = {
  id: string
  parentID?: string
  projectID: string
  directory: string
  title?: string
  cost: number
  updated: number
  running: boolean
}

export type TaskStatus = "none" | "idle" | "running"

export type TodoItem = {
  content: string
  status: "pending" | "in_progress" | "completed"
  completed: boolean
}

export type TodoSummary = {
  items: TodoItem[]
  total: number
  done: number
}

export type SubagentLive = {
  id: string
  title: string
  status: TaskStatus
  cost: number
  updated: number
  todos?: TodoSummary
}

export type LiveTask = {
  taskID: string
  status: TaskStatus
  sessionID?: string
  sessionTitle?: string
  sessionUpdated?: number
  cost: number
  subagents: SubagentLive[]
  runningSubagents: number
  todos?: TodoSummary
  updatedAt: number
}

export type VcsFile = {
  file: string
  status: "added" | "deleted" | "modified"
  additions: number
  deletions: number
}

export type VcsSummary = {
  branch?: string
  base?: string
  files: VcsFile[]
  additions: number
  deletions: number
}

export function emptyTodo(): TodoSummary {
  return { items: [], total: 0, done: 0 }
}
