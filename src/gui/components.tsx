import type { JSX } from "solid-js"
import { Show } from "solid-js"
import { usePlugin } from "@opencode/plugin/gui"
import type { definition } from "./definition.ts"
import type { TaskStatus, TodoSummary } from "./model/types.ts"
import { todoPercent } from "./model/todo.ts"

export function StatusDot(props: { status: TaskStatus; label?: string }) {
  return (
    <span
      class="kb-dot"
      data-status={props.status}
      title={props.label}
      aria-label={props.label}
      role={props.label ? "img" : undefined}
    />
  )
}

export function StatusLabel(props: { status: TaskStatus }) {
  const ctx = usePlugin<typeof definition>()
  const key = () => (props.status === "running" ? "status.running" : props.status === "idle" ? "status.idle" : "status.noSession")
  return (
    <span class="kb-card-line">
      <StatusDot status={props.status} />
      <span>{ctx.t(key())}</span>
    </span>
  )
}

export function Progress(props: { todos: TodoSummary | undefined; showLabel?: boolean }) {
  const ctx = usePlugin<typeof definition>()
  const percent = () => todoPercent(props.todos)
  return (
    <Show when={props.todos && props.todos.total > 0}>
      <span class="kb-progress" title={ctx.t("detail.todos.progress", { done: props.todos!.done, total: props.todos!.total })}>
        <span class="kb-progress-track">
          <span class="kb-progress-fill" style={{ width: `${percent()}%` }} />
        </span>
        <Show when={props.showLabel !== false}>
          <span class="kb-progress-label">
            {props.todos!.done}/{props.todos!.total}
          </span>
        </Show>
      </span>
    </Show>
  )
}

export function Empty(props: { title: string; body?: string; children?: JSX.Element }) {
  return (
    <div class="kb-empty">
      <span class="kb-empty-title">{props.title}</span>
      <Show when={props.body}>
        <span class="kb-empty-body">{props.body}</span>
      </Show>
      {props.children}
    </div>
  )
}

export function Field(props: { label: string; hint?: string; children: JSX.Element }) {
  return (
    <div class="kb-field">
      <span class="kb-field-label">{props.label}</span>
      {props.children}
      <Show when={props.hint}>
        <span class="kb-field-hint">{props.hint}</span>
      </Show>
    </div>
  )
}
