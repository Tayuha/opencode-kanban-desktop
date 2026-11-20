import { describe, expect, it } from "vitest"
import { normalizeTodos, parseTodos, todoPercent } from "./todo.ts"

function toolMessage(name: string, input: unknown, created = 1, status = "completed") {
  return {
    type: "assistant",
    time: { created },
    content: [{ type: "tool", name, state: { status, input } }],
  }
}

describe("normalizeTodos", () => {
  it("accepts status strings and completed booleans", () => {
    const summary = normalizeTodos([
      { content: "One", status: "completed" },
      { content: "Two", status: "in_progress" },
      { content: "Three", completed: true },
      { content: "Four" },
      { nope: true },
    ])
    expect(summary).toEqual({
      total: 4,
      done: 2,
      items: [
        { content: "One", status: "completed", completed: true },
        { content: "Two", status: "in_progress", completed: false },
        { content: "Three", status: "completed", completed: true },
        { content: "Four", status: "pending", completed: false },
      ],
    })
  })

  it("accepts text fields and rejects empty input", () => {
    expect(normalizeTodos([{ text: "Ship" }])?.items[0]!.content).toBe("Ship")
    expect(normalizeTodos([])).toBeUndefined()
    expect(normalizeTodos("nope")).toBeUndefined()
  })
})

describe("parseTodos", () => {
  it("finds a completed todo tool call", () => {
    const summary = parseTodos([
      toolMessage("todowrite", { todos: [{ content: "A", status: "pending" }, { content: "B", status: "completed" }] }),
    ])
    expect(summary?.total).toBe(2)
    expect(summary?.done).toBe(1)
  })

  it("ignores other tools and incomplete calls", () => {
    expect(parseTodos([toolMessage("bash", { todos: [{ content: "A" }] })])).toBeUndefined()
    expect(parseTodos([toolMessage("todowrite", { todos: [{ content: "A" }] }, 1, "running")])).toBeUndefined()
  })

  it("picks the newest call regardless of array order", () => {
    const summary = parseTodos([
      toolMessage("todowrite", { todos: [{ content: "new", status: "completed" }] }, 20),
      toolMessage("todowrite", { todos: [{ content: "old" }] }, 10),
    ])
    expect(summary?.items[0]!.content).toBe("new")
  })

  it("reads metadata and JSON content fallbacks", () => {
    const fromMetadata = parseTodos([
      {
        type: "assistant",
        time: { created: 1 },
        content: [{ type: "tool", name: "todo", state: { status: "completed", input: {}, metadata: { todos: [{ content: "M" }] } } }],
      },
    ])
    expect(fromMetadata?.items[0]!.content).toBe("M")

    const fromContent = parseTodos([
      {
        type: "assistant",
        time: { created: 1 },
        content: [
          {
            type: "tool",
            name: "update_todo",
            state: { status: "completed", input: {}, content: [{ type: "text", text: '{"todos":[{"content":"C"}]}' }] },
          },
        ],
      },
    ])
    expect(fromContent?.items[0]!.content).toBe("C")
  })

  it("returns undefined for non-assistant messages and empty lists", () => {
    expect(parseTodos([])).toBeUndefined()
    expect(parseTodos([{ type: "user", content: [] }])).toBeUndefined()
    expect(parseTodos([toolMessage("todowrite", { todos: [] })])).toBeUndefined()
  })

  it("computes a progress percentage", () => {
    expect(todoPercent(undefined)).toBe(0)
    expect(todoPercent({ items: [], total: 0, done: 0 })).toBe(0)
    expect(todoPercent({ items: [], total: 4, done: 1 })).toBe(25)
  })
})
