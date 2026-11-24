import { describe, expect, it } from "vitest"
import {
  boardForProject,
  boardIn,
  boardKeyFor,
  findTaskIn,
  projectKey,
  scopeBoardToProject,
  splitLegacyBoard,
  withBoard,
} from "./boards.ts"
import {
  addTag,
  createTask,
  defaultBoard,
  normalizeBoard,
} from "./board.ts"
import type { Board } from "./types.ts"

const ROOT = "/work/alpha"
const OTHER = "/work/beta"

function task(board: Board, overrides: { id: string; projectID: string; projectRoot: string; title?: string; categoryID?: string }) {
  return createTask(board, {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    branch: `feature/${overrides.id}`,
    projectID: overrides.projectID,
    projectRoot: overrides.projectRoot,
    projectName: overrides.projectRoot.split("/").pop() ?? overrides.projectID,
    categoryID: overrides.categoryID ?? "todo",
    now: 1000,
  })
}

describe("projectKey", () => {
  it("normalizes trailing slashes and Windows separators", () => {
    expect(projectKey("/work/alpha/")).toBe("/work/alpha")
    expect(projectKey("C:\\Work\\Alpha\\")).toBe("c:/work/alpha")
  })

  it("falls back to a project id when a legacy task has no root", () => {
    expect(projectKey("", "proj_a")).toBe("id:proj_a")
    expect(projectKey(undefined)).toBe("")
  })
})

describe("board lookup and writes", () => {
  it("returns an empty board for an unknown project", () => {
    expect(boardIn({}, ROOT).tasks).toEqual([])
    expect(boardForProject({}, ROOT, "p").categories.length).toBeGreaterThan(0)
  })

  it("resolves a migrated root-less board by project id", () => {
    const legacy = task(defaultBoard(), { id: "task_a", projectID: "p", projectRoot: "" })
    const key = projectKey("", "p")
    const map = { [key]: legacy }
    expect(boardKeyFor(map, ROOT, "p")).toBe(key)
    expect(boardForProject(map, ROOT, "p").tasks.map((item) => item.id)).toEqual(["task_a"])
  })

  it("writes immutably and skips an unchanged board", () => {
    const board = task(defaultBoard(), { id: "task_a", projectID: "p", projectRoot: ROOT })
    const first = withBoard({}, ROOT, board)
    expect(first[ROOT]?.tasks).toHaveLength(1)
    expect(withBoard(first, ROOT, board)).toBe(first)
  })

  it("finds a task across every project board", () => {
    const board = task(defaultBoard(), { id: "task_a", projectID: "p", projectRoot: ROOT })
    const found = findTaskIn({ [ROOT]: board }, "task_a")
    expect(found?.key).toBe(ROOT)
    expect(found?.task.title).toBe("task_a")
    expect(findTaskIn({ [ROOT]: board }, "missing")).toBeUndefined()
  })
})

describe("splitLegacyBoard", () => {
  it("splits one global board into one board per project folder", () => {
    let legacy = defaultBoard()
    legacy = addTag(legacy, "p", "UI")
    legacy = task(legacy, { id: "task_a", projectID: "p", projectRoot: ROOT })
    legacy = addTag(legacy, "q", "Docs")
    legacy = task(legacy, { id: "task_b", projectID: "q", projectRoot: OTHER })

    const map = splitLegacyBoard(legacy)
    expect(Object.keys(map).sort()).toEqual([OTHER, ROOT].sort())
    expect(map[ROOT]?.tasks.map((item) => item.id)).toEqual(["task_a"])
    expect(map[ROOT]?.tags?.map((tag) => tag.name)).toEqual(["UI"])
    expect(map[OTHER]?.tasks.map((item) => item.id)).toEqual(["task_b"])
    expect(map[OTHER]?.tags?.map((tag) => tag.name)).toEqual(["Docs"])
  })

  it("groups duplicate project ids for the same folder", () => {
    let legacy = defaultBoard()
    legacy = task(legacy, { id: "task_a", projectID: "p", projectRoot: ROOT })
    legacy = task(legacy, { id: "task_b", projectID: "global", projectRoot: `${ROOT}/` })

    const map = splitLegacyBoard(legacy)
    expect(Object.keys(map)).toEqual([ROOT])
    expect(map[ROOT]?.tasks.map((item) => item.id).sort()).toEqual(["task_a", "task_b"])
  })
})

describe("scopeBoardToProject", () => {
  it("keeps only the requested project's tasks and columns", () => {
    let file = defaultBoard()
    file = addTag(file, "p", "UI")
    file = addTag(file, "q", "Docs")
    file = task(file, { id: "task_a", projectID: "p", projectRoot: ROOT })
    file = task(file, { id: "task_b", projectID: "q", projectRoot: OTHER })

    const scoped = scopeBoardToProject(normalizeBoard(file), ROOT, "p")
    expect(scoped.tasks.map((item) => item.id)).toEqual(["task_a"])
    expect(scoped.tags?.map((tag) => tag.name)).toEqual(["UI"])
    expect(scoped.categories.some((category) => category.id === "todo")).toBe(true)
  })

  it("accepts a legacy task by project id when the file has no root", () => {
    const file = task(defaultBoard(), { id: "task_a", projectID: "p", projectRoot: "" })
    const scoped = scopeBoardToProject(file, ROOT, "p")
    expect(scoped.tasks.map((item) => item.id)).toEqual(["task_a"])
  })
})
