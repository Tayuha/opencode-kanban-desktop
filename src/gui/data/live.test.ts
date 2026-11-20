import { describe, expect, it, vi } from "vitest"
import type { Data } from "@opencode/client/solid"
import type { OpenCodeClient } from "@opencode/client/promise"
import { createLiveBoard, type LiveTransition } from "./live.ts"
import { createTask, defaultBoard } from "../model/board.ts"
import type { Task } from "../model/types.ts"

const SERVER = "sidecar"
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

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "ses_1",
    projectID: PROJECT,
    cost: 0.5,
    title: "Session",
    location: { directory: "/worktrees/task" },
    time: { created: 1, updated: 10 },
    ...overrides,
  }
}

function fakeData(): Data {
  return {
    on: () => () => {},
    listen: () => () => {},
  } as never
}

function fakeClient(options: {
  sessions: () => unknown[]
  active: () => Record<string, unknown>
  messages?: () => unknown[]
  get?: (sessionID: string) => unknown
}) {
  return {
    session: {
      list: vi.fn(async () => ({ data: options.sessions(), cursor: {} })),
      active: vi.fn(async () => options.active()),
      get: vi.fn(async ({ sessionID }: { sessionID: string }) => {
        if (!options.get) throw new Error("not found")
        return options.get(sessionID)
      }),
    },
    message: {
      list: vi.fn(async () => ({ data: options.messages?.() ?? [], cursor: {} })),
    },
  } as unknown as OpenCodeClient
}

function target(client: OpenCodeClient, tasks: () => readonly Task[]) {
  return {
    serverID: SERVER,
    projectID: PROJECT,
    client: () => client,
    data: () => fakeData(),
    tasks,
    projectName: () => "repo",
  }
}

describe("createLiveBoard", () => {
  it("derives running status, cost, and todos", async () => {
    const t = task()
    const tasks = [t]
    const client = fakeClient({
      sessions: () => [session()],
      active: () => ({ ses_1: { type: "running" } }),
      messages: () => [
        {
          type: "assistant",
          time: { created: 1 },
          content: [
            {
              type: "tool",
              name: "todowrite",
              state: { status: "completed", input: { todos: [{ content: "A", status: "completed" }] } },
            },
          ],
        },
      ],
    })
    const live = createLiveBoard({ pollMs: () => 0, debounceMs: () => 0 })
    const stop = live.watch(target(client, () => tasks), () => {})
    await live.refresh(SERVER, PROJECT)

    const snapshot = live.peek(SERVER, PROJECT)
    expect(snapshot?.tasks[t.id]?.status).toBe("running")
    expect(snapshot?.tasks[t.id]?.cost).toBe(0.5)
    expect(snapshot?.tasks[t.id]?.todos?.done).toBe(1)
    stop()
    live.dispose()
  })

  it("loads a pinned session outside the project session page", async () => {
    const t = task({ sessionID: "ses_pin" })
    const tasks = [t]
    const client = fakeClient({
      sessions: () => [session({ id: "ses_other", cost: 9, time: { created: 1, updated: 99 } })],
      active: () => ({ ses_pin: { type: "running" } }),
      get: () => session({ id: "ses_pin", cost: 2, title: "Pinned", time: { created: 1, updated: 5 } }),
    })
    const live = createLiveBoard({ pollMs: () => 0, debounceMs: () => 0 })
    const stop = live.watch(target(client, () => tasks), () => {})
    await live.refresh(SERVER, PROJECT)

    const snapshot = live.peek(SERVER, PROJECT)
    expect(snapshot?.tasks[t.id]?.sessionID).toBe("ses_pin")
    expect(snapshot?.tasks[t.id]?.status).toBe("running")
    expect(snapshot?.tasks[t.id]?.cost).toBe(2)
    stop()
    live.dispose()
  })

  it("does not fall back when a pinned session cannot be loaded", async () => {
    const t = task({ sessionID: "ses_missing" })
    const tasks = [t]
    const missing: string[] = []
    const client = fakeClient({
      sessions: () => [session({ id: "ses_other", cost: 9, time: { created: 1, updated: 99 } })],
      active: () => ({ ses_other: { type: "running" } }),
      get: () => {
        throw new Error("gone")
      },
    })
    const live = createLiveBoard({
      pollMs: () => 0,
      debounceMs: () => 0,
      onMissingPin: (event) => missing.push(event.sessionID),
    })
    const stop = live.watch(target(client, () => tasks), () => {})
    await live.refresh(SERVER, PROJECT)

    const snapshot = live.peek(SERVER, PROJECT)
    expect(snapshot?.tasks[t.id]?.sessionID).toBeUndefined()
    expect(snapshot?.tasks[t.id]?.status).toBe("none")
    expect(snapshot?.tasks[t.id]?.cost).toBe(0)
    expect(missing).toEqual([])
    stop()
    live.dispose()
  })

  it("reports a server-confirmed deleted pin", async () => {
    const t = task({ sessionID: "ses_gone" })
    const tasks = [t]
    const events: { sessionID: string; taskIDs: string[] }[] = []
    const client = fakeClient({
      sessions: () => [session({ id: "ses_other" })],
      active: () => ({}),
      get: () => {
        throw { _tag: "SessionNotFoundError", sessionID: "ses_gone", message: "Session not found" }
      },
    })
    const live = createLiveBoard({
      pollMs: () => 0,
      debounceMs: () => 0,
      onMissingPin: (event) => events.push(event),
    })
    const stop = live.watch(target(client, () => tasks), () => {})
    await live.refresh(SERVER, PROJECT)

    expect(events).toEqual([
      { serverID: SERVER, projectID: PROJECT, sessionID: "ses_gone", taskIDs: [t.id] },
    ])
    stop()
    live.dispose()
  })

  it("keeps an archived pinned session linked", async () => {
    const t = task({ sessionID: "ses_archived" })
    const tasks = [t]
    const client = fakeClient({
      sessions: () => [],
      active: () => ({}),
      get: () =>
        session({
          id: "ses_archived",
          title: "Archived",
          time: { created: 1, updated: 3, archived: true },
        }),
    })
    const live = createLiveBoard({ pollMs: () => 0, debounceMs: () => 0 })
    const stop = live.watch(target(client, () => tasks), () => {})
    await live.refresh(SERVER, PROJECT)

    const snapshot = live.peek(SERVER, PROJECT)
    expect(snapshot?.tasks[t.id]?.sessionID).toBe("ses_archived")
    expect(snapshot?.tasks[t.id]?.status).toBe("idle")
    stop()
    live.dispose()
  })

  it("scopes live tasks to the server and keeps legacy tasks", async () => {
    const mine = task({ serverID: SERVER })
    const other = task({ serverID: "another-server" })
    const legacy = task()
    const tasks = [mine, other, legacy]
    const client = fakeClient({ sessions: () => [], active: () => ({}) })
    const live = createLiveBoard({ pollMs: () => 0, debounceMs: () => 0 })
    const stop = live.watch(target(client, () => tasks), () => {})
    await live.refresh(SERVER, PROJECT)

    const snapshot = live.peek(SERVER, PROJECT)
    expect(Object.keys(snapshot?.tasks ?? {}).sort()).toEqual([legacy.id, mine.id].sort())
    stop()
    live.dispose()
  })

  it("notifies when a running session becomes idle", async () => {
    const t = task()
    const tasks = [t]
    let running = true
    const events: LiveTransition[] = []
    const client = fakeClient({
      sessions: () => [session()],
      active: () => (running ? { ses_1: { type: "running" } } : {}),
    })
    const live = createLiveBoard({ pollMs: () => 0, debounceMs: () => 0, onTransition: (event) => events.push(event) })
    const stop = live.watch(target(client, () => tasks), () => {})
    await live.refresh(SERVER, PROJECT)
    running = false
    await live.refresh(SERVER, PROJECT)

    expect(events).toHaveLength(1)
    expect(events[0]!.to).toBe("idle")
    expect(events[0]!.task.title).toBe("Task")
    expect(events[0]!.taskID).toBe(t.id)
    stop()
    live.dispose()
  })

  it("keeps the last good snapshot when a read fails", async () => {
    const t = task()
    const tasks = [t]
    let fail = false
    const client = fakeClient({
      sessions: () => {
        if (fail) throw new Error("offline")
        return [session()]
      },
      active: () => ({ ses_1: { type: "running" } }),
    })
    const live = createLiveBoard({ pollMs: () => 0, debounceMs: () => 0 })
    const stop = live.watch(target(client, () => tasks), () => {})
    await live.refresh(SERVER, PROJECT)
    fail = true
    await live.refresh(SERVER, PROJECT)

    const snapshot = live.peek(SERVER, PROJECT)
    expect(snapshot?.stale).toBe(true)
    expect(snapshot?.error).toContain("offline")
    expect(snapshot?.tasks[t.id]?.status).toBe("running")
    stop()
    live.dispose()
  })
})
