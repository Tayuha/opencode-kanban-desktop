import { describe, expect, it } from "vitest"
import type { SessionRow, Task } from "./types.ts"
import { createTask, defaultBoard } from "./board.ts"
import {
  completed,
  deriveLive,
  descendants,
  matchTaskSession,
  normalizePath,
  samePath,
  sessionRows,
  statusOf,
} from "./status.ts"

const PROJECT = "proj"

function task(overrides: Partial<Task> = {}): Task {
  const board = createTask(defaultBoard(), {
    title: "Task",
    branch: "feature/task",
    projectID: PROJECT,
    projectRoot: "/repo",
    projectName: "repo",
    categoryID: "todo",
    worktreePath: "/worktrees/task",
    now: 1,
  })
  return { ...board.tasks[0]!, ...overrides }
}

function session(overrides: Partial<SessionRow> & { id: string }): SessionRow {
  return {
    projectID: PROJECT,
    directory: "/worktrees/task",
    cost: 0,
    updated: 100,
    running: false,
    ...overrides,
  }
}

describe("paths", () => {
  it("normalizes separators and trailing slashes", () => {
    expect(normalizePath("/a/b/")).toBe("/a/b")
    expect(normalizePath("C:\\Work\\Repo\\")).toBe("c:/work/repo")
    expect(samePath("/a/b/", "/a/b")).toBe(true)
    expect(samePath("/a/b", "/a/c")).toBe(false)
    expect(samePath(undefined, "/a")).toBe(false)
  })
})

describe("sessionRows", () => {
  it("maps ids, directories, costs, and running state", () => {
    const rows = sessionRows(
      [
        {
          id: "ses_1",
          projectID: "p",
          cost: 1.5,
          location: { directory: "/w" },
          time: { created: 10, updated: 20 },
          title: "T",
        } as never,
      ],
      { ses_1: { type: "running" } },
    )
    expect(rows).toEqual([
      {
        id: "ses_1",
        parentID: undefined,
        projectID: "p",
        directory: "/w",
        title: "T",
        cost: 1.5,
        updated: 20,
        running: true,
      },
    ])
  })
})

describe("matchTaskSession", () => {
  it("prefers a pinned session", () => {
    const pinned = session({ id: "ses_pin", updated: 1 })
    const newer = session({ id: "ses_new", updated: 99 })
    expect(matchTaskSession(task({ sessionID: "ses_pin" }), [newer, pinned])?.id).toBe("ses_pin")
  })

  it("does not substitute a newer worktree session when the pin is absent", () => {
    const newer = session({ id: "ses_new", updated: 99 })
    expect(matchTaskSession(task({ sessionID: "ses_missing" }), [newer])).toBeUndefined()
  })

  it("falls back to the newest root session in the worktree", () => {
    const older = session({ id: "ses_old", updated: 10 })
    const newer = session({ id: "ses_new", updated: 20 })
    const child = session({ id: "ses_child", updated: 30, parentID: "ses_new" })
    const other = session({ id: "ses_other", directory: "/elsewhere", updated: 40 })
    expect(matchTaskSession(task(), [older, newer, child, other])?.id).toBe("ses_new")
  })

  it("matches a root session in an existing folder", () => {
    const existing = session({ id: "ses_existing", directory: "/existing" })
    const found = matchTaskSession(
      task({ worktreePath: undefined, directory: "/existing" }),
      [existing],
    )
    expect(found?.id).toBe("ses_existing")
  })

  it("returns nothing without a worktree match", () => {
    expect(matchTaskSession(task({ worktreePath: undefined }), [session({ id: "ses_1" })])).toBeUndefined()
  })
})

describe("descendants", () => {
  it("walks nested subagents without duplicates", () => {
    const sessions = [
      session({ id: "root" }),
      session({ id: "a", parentID: "root" }),
      session({ id: "b", parentID: "a" }),
      session({ id: "c", parentID: "root" }),
      session({ id: "other" }),
    ]
    expect(descendants("root", sessions).map((item) => item.id).sort()).toEqual(["a", "b", "c"])
  })
})

describe("deriveLive", () => {
  it("derives status, nested subagents, and cost", () => {
    const sessions = [
      session({ id: "root", running: true, cost: 1, title: "Root" }),
      session({ id: "sub", parentID: "root", running: true, cost: 2, title: "Sub" }),
      session({ id: "sub2", parentID: "sub", running: false, cost: 4, title: "" }),
    ]
    const live = deriveLive(task({ sessionID: "root" }), sessions, (id) =>
      id === "sub" ? { items: [{ content: "x", status: "completed", completed: true }], total: 1, done: 1 } : undefined,
    500,
    )
    expect(live.status).toBe("running")
    expect(live.cost).toBe(7)
    expect(live.runningSubagents).toBe(1)
    expect(live.subagents).toHaveLength(2)
    expect(live.subagents[0]!.todos?.done).toBe(1)
    expect(live.sessionTitle).toBe("Root")
    expect(live.updatedAt).toBe(500)
  })

  it("reports no session when nothing matches", () => {
    const live = deriveLive(task(), [], undefined, 1)
    expect(live.status).toBe("none")
    expect(live.cost).toBe(0)
  })
})

describe("status helpers", () => {
  it("maps a session to a status", () => {
    expect(statusOf(undefined)).toBe("none")
    expect(statusOf(session({ id: "a" }))).toBe("idle")
    expect(statusOf(session({ id: "a", running: true }))).toBe("running")
  })

  it("detects a running to idle completion", () => {
    const previous = deriveLive(task(), [session({ id: "a", running: true })])
    const next = deriveLive(task(), [session({ id: "a", running: false })], undefined, 2)
    expect(completed(previous, next)).toBe(true)
    expect(completed(next, previous)).toBe(false)
    expect(completed(undefined, next)).toBe(false)
  })
})
