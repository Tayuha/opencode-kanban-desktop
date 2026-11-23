import type { MountedSession, SessionRef, SetupContext } from "@opencode/plugin/gui"
import type { definition } from "./definition.ts"
import type { BranchList } from "./data/actions.ts"
import type { LiveBoard, LiveTarget } from "./data/live.ts"
import type { OpenMode, ProjectRow, Task, VcsSummary } from "./model/types.ts"
import type { Board, Prefs } from "./model/types.ts"

export type Ctx = SetupContext<typeof definition>

export type BoardStore = {
  get(): Board
  set(next: Board): void
}

export type PrefsStore = {
  get(): Prefs
  set(next: Prefs): void
}

export type CreateTaskArgs = {
  projectID: string
  projectRoot: string
  projectName: string
  title: string
  branch: string
  baseBranch?: string
  directory?: string
  categoryID: string
  notes?: string
  tagIDs?: string[]
  makeWorktree: boolean
  openOnCreate: boolean
  autoPrompt: boolean
  prompt: string
}

export type KanbanServices = {
  live: LiveBoard
  /** Shared selection so palette commands act on the task the user last picked. */
  selectedTaskID(): string | undefined
  selectTask(taskID: string | undefined): void
  searchPulse(): number
  requestSearch(): void
  openPanel(session: SessionRef): void
  openFullBoard(session: MountedSession): void
  openTaskDialog(session: MountedSession, projectID: string, task?: Task, initialCategoryID?: string): void
  openColumnsDialog(projectID: string, projectName?: string, projectRoot?: string): void
  openTagsDialog(projectID: string, projectName?: string, projectRoot?: string): void
  projects(session: MountedSession): ProjectRow[]
  projectFor(session: MountedSession): ProjectRow | undefined
  /** One project's board, keyed by its canonical folder. */
  boardFor(root: string | undefined, projectID?: string): Board
  /** Writes one project's board and schedules its own auto-export. */
  saveBoard(root: string | undefined, next: Board, projectID?: string): void
  target(session: MountedSession, projectID: string): LiveTarget
  createTask(session: MountedSession, input: CreateTaskArgs): Promise<Task>
  openTask(session: MountedSession, task: Task, mode?: OpenMode): Promise<void>
  /** Picks an open session in the task's project and binds the task to it. */
  linkTaskSession(session: MountedSession, task: Task): Promise<void>
  /** Binds the task to the routed session directly. */
  linkTaskToCurrent(session: MountedSession, task: Task): Promise<void>
  /** Removes an explicit session link. */
  unlinkTaskSession(task: Task): void
  startAgent(session: MountedSession, task: Task, prompt?: string): Promise<void>
  deleteTask(session: MountedSession, task: Task, removeWorktree: boolean): Promise<void>
  archiveTask(task: Task): void
  restoreTask(task: Task): void
  updateTask(
    task: Task,
    patch: { title?: string; notes?: string; categoryID?: string; tagIDs?: string[] },
  ): void
  moveTask(task: Task, direction: "left" | "right" | "up" | "down"): void
  refresh(session: MountedSession, projectID: string): Promise<void>
  /** Replaces the board with `<project>/kanban-board.json` through the server RPC. */
  reloadBoard(session: MountedSession, projectID: string): Promise<void>
  /** Writes the current board to `<project>/kanban-board.json`, keeping the previous file as .bak. */
  exportBoard(session: MountedSession, projectID: string): Promise<void>
  /** Chooses the folder that holds this project's kanban-board.json. */
  chooseBoardFolder(session: MountedSession, projectID: string): Promise<void>
  branches(session: MountedSession, root: string): Promise<BranchList>
  vcs(session: MountedSession, task: Task): Promise<VcsSummary | undefined>
  reveal(path: string): Promise<void>
  copy(text: string): Promise<void>
}

export type SelectTask = (taskID: string | undefined) => void
