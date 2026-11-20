import type { TodoItem, TodoSummary } from "./types.ts"

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function textOf(value: unknown): string | undefined {
  if (typeof value === "string") return value
  if (isRecord(value) && typeof value.content === "string") return value.content
  if (isRecord(value) && typeof value.text === "string") return value.text
  return undefined
}

function normalizeStatus(value: unknown, completedFlag: unknown): TodoItem["status"] {
  if (completedFlag === true) return "completed"
  const status = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (status === "completed" || status === "complete" || status === "done") return "completed"
  if (status === "in_progress" || status === "in-progress" || status === "active" || status === "doing") {
    return "in_progress"
  }
  return "pending"
}

export function normalizeTodos(value: unknown): TodoSummary | undefined {
  if (!Array.isArray(value)) return undefined
  const items: TodoItem[] = []
  for (const raw of value) {
    if (!isRecord(raw)) continue
    const content = textOf(raw)?.trim()
    if (!content) continue
    const status = normalizeStatus(raw.status, raw.completed)
    items.push({ content, status, completed: status === "completed" })
    if (items.length >= 200) break
  }
  if (items.length === 0) return undefined
  return { items, total: items.length, done: items.filter((item) => item.completed).length }
}

function todosFromPayload(value: unknown): TodoSummary | undefined {
  if (!isRecord(value)) return undefined
  const direct = normalizeTodos(value.todos)
  if (direct) return direct
  const nested = normalizeTodos(value.items)
  if (nested) return nested
  return undefined
}

function todosFromText(text: string): TodoSummary | undefined {
  const trimmed = text.trim()
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return undefined
  try {
    const parsed: unknown = JSON.parse(trimmed)
    return todosFromPayload(parsed) ?? normalizeTodos(parsed)
  } catch {
    return undefined
  }
}

/** Tool names differ across OpenCode releases; everything todo-shaped contains "todo". */
export function isTodoTool(name: string | undefined): boolean {
  if (!name) return false
  return name.replace(/[^a-z0-9]/gi, "").toLowerCase().includes("todo")
}

type Candidate = { created: number; order: number; summary: TodoSummary }

/**
 * Reads the newest todo tool call from a session transcript. Accepts messages in any
 * order; returns undefined when the transcript has no todo tool or an empty list.
 */
export function parseTodos(messages: readonly unknown[]): TodoSummary | undefined {
  const candidates: Candidate[] = []

  messages.forEach((message, order) => {
    if (!isRecord(message)) return
    if (message.type !== "assistant") return
    const created = isRecord(message.time) && typeof message.time.created === "number" ? message.time.created : 0
    const content = Array.isArray(message.content) ? message.content : []
    for (const part of content) {
      if (!isRecord(part) || part.type !== "tool") continue
      if (!isTodoTool(typeof part.name === "string" ? part.name : undefined)) continue
      const state = isRecord(part.state) ? part.state : undefined
      if (!state) continue
      if (state.status !== "completed" && state.status !== "error") continue

      let summary = todosFromPayload(state.input)
      if (!summary && isRecord(state.metadata)) summary = todosFromPayload(state.metadata)
      if (!summary && Array.isArray(state.content)) {
        for (const block of state.content) {
          const text = textOf(block)
          if (!text) continue
          summary = todosFromText(text)
          if (summary) break
        }
      }
      if (summary) candidates.push({ created, order, summary })
    }
  })

  if (candidates.length === 0) return undefined
  candidates.sort((a, b) => a.created - b.created || a.order - b.order)
  return candidates[candidates.length - 1]!.summary
}

export function todoPercent(summary: TodoSummary | undefined): number {
  if (!summary || summary.total === 0) return 0
  return Math.round((summary.done / summary.total) * 100)
}
