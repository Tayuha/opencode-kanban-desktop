import { describe, expect, it } from "vitest"
import {
  addCategory,
  addTag,
  archiveTask,
  archivedTasks,
  bindSession,
  claimTask,
  categories,
  createTask,
  defaultBoard,
  DEFAULT_PREFS,
  deleteCategory,
  deleteTag,
  deleteTask,
  generateBranch,
  hasBranch,
  hasManagedWorktree,
  isBoardLike,
  mergeSessionBindings,
  moveCategory,
  moveTask,
  taskTags,
  moveTaskBy,
  moveTaskToCategory,
  normalizeBoard,
  projectTaskCounts,
  restoreTask,
  restoreDeletedTask,
  safeColor,
  tagsOf,
  taskDirectory,
  tasksFor,
  updateCategory,
  updateTag,
  updateTask,
  validateBranch,
} from "./board.ts"
import type { CreateTaskInput } from "./board.ts"
import type { Board } from "./types.ts"

const PROJECT = "proj_a"
const ROOT = "/repo"

function input(overrides: Partial<CreateTaskInput> = {}): CreateTaskInput {
  return {
    title: "Ship the board",
    branch: "feature/ship",
    projectID: PROJECT,
    projectRoot: ROOT,
    projectName: "repo",
    categoryID: "todo",
    now: 1000,
    ...overrides,
  }
}

function boardWith(tasks: CreateTaskInput[]): Board {
  return tasks.reduce((board, item) => createTask(board, item), defaultBoard())
}

describe("defaultBoard", () => {
  it("seeds the three documented columns", () => {
    const board = defaultBoard()
    expect(categories(board).map((category) => category.name)).toEqual(["Todo", "In progress", "Done"])
    expect(board.tasks).toEqual([])
  })
})

describe("DEFAULT_PREFS", () => {
  it("starts with comfortable columns and a fixed scroll width", () => {
    expect(DEFAULT_PREFS.density).toBe("comfortable")
    expect(DEFAULT_PREFS.columnWidth).toBe(280)
    expect(DEFAULT_PREFS.alignment).toBe("fit")
    expect(DEFAULT_PREFS.autoExport).toBe(true)
    expect(DEFAULT_PREFS.autoReload).toBe(true)
  })
})

describe("task locations", () => {
  it("prefers an existing folder, then a worktree, then the project root", () => {
    const root = { projectRoot: "/repo" }
    expect(taskDirectory({ ...root, worktreePath: "/worktrees/a", directory: "/existing" })).toBe("/existing")
    expect(taskDirectory({ ...root, worktreePath: "/worktrees/a" })).toBe("/worktrees/a")
    expect(taskDirectory(root)).toBe("/repo")
    expect(hasManagedWorktree({ worktreePath: "/worktrees/a" })).toBe(true)
    expect(hasManagedWorktree({ worktreePath: "/worktrees/a", directory: "/existing" })).toBe(false)
    expect(hasManagedWorktree({})).toBe(false)
  })

  it("stores and normalizes an existing folder", () => {
    const board = createTask(defaultBoard(), input({ directory: "/existing/folder" }))
    expect(board.tasks[0]!.directory).toBe("/existing/folder")
    expect(board.tasks[0]!.worktreePath).toBeUndefined()
    expect(normalizeBoard(board)).toEqual(board)
  })
})

describe("createTask", () => {
  it("stores positions per project and column", () => {
    const board = boardWith([input(), input({ branch: "feature/two", categoryID: "todo" })])
    expect(tasksFor(board, PROJECT, "todo").map((task) => task.position)).toEqual([0, 1])
  })

  it("falls back to the branch when the title is blank", () => {
    const board = createTask(defaultBoard(), input({ title: "   " }))
    expect(board.tasks[0]!.title).toBe("feature/ship")
  })

  it("rejects a blank branch and an unknown category", () => {
    expect(() => createTask(defaultBoard(), input({ branch: "  " }))).toThrow("branch-required")
    const board = createTask(defaultBoard(), input({ categoryID: "missing" }))
    expect(board.tasks[0]!.categoryID).toBe("todo")
  })

  it("keeps two projects in separate position spaces", () => {
    const board = boardWith([
      input(),
      input({ projectID: "proj_b", projectRoot: "/other", projectName: "other", branch: "feature/b" }),
    ])
    expect(tasksFor(board, PROJECT, "todo")[0]!.position).toBe(0)
    expect(tasksFor(board, "proj_b", "todo")[0]!.position).toBe(0)
  })

  it("uses each project's own column set", () => {
    let board = addCategory(defaultBoard(), PROJECT, "Review")
    const review = categories(board, PROJECT).find((category) => category.name === "Review")!
    board = createTask(board, input({ categoryID: review.id }))
    expect(board.tasks[0]!.categoryID).toBe(review.id)

    board = createTask(
      board,
      input({
        projectID: "proj_b",
        projectRoot: "/other",
        projectName: "other",
        branch: "feature/b",
        categoryID: review.id,
      }),
    )
    expect(board.tasks.find((task) => task.projectID === "proj_b")!.categoryID).toBe("todo")
  })

  it("records the server id and scopes positions per server", () => {
    let board = createTask(defaultBoard(), input({ serverID: "s1" }))
    board = createTask(board, input({ branch: "feature/b", serverID: "s2" }))
    expect(board.tasks.map((task) => task.serverID)).toEqual(["s1", "s2"])
    expect(tasksFor(board, PROJECT, "todo", false, "s1").map((task) => task.position)).toEqual([0])
    expect(tasksFor(board, PROJECT, "todo", false, "s2").map((task) => task.position)).toEqual([0])
  })
})

describe("moveTask", () => {
  it("moves between columns at an index and renumbers both", () => {
    let board = boardWith([
      input({ branch: "a", title: "A" }),
      input({ branch: "b", title: "B" }),
      input({ branch: "c", title: "C", categoryID: "in-progress" }),
    ])
    const moving = board.tasks.find((task) => task.branch === "b")!
    board = moveTask(board, moving.id, "in-progress", 0, 2000)
    expect(tasksFor(board, PROJECT, "todo").map((task) => task.branch)).toEqual(["a"])
    expect(tasksFor(board, PROJECT, "in-progress").map((task) => task.branch)).toEqual(["b", "c"])
    expect(tasksFor(board, PROJECT, "in-progress").map((task) => task.position)).toEqual([0, 1])
    expect(board.tasks.find((task) => task.id === moving.id)!.updatedAt).toBe(2000)
  })

  it("reorders inside one column", () => {
    let board = boardWith([
      input({ branch: "a" }),
      input({ branch: "b" }),
      input({ branch: "c" }),
    ])
    const c = board.tasks.find((task) => task.branch === "c")!
    board = moveTask(board, c.id, "todo", 0)
    expect(tasksFor(board, PROJECT, "todo").map((task) => task.branch)).toEqual(["c", "a", "b"])
  })

  it("ignores unknown tasks and columns", () => {
    const board = defaultBoard()
    expect(moveTask(board, "nope", "done", 0)).toBe(board)
    expect(moveTask(board, "nope", "missing", 0)).toBe(board)
  })

  it("moves across only the task project's columns", () => {
    let board = addCategory(defaultBoard(), PROJECT, "Review")
    board = createTask(board, input({ categoryID: "done" }))
    const task = board.tasks[0]!
    const review = categories(board, PROJECT).find((category) => category.name === "Review")!
    board = moveTaskToCategory(board, task.id, 1)
    expect(board.tasks[0]!.categoryID).toBe(review.id)
  })

  it("rejects a column owned by another project", () => {
    let board = addCategory(defaultBoard(), "proj_b", "Backlog")
    const backlog = categories(board, "proj_b").find((category) => category.name === "Backlog")!
    board = createTask(board, input())
    const task = board.tasks[0]!
    expect(moveTask(board, task.id, backlog.id, 0)).toBe(board)
  })

  it("moves by a delta and clamps at the ends", () => {
    let board = boardWith([input({ branch: "a" }), input({ branch: "b" })])
    const a = board.tasks.find((task) => task.branch === "a")!
    board = moveTaskBy(board, a.id, 1)
    expect(tasksFor(board, PROJECT, "todo").map((task) => task.branch)).toEqual(["b", "a"])
    board = moveTaskBy(board, a.id, 1)
    expect(tasksFor(board, PROJECT, "todo").map((task) => task.branch)).toEqual(["b", "a"])
    board = moveTaskBy(board, a.id, -5)
    expect(tasksFor(board, PROJECT, "todo").map((task) => task.branch)).toEqual(["a", "b"])
  })

  it("moves to the next and previous columns", () => {
    let board = boardWith([input({ branch: "a" })])
    const task = board.tasks[0]!
    board = moveTaskToCategory(board, task.id, 1)
    expect(board.tasks[0]!.categoryID).toBe("in-progress")
    board = moveTaskToCategory(board, task.id, 1)
    expect(board.tasks[0]!.categoryID).toBe("done")
    board = moveTaskToCategory(board, task.id, 1)
    expect(board.tasks[0]!.categoryID).toBe("done")
    board = moveTaskToCategory(board, task.id, -2)
    expect(board.tasks[0]!.categoryID).toBe("todo")
  })
})

describe("task updates", () => {
  it("updates title and notes and ignores a blank title", () => {
    const board = createTask(defaultBoard(), input())
    const id = board.tasks[0]!.id
    const updated = updateTask(board, id, { title: "  Better  ", notes: " why " }, 1234)
    expect(updated.tasks[0]!.title).toBe("Better")
    expect(updated.tasks[0]!.notes).toBe("why")
    expect(updated.tasks[0]!.updatedAt).toBe(1234)
    const blank = updateTask(updated, id, { title: " " })
    expect(blank.tasks[0]!.title).toBe("Better")
  })

  it("moves a task when the category changes", () => {
    const board = createTask(defaultBoard(), input())
    const updated = updateTask(board, board.tasks[0]!.id, { categoryID: "done" })
    expect(updated.tasks[0]!.categoryID).toBe("done")
  })

  it("applies tags and a category move together", () => {
    const tagged = addTag(defaultBoard(), PROJECT, "Docs")
    const tag = tagsOf(tagged, PROJECT)[0]!
    const board = createTask(tagged, input())
    const updated = updateTask(board, board.tasks[0]!.id, {
      categoryID: "done",
      tagIDs: [tag.id, "missing"],
    })
    expect(updated.tasks[0]!.categoryID).toBe("done")
    expect(updated.tasks[0]!.tagIDs).toEqual([tag.id])
  })

  it("binds a session", () => {
    const board = createTask(defaultBoard(), input())
    const updated = bindSession(board, board.tasks[0]!.id, "ses_1")
    expect(updated.tasks[0]!.sessionID).toBe("ses_1")
    const cleared = bindSession(updated, updated.tasks[0]!.id, undefined)
    expect(cleared.tasks[0]!.sessionID).toBeUndefined()
  })

  it("claims a legacy task's server when binding a session", () => {
    const board = createTask(defaultBoard(), input())
    const updated = bindSession(board, board.tasks[0]!.id, "ses_1", 5, "s1")
    expect(updated.tasks[0]!.serverID).toBe("s1")
  })

  it("claims a legacy task for a server", () => {
    const board = createTask(defaultBoard(), input())
    const claimed = claimTask(board, board.tasks[0]!.id, "s1")
    expect(claimed.tasks[0]!.serverID).toBe("s1")
  })
})

describe("archive and delete", () => {
  it("archives, lists, and restores", () => {
    let board = createTask(defaultBoard(), input())
    const id = board.tasks[0]!.id
    board = archiveTask(board, id, 5000)
    expect(board.tasks[0]!.archived).toBe(true)
    expect(board.tasks[0]!.archivedAt).toBe(5000)
    expect(archivedTasks(board, PROJECT)).toHaveLength(1)
    expect(tasksFor(board, PROJECT, "todo")).toHaveLength(0)
    board = restoreTask(board, id, 6000)
    expect(board.tasks[0]!.archived).toBe(false)
    expect(tasksFor(board, PROJECT, "todo")).toHaveLength(1)
  })

  it("deletes and renumbers the column", () => {
    let board = boardWith([input({ branch: "a" }), input({ branch: "b" }), input({ branch: "c" })])
    const b = board.tasks.find((task) => task.branch === "b")!
    board = deleteTask(board, b.id)
    expect(tasksFor(board, PROJECT, "todo").map((task) => task.branch)).toEqual(["a", "c"])
    expect(tasksFor(board, PROJECT, "todo").map((task) => task.position)).toEqual([0, 1])
  })
})

describe("restoreDeletedTask", () => {
  it("restores a task at its old position", () => {
    let board = boardWith([input({ branch: "a" }), input({ branch: "b" }), input({ branch: "c" })])
    const snapshot = board.tasks.find((task) => task.branch === "b")!
    board = deleteTask(board, snapshot.id)
    board = restoreDeletedTask(board, snapshot)
    expect(tasksFor(board, PROJECT, "todo").map((task) => task.branch)).toEqual(["a", "b", "c"])
    expect(tasksFor(board, PROJECT, "todo").map((task) => task.position)).toEqual([0, 1, 2])
  })

  it("restores an archived task into the archive", () => {
    let board = boardWith([input()])
    const id = board.tasks[0]!.id
    board = archiveTask(board, id, 5)
    const snapshot = board.tasks.find((task) => task.id === id)!
    board = deleteTask(board, id)
    board = restoreDeletedTask(board, snapshot)
    expect(archivedTasks(board, PROJECT).map((task) => task.id)).toEqual([id])
  })

  it("clamps a deleted column and drops missing tags", () => {
    let board = addCategory(defaultBoard(), PROJECT, "Review")
    board = addTag(board, PROJECT, "Docs")
    const review = categories(board, PROJECT).find((category) => category.name === "Review")!
    const tag = tagsOf(board, PROJECT)[0]!
    board = createTask(board, input({ categoryID: review.id, tagIDs: [tag.id] }))
    const snapshot = board.tasks[0]!
    board = deleteTask(board, snapshot.id)
    board = deleteCategory(board, PROJECT, review.id)
    board = deleteTag(board, PROJECT, tag.id)
    const restored = restoreDeletedTask(board, snapshot).tasks.find((task) => task.id === snapshot.id)!
    expect(restored.categoryID).toBe("todo")
    expect(restored.tagIDs).toBeUndefined()
  })

  it("ignores a task that already exists", () => {
    const board = boardWith([input()])
    expect(restoreDeletedTask(board, board.tasks[0]!)).toBe(board)
  })
})

describe("categories", () => {
  it("adds, renames, recolors, and reorders a project's columns", () => {
    let board = addCategory(defaultBoard(), PROJECT, "Review", "#123456")
    const review = categories(board, PROJECT).find((category) => category.name === "Review")!
    expect(review.color).toBe("#123456")
    board = updateCategory(board, PROJECT, review.id, { name: "QA", color: "#654321" })
    expect(categories(board, PROJECT).find((category) => category.id === review.id)!.name).toBe("QA")
    expect(categories(board, PROJECT).find((category) => category.id === review.id)!.color).toBe("#654321")
    board = moveCategory(board, PROJECT, review.id, -1)
    expect(categories(board, PROJECT).map((category) => category.name)).toEqual([
      "Todo",
      "In progress",
      "QA",
      "Done",
    ])
    board = moveCategory(board, PROJECT, review.id, -5)
    expect(categories(board, PROJECT)[0]!.id).toBe(review.id)
  })

  it("seeds a project's set from the shared defaults on first edit", () => {
    const board = addCategory(defaultBoard(), PROJECT, "Review")
    expect(categories(board)).toEqual(defaultBoard().categories)
    expect(categories(board, PROJECT).slice(0, 3).map((category) => category.id)).toEqual([
      "todo",
      "in-progress",
      "done",
    ])
  })

  it("keeps each project's column set independent", () => {
    let board = addCategory(defaultBoard(), PROJECT, "Review")
    const review = categories(board, PROJECT).find((category) => category.name === "Review")!
    board = addCategory(board, "proj_b", "Backlog")

    expect(categories(board, PROJECT).map((category) => category.name)).toEqual([
      "Todo",
      "In progress",
      "Done",
      "Review",
    ])
    expect(categories(board, "proj_b").map((category) => category.name)).toEqual([
      "Todo",
      "In progress",
      "Done",
      "Backlog",
    ])
    expect(categories(board).map((category) => category.name)).toEqual(["Todo", "In progress", "Done"])

    board = updateCategory(board, PROJECT, review.id, { name: "QA" })
    expect(categories(board, "proj_b").some((category) => category.name === "QA")).toBe(false)
  })

  it("re-homes tasks when a project's column is deleted", () => {
    let board = boardWith([input({ categoryID: "in-progress" })])
    board = createTask(
      board,
      input({ projectID: "proj_b", projectRoot: "/other", projectName: "other", branch: "feature/b", categoryID: "in-progress" }),
    )
    board = deleteCategory(board, PROJECT, "in-progress")
    expect(categories(board, PROJECT).some((category) => category.id === "in-progress")).toBe(false)
    expect(board.tasks.find((task) => task.projectID === PROJECT)!.categoryID).toBe("todo")
    expect(board.tasks.find((task) => task.projectID === "proj_b")!.categoryID).toBe("in-progress")
    expect(tasksFor(board, PROJECT, "todo")).toHaveLength(1)
  })

  it("refuses to delete a project's last column", () => {
    const board: Board = { ...defaultBoard(), categories: [defaultBoard().categories[0]!] }
    expect(deleteCategory(board, PROJECT, "todo")).toBe(board)
  })
})

describe("normalizeBoard", () => {
  it("normalizes per-project sets and falls back missing task columns", () => {
    const board = normalizeBoard({
      categories: [{ id: "todo", name: "Todo", color: "#111111", position: 0 }],
      categoriesByProject: {
        p: [
          { id: "review", name: "Review", color: "#222222", position: 0 },
          { id: "qa", name: "QA", color: "#333333", position: 1 },
        ],
        empty: [],
      },
      tasks: [
        {
          id: "t1",
          title: "P",
          projectID: "p",
          projectRoot: "/",
          projectName: "p",
          branch: "p",
          categoryID: "todo",
          position: 0,
          createdAt: 1,
          updatedAt: 1,
          archived: false,
        },
        {
          id: "t2",
          title: "Q",
          projectID: "q",
          projectRoot: "/",
          projectName: "q",
          branch: "q",
          categoryID: "review",
          position: 0,
          createdAt: 1,
          updatedAt: 1,
          archived: false,
        },
      ],
    })
    expect(categories(board, "p").map((category) => category.id)).toEqual(["review", "qa"])
    expect(board.tasks.find((task) => task.projectID === "p")!.categoryID).toBe("review")
    expect(categories(board, "q").map((category) => category.id)).toEqual(["todo"])
    expect(board.tasks.find((task) => task.projectID === "q")!.categoryID).toBe("todo")
    expect(board.categoriesByProject?.empty).toBeUndefined()
  })

  it("repairs orphans, duplicates, and empty data", () => {
    const board = normalizeBoard({
      categories: [
        { id: "a", name: " Alpha ", color: "#111111", position: 4 },
        { id: "a", name: "duplicate", color: "#222222", position: 0 },
      ],
      tasks: [
        {
          id: "t1",
          title: "",
          branch: "feature/x",
          projectID: "p",
          categoryID: "missing",
          position: 9,
          createdAt: 10,
          updatedAt: 10,
        } as never,
        { id: "t1", branch: "duplicate" } as never,
        {
          id: "t2",
          title: "T2",
          projectID: "p",
          projectRoot: "/",
          projectName: "p",
          branch: "y",
          categoryID: "a",
          position: 0,
          createdAt: 1,
          updatedAt: 1,
          archived: false,
        },
      ],
    })
    expect(board.categories).toHaveLength(1)
    expect(board.categories[0]!.name).toBe("Alpha")
    expect(board.tasks).toHaveLength(2)
    expect(board.tasks[0]!.categoryID).toBe("a")
    expect(board.tasks[0]!.title).toBe("feature/x")
    expect(board.tasks[0]!.projectName).toBe("p")
  })

  it("seeds defaults when categories are missing", () => {
    const board = normalizeBoard(undefined)
    expect(categories(board)).toHaveLength(3)
  })

  it("leaves a valid board stable", () => {
    const original = boardWith([input(), input({ branch: "b" })])
    const normalized = normalizeBoard(original)
    expect(normalized).toEqual(original)
  })

  it("leaves a valid per-project board stable", () => {
    let board = addCategory(defaultBoard(), PROJECT, "Review")
    board = addCategory(board, "proj_b", "Backlog")
    expect(normalizeBoard(board)).toEqual(board)
  })

  it("preserves a task's server id", () => {
    const board = createTask(defaultBoard(), input({ serverID: "s1" }))
    expect(normalizeBoard(board)).toEqual(board)
  })
})

describe("queries", () => {
  it("detects duplicate branches per project", () => {
    const board = createTask(defaultBoard(), input())
    expect(hasBranch(board, PROJECT, "feature/ship")).toBe(true)
    expect(hasBranch(board, PROJECT, "feature/ship", board.tasks[0]!.id)).toBe(false)
    expect(hasBranch(board, "proj_b", "feature/ship")).toBe(false)
  })

  it("counts active and archived tasks", () => {
    let board = boardWith([input(), input({ branch: "b" })])
    board = archiveTask(board, board.tasks[1]!.id)
    expect(projectTaskCounts(board, PROJECT)).toEqual({ total: 1, archived: 1 })
  })
})

describe("colors", () => {
  it("accepts six-digit hex and rejects everything else", () => {
    expect(safeColor("#12abEF", "#000000")).toBe("#12abEF")
    expect(safeColor("red", "#000000")).toBe("#000000")
    expect(safeColor("url(javascript:1)", "#000000")).toBe("#000000")
    expect(safeColor(undefined, "#000000")).toBe("#000000")
  })

  it("sanitizes a stored category color", () => {
    const board = normalizeBoard({ categories: [{ id: "a", name: "A", color: "red; x", position: 0 }] })
    expect(board.categories[0]!.color).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe("mergeSessionBindings", () => {
  it("preserves a current binding when the file omits it", () => {
    const current = createTask(defaultBoard(), input())
    const task = current.tasks[0]!
    const withSession = bindSession(current, task.id, "ses_keep")
    const imported = { ...withSession, tasks: withSession.tasks.map((item) => ({ ...item, sessionID: undefined })) }
    const merged = mergeSessionBindings(imported, withSession)
    expect(merged.tasks[0]!.sessionID).toBe("ses_keep")
  })

  it("lets the file override a binding and adds new tasks", () => {
    const current = createTask(defaultBoard(), input())
    const imported = { ...current, tasks: current.tasks.map((item) => ({ ...item, sessionID: "ses_file" })) }
    expect(mergeSessionBindings(imported, current).tasks[0]!.sessionID).toBe("ses_file")
  })
})

describe("tags", () => {
  it("adds, renames, recolors, and reads a project's tags", () => {
    let board = addTag(defaultBoard(), PROJECT, "Docs", "#5b8def")
    const tag = tagsOf(board, PROJECT)[0]!
    expect(tag.name).toBe("Docs")
    expect(tag.color).toBe("#5b8def")
    board = updateTag(board, PROJECT, tag.id, { name: " Documentation ", color: "#123456" })
    expect(tagsOf(board, PROJECT)[0]!.name).toBe("Documentation")
    expect(tagsOf(board, PROJECT)[0]!.color).toBe("#123456")
    expect(tagsOf(board, PROJECT)).toHaveLength(1)
    expect(tagsOf(board)).toHaveLength(0)
  })

  it("assigns only the project's tags and clears empty assignments", () => {
    let board = addTag(defaultBoard(), PROJECT, "Docs")
    const tag = tagsOf(board, PROJECT)[0]!
    board = createTask(board, input({ tagIDs: [tag.id, "missing"] }))
    expect(board.tasks[0]!.tagIDs).toEqual([tag.id])
    expect(taskTags(board, board.tasks[0]!).map((item) => item.name)).toEqual(["Docs"])
    const id = board.tasks[0]!.id
    board = updateTask(board, id, { tagIDs: [] })
    expect(board.tasks[0]!.tagIDs).toBeUndefined()
  })

  it("removes a deleted tag from that project's tasks only", () => {
    let board = addTag(defaultBoard(), PROJECT, "Docs")
    board = createTask(board, input({ tagIDs: [tagsOf(board, PROJECT)[0]!.id] }))
    board = addTag(board, "proj_b", "Estudo")
    const docs = tagsOf(board, PROJECT)[0]!
    const estudo = tagsOf(board, "proj_b")[0]!
    board = createTask(
      board,
      input({
        projectID: "proj_b",
        projectRoot: "/other",
        projectName: "other",
        branch: "feature/b",
        tagIDs: [estudo.id],
      }),
    )
    board = deleteTag(board, PROJECT, docs.id)
    expect(tagsOf(board, PROJECT)).toHaveLength(0)
    expect(tagsOf(board, "proj_b").map((tag) => tag.name)).toEqual(["Estudo"])
    expect(board.tasks.find((task) => task.projectID === PROJECT)!.tagIDs).toBeUndefined()
    expect(board.tasks.find((task) => task.projectID === "proj_b")!.tagIDs).toEqual([estudo.id])
  })

  it("keeps tag sets independent between projects", () => {
    let board = addTag(defaultBoard(), PROJECT, "Docs")
    board = addTag(board, "proj_b", "Estudo")
    const docs = tagsOf(board, PROJECT)[0]!
    board = updateTag(board, "proj_b", tagsOf(board, "proj_b")[0]!.id, { name: "Estudos" })
    expect(tagsOf(board, PROJECT).map((tag) => tag.name)).toEqual(["Docs"])
    expect(tagsOf(board, "proj_b").map((tag) => tag.name)).toEqual(["Estudos"])
    board = updateTag(board, PROJECT, docs.id, { name: "Documentation" })
    expect(tagsOf(board, PROJECT).map((tag) => tag.name)).toEqual(["Documentation"])
    expect(tagsOf(board, "proj_b").map((tag) => tag.name)).toEqual(["Estudos"])
  })

  it("rejects a tag owned by another project", () => {
    const board = addTag(defaultBoard(), "proj_b", "Estudo")
    const estudo = tagsOf(board, "proj_b")[0]!
    const created = createTask(board, input({ tagIDs: [estudo.id] }))
    expect(created.tasks[0]!.tagIDs).toBeUndefined()
  })

  it("normalizes tags and drops orphaned task tags", () => {
    const board = normalizeBoard({
      tags: [
        { id: "docs", name: " Docs ", color: "#5b8def" },
        { id: "docs", name: "duplicate", color: "#000000" },
        { id: "bad", name: "", color: "red" },
      ],
      categories: [{ id: "a", name: "A", color: "#111111", position: 0 }],
      tasks: [
        {
          id: "t1",
          title: "T",
          projectID: "p",
          projectRoot: "/p",
          projectName: "p",
          branch: "b",
          categoryID: "a",
          position: 0,
          tagIDs: ["docs", "missing", "docs"],
          createdAt: 1,
          updatedAt: 1,
          archived: false,
        },
      ],
    })
    expect(board.tags).toHaveLength(2)
    expect(board.tags![0]!.name).toBe("Docs")
    expect(board.tags![1]!.name).toBe("Tag")
    expect(tagsOf(board, "p").map((tag) => tag.name)).toEqual(["Docs", "Tag"])
    expect(board.tasks[0]!.tagIDs).toEqual(["docs"])
  })

  it("migrates shared tags into each project's own set", () => {
    const board = normalizeBoard({
      tags: [{ id: "docs", name: "Docs", color: "#5b8def" }],
      categories: [{ id: "todo", name: "Todo", color: "#111111", position: 0 }],
      tasks: [
        {
          id: "t1",
          title: "A",
          projectID: "a",
          projectRoot: "/a",
          projectName: "a",
          branch: "a",
          categoryID: "todo",
          position: 0,
          tagIDs: ["docs"],
          createdAt: 1,
          updatedAt: 1,
          archived: false,
        },
        {
          id: "t2",
          title: "B",
          projectID: "b",
          projectRoot: "/b",
          projectName: "b",
          branch: "b",
          categoryID: "todo",
          position: 0,
          tagIDs: ["docs"],
          createdAt: 1,
          updatedAt: 1,
          archived: false,
        },
      ],
    })
    expect(tagsOf(board, "a").map((tag) => tag.id)).toEqual(["docs"])
    expect(tagsOf(board, "b").map((tag) => tag.id)).toEqual(["docs"])
    expect(board.tagsByProject?.a).not.toBe(board.tagsByProject?.b)
  })

  it("preserves an intentionally empty project tag set", () => {
    const board = normalizeBoard({
      tags: [{ id: "docs", name: "Docs", color: "#5b8def" }],
      tagsByProject: { a: [] },
      categories: [{ id: "todo", name: "Todo", color: "#111111", position: 0 }],
      tasks: [
        {
          id: "t1",
          title: "A",
          projectID: "a",
          projectRoot: "/a",
          projectName: "a",
          branch: "a",
          categoryID: "todo",
          position: 0,
          createdAt: 1,
          updatedAt: 1,
          archived: false,
        },
      ],
    })
    expect(tagsOf(board, "a")).toEqual([])
  })
})

describe("isBoardLike", () => {
  it("accepts the board shape", () => {
    expect(isBoardLike(defaultBoard())).toBe(true)
    expect(isBoardLike(boardWith([input()]))).toBe(true)
  })

  it("rejects unrelated or incomplete files", () => {
    expect(isBoardLike(undefined)).toBe(false)
    expect(isBoardLike({})).toBe(false)
    expect(isBoardLike({ categories: [], tasks: [] })).toBe(false)
    expect(isBoardLike({ categories: [{ id: "c" }], tasks: "no" })).toBe(false)
    expect(isBoardLike({ categories: [{ id: "c" }], tasks: [{ id: "t", title: "T" }] })).toBe(false)
    expect(isBoardLike(null)).toBe(false)
  })
})

describe("branches", () => {
  it("generates feature branches with a three digit suffix", () => {
    const branch = generateBranch()
    expect(branch).toMatch(/^feature\/[a-z]+-[a-z]+-\d{3}$/)
  })

  it("validates common git mistakes", () => {
    expect(validateBranch("feature/ok")).toBeUndefined()
    expect(validateBranch("")).toBe("branch-required")
    expect(validateBranch("-bad")).toBe("branch-leading-dash")
    expect(validateBranch("a..b")).toBe("branch-double-dot")
    expect(validateBranch("a b")).toBe("branch-invalid")
    expect(validateBranch("a.lock")).toBe("branch-lock")
    expect(validateBranch("/a")).toBe("branch-slash")
  })
})
