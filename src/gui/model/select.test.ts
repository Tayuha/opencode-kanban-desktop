import { describe, expect, it } from "vitest"
import { addTag, archiveTask, bindSession, createTask, defaultBoard, tagsOf } from "./board.ts"
import {
  firstVisibleTask,
  matchesQuery,
  matchesTags,
  neighbours,
  statusLabelKey,
  visibleArchive,
  visibleBoard,
  visibleTasks,
} from "./select.ts"
import type { Board } from "./types.ts"

const P = "proj"

function board(): Board {
  let next = defaultBoard()
  for (const [title, branch, categoryID] of [
    ["Fix parser", "feature/parser", "todo"],
    ["Ship board", "feature/board", "in-progress"],
    ["Write docs", "feature/docs", "done"],
  ] as const) {
    next = createTask(next, {
      title,
      branch,
      projectID: P,
      projectRoot: "/repo",
      projectName: "repo",
      categoryID,
      now: 1,
    })
  }
  return next
}

describe("search", () => {
  it("matches title, branch, project, and notes case-insensitively", () => {
    const task = board().tasks[0]!
    expect(matchesQuery(task, "")).toBe(true)
    expect(matchesQuery(task, "PARSER")).toBe(true)
    expect(matchesQuery(task, "repo")).toBe(true)
    expect(matchesQuery(task, "missing")).toBe(false)
    expect(matchesQuery({ ...task, notes: "urgent" }, "urgen")).toBe(true)
  })

  it("scopes visible tasks by server and keeps legacy tasks", () => {
    const make = (branch: string, serverID?: string) => ({
      title: branch,
      branch,
      projectID: P,
      projectRoot: "/repo",
      projectName: "repo",
      serverID,
      categoryID: "todo",
      now: 1,
    })
    let board = createTask(defaultBoard(), make("a", "s1"))
    board = createTask(board, make("b", "s2"))
    board = createTask(board, make("legacy"))
    expect(visibleTasks(board, P, "todo", "", [], "s1").map((task) => task.branch)).toEqual(["a", "legacy"])
    expect(visibleTasks(board, P, "todo", "", [], "s2").map((task) => task.branch)).toEqual(["b", "legacy"])
  })

  it("filters by tags with AND semantics", () => {
    let board = addTag(defaultBoard(), P, "Docs")
    board = addTag(board, P, "UI")
    const docs = tagsOf(board, P)[0]!
    const ui = tagsOf(board, P)[1]!
    board = createTask(board, {
      title: "Docs task",
      branch: "docs/task",
      projectID: P,
      projectRoot: "/repo",
      projectName: "repo",
      categoryID: "todo",
      tagIDs: [docs.id],
      now: 1,
    })
    board = createTask(board, {
      title: "Both",
      branch: "docs/ui",
      projectID: P,
      projectRoot: "/repo",
      projectName: "repo",
      categoryID: "todo",
      tagIDs: [docs.id, ui.id],
      now: 2,
    })
    expect(visibleTasks(board, P, "todo", "", [docs.id]).map((task) => task.title)).toEqual([
      "Docs task",
      "Both",
    ])
    expect(visibleTasks(board, P, "todo", "", [docs.id, ui.id]).map((task) => task.title)).toEqual(["Both"])
    expect(matchesTags(board.tasks[0]!, [])).toBe(true)
    expect(matchesTags(board.tasks[0]!, [ui.id])).toBe(false)
  })

  it("filters each column and the archive", () => {
    let next = board()
    next = archiveTask(next, next.tasks[0]!.id)
    expect(visibleTasks(next, P, "todo", "")).toHaveLength(0)
    expect(visibleArchive(next, P, "parser")).toHaveLength(1)
    const columns = visibleBoard(next, P, "")
    expect(columns.map((column) => column.tasks.length)).toEqual([0, 1, 1])
  })
})

describe("selection", () => {
  it("finds the first visible task in a column or board", () => {
    const next = board()
    expect(firstVisibleTask(next, P, "in-progress", "")?.branch).toBe("feature/board")
    expect(firstVisibleTask(next, P, "todo", "nope")).toBeUndefined()
    expect(firstVisibleTask(next, P, undefined, "")?.branch).toBe("feature/parser")
  })

  it("finds neighbours in the same column", () => {
    let next = board()
    next = createTask(next, {
      title: "Second",
      branch: "feature/second",
      projectID: P,
      projectRoot: "/repo",
      projectName: "repo",
      categoryID: "todo",
      now: 2,
    })
    const [first, second] = visibleTasks(next, P, "todo", "")
    expect(neighbours(next, first!, "").next?.id).toBe(second!.id)
    expect(neighbours(next, second!, "").previous?.id).toBe(first!.id)
  })

  it("names the status keys the panel translates", () => {
    expect(statusLabelKey("running")).toBe("status.running")
    expect(statusLabelKey("idle")).toBe("status.idle")
    expect(statusLabelKey("none")).toBe("status.noSession")
  })
})
