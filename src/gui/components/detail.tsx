import { For, Show, createEffect, createSignal, on } from "solid-js"
import { usePlugin, type MountedSession } from "@opencode/plugin/gui"
import type { definition } from "../definition.ts"
import type { KanbanServices } from "../api.ts"
import type { LiveTask, Task, VcsSummary } from "../model/types.ts"
import { Progress, StatusDot } from "../components.tsx"
import { hasManagedWorktree, taskTags } from "../model/board.ts"
import { defaultBoard } from "../model/board.ts"
import { statusLabelKey } from "../model/select.ts"
import { baseName, formatCost, shortID, timeAgo } from "../format.ts"

type DetailProps = {
  session: MountedSession
  task: Task | undefined
  live: LiveTask | undefined
  services: KanbanServices
  onBack(): void
  onEdit(task: Task): void
  onArchive(task: Task): void
  onDelete(task: Task): void
}

export function DetailView(props: DetailProps) {
  const ctx = usePlugin<typeof definition>()
  const ui = ctx.ui
  const [changes, setChanges] = createSignal<VcsSummary | undefined>()
  const [changesLoading, setChangesLoading] = createSignal(false)
  const [changesError, setChangesError] = createSignal(false)
  let request = 0

  const loadChanges = async (task: Task) => {
    const current = ++request
    setChangesLoading(true)
    setChangesError(false)
    const result = await props.services.vcs(props.session, task)
    if (current !== request) return
    setChanges(result)
    setChangesError(result === undefined)
    setChangesLoading(false)
  }

  createEffect(
    on(
      () => [props.task?.id, props.task?.worktreePath, props.task?.directory] as const,
      () => {
        const task = props.task
        setChanges(undefined)
        setChangesError(false)
        if (task) void loadChanges(task)
      },
    ),
  )

  const board = () => (props.task ? props.services.boardFor(props.task.projectRoot, props.task.projectID) : defaultBoard())
  const tags = () => (props.task ? taskTags(board(), props.task) : [])
  const locale = () => ctx.locale.locale()
  const status = () => props.live?.status ?? "none"
  const session = () => props.task?.sessionID ?? props.live?.sessionID
  const defaultPrompt = () => ctx.stores.prefs.value.initialPrompt.trim()

  const reveal = async (path: string | undefined) => {
    if (!path) {
      ctx.toast.show({ variant: "error", title: ctx.t("toast.noFolder") })
      return
    }
    try {
      await props.services.reveal(path)
    } catch {
      ctx.toast.show({ variant: "error", title: ctx.t("toast.revealFailed") })
    }
  }

  return (
    <Show
      when={props.task}
      fallback={<div class="kb-empty"><span class="kb-empty-title">{ctx.t("toast.noTask")}</span></div>}
    >
      {(task) => (
        <div class="kb-detail">
          <div class="kb-detail-head">
            <ui.IconButton icon="arrow-left" label={ctx.t("action.back")} size="small" onClick={props.onBack} />
            <span class="kb-detail-title">{task().title}</span>
            <span class="kb-chip" data-tone={status() === "running" ? "warning" : status() === "idle" ? "success" : undefined}>
              <StatusDot status={status()} /> {ctx.t(`status.${status() === "none" ? "noSession" : status()}`)}
            </span>
          </div>

          <div class="kb-detail-actions">
            <ui.Button
              variant="contrast"
              size="small"
              icon="terminal"
              onClick={() => void props.services.openTask(props.session, task())}
            >
              {session() ? ctx.t("action.openSession") : ctx.t("action.open")}
            </ui.Button>
            <Show when={session()}>
              <ui.Button
                variant="ghost"
                size="small"
                icon="new-session"
                onClick={() => void props.services.openTask(props.session, task(), "new")}
              >
                {ctx.t("action.newSession")}
              </ui.Button>
            </Show>
            <Show when={!session() && defaultPrompt()}>
              <ui.Button
                variant="neutral"
                size="small"
                icon="prompt"
                onClick={() => void props.services.startAgent(props.session, task())}
              >
                {ctx.t("action.startAgent")}
              </ui.Button>
            </Show>
            <ui.Button variant="ghost" size="small" icon="edit" onClick={() => props.onEdit(task())}>
              {ctx.t("action.edit")}
            </ui.Button>
            <ui.Button
              variant="ghost"
              size="small"
              icon="link"
              onClick={() => void props.services.linkTaskSession(props.session, task())}
            >
              {ctx.t("action.linkSession")}
            </ui.Button>
            <Show when={task().sessionID}>
              <ui.Button
                variant="ghost"
                size="small"
                icon="xmark-small"
                onClick={() => props.services.unlinkTaskSession(task())}
              >
                {ctx.t("action.unlinkSession")}
              </ui.Button>
            </Show>
            <ui.Button variant="ghost" size="small" icon="archive" onClick={() => props.onArchive(task())}>
              {ctx.t("action.archive")}
            </ui.Button>
            <ui.Button variant="ghost" size="small" icon="trash" onClick={() => props.onDelete(task())}>
              {ctx.t("action.delete")}
            </ui.Button>
          </div>

          <dl class="kb-grid">
            <dt>{ctx.t("detail.project")}</dt>
            <dd>{task().projectName}</dd>
            <dt>{ctx.t("detail.branch")}</dt>
            <dd class="kb-mono">
              {task().branch}{" "}
              <ui.IconButton
                icon="copy"
                label={ctx.t("action.copy")}
                size="small"
                onClick={() => void props.services.copy(task().branch)}
              />
            </dd>
            <Show when={task().baseBranch}>
              <dt>{ctx.t("detail.base")}</dt>
              <dd class="kb-mono">{task().baseBranch}</dd>
            </Show>
            <Show when={hasManagedWorktree(task())}>
              <dt>{ctx.t("detail.worktree")}</dt>
              <dd class="kb-mono">
                <span title={task().worktreePath}>{baseName(task().worktreePath)}</span>{" "}
                <ui.IconButton
                  icon="folder"
                  label={ctx.t("action.reveal")}
                  size="small"
                  onClick={() => void reveal(task().worktreePath)}
                />
              </dd>
            </Show>
            <Show when={task().directory}>
              <dt>{ctx.t("detail.folder")}</dt>
              <dd class="kb-mono">
                <span title={task().directory}>{task().directory}</span>{" "}
                <ui.IconButton
                  icon="folder"
                  label={ctx.t("action.reveal")}
                  size="small"
                  onClick={() => void reveal(task().directory)}
                />
              </dd>
            </Show>
            <Show when={!hasManagedWorktree(task()) && !task().directory}>
              <dt>{ctx.t("detail.worktree")}</dt>
              <dd>
                <span class="kb-note">{ctx.t("task.noWorktree")}</span>
              </dd>
            </Show>
            <dt>{ctx.t("detail.cost")}</dt>
            <dd>{formatCost(props.live?.cost)}</dd>
            <dt>{ctx.t("task.created")}</dt>
            <dd>{timeAgo(task().createdAt, Date.now(), locale())}</dd>
            <dt>{ctx.t("task.updated")}</dt>
            <dd>{timeAgo(task().updatedAt, Date.now(), locale())}</dd>
            <dt>{ctx.t("detail.sessionID")}</dt>
            <dd class="kb-mono">
              <Show when={session()} fallback={<span class="kb-note">{ctx.t("task.session.none")}</span>}>
                {shortID(session())} ·{" "}
                {props.live?.sessionTitle ??
                  (session() === task().sessionID ? ctx.t("task.session.linked") : ctx.t("task.session.none"))}
              </Show>
            </dd>
          </dl>

          <Show when={task().notes}>
            <div class="kb-section">
              <span class="kb-section-title">{ctx.t("task.field.notes")}</span>
              <span class="kb-note">{task().notes}</span>
            </div>
          </Show>

          <Show when={tags().length > 0}>
            <div class="kb-section">
              <span class="kb-section-title">{ctx.t("task.field.tags")}</span>
              <div class="kb-card-tags">
                <For each={tags()}>
                  {(tag) => (
                    <span class="kb-tag" style={`--kb-tag:${tag.color}`}>
                      {tag.name}
                    </span>
                  )}
                </For>
              </div>
            </div>
          </Show>

          <Show when={props.live?.todos && props.live.todos.total > 0}>
            <div class="kb-section">
              <div class="kb-section-head">
                <span class="kb-section-title">{ctx.t("detail.todos")}</span>
                <span class="kb-section-detail">
                  {ctx.t("detail.todos.progress", { done: props.live!.todos!.done, total: props.live!.todos!.total })}
                </span>
              </div>
              <Progress todos={props.live?.todos} showLabel={false} />
              <div class="kb-list">
                <For each={props.live?.todos?.items ?? []}>
                  {(item) => (
                    <div class="kb-row kb-todo" data-done={item.completed ? "true" : undefined} data-active={item.status === "in_progress" ? "true" : undefined}>
                      <span class="kb-row-icon" aria-hidden="true">
                        {item.completed ? "✓" : item.status === "in_progress" ? "◐" : "○"}
                      </span>
                      <span class="kb-row-main" title={item.content}>
                        {item.content}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          <div class="kb-section">
            <div class="kb-section-head">
              <span class="kb-section-title">{ctx.t("detail.subagents")}</span>
              <Show when={(props.live?.runningSubagents ?? 0) > 0}>
                <span class="kb-section-detail kb-tone-warning">
                  {ctx.t("card.runningSubagents", { count: props.live!.runningSubagents })}
                </span>
              </Show>
            </div>
            <Show when={(props.live?.subagents.length ?? 0) > 0} fallback={<span class="kb-note">{ctx.t("detail.subagents.empty")}</span>}>
              <div class="kb-list">
                <For each={props.live?.subagents ?? []}>
                  {(subagent) => (
                    <div class="kb-row">
                      <StatusDot status={subagent.status} label={ctx.t(statusLabelKey(subagent.status))} />
                      <span class="kb-row-main" title={subagent.title}>
                        {subagent.title}
                      </span>
                      <Show when={subagent.todos && subagent.todos.total > 0}>
                        <span class="kb-row-meta">
                          {subagent.todos!.done}/{subagent.todos!.total}
                        </span>
                      </Show>
                      <span class="kb-row-meta">{formatCost(subagent.cost)}</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>

          <div class="kb-section">
            <div class="kb-section-head">
              <span class="kb-section-title">{ctx.t("detail.changes")}</span>
              <Show when={changes()?.base}>
                <span class="kb-section-detail">{ctx.t("detail.changes.branch", { base: changes()!.base! })}</span>
              </Show>
              <span class="kb-card-foot kb-foot-grow" />
              <ui.IconButton
                icon="outline-rotate-clockwise"
                label={ctx.t("detail.changes.refresh")}
                size="small"
                busy={changesLoading()}
                onClick={() => void loadChanges(task())}
              />
            </div>
            <Show when={changesLoading()}>
              <ui.Loader size="small" />
            </Show>
            <Show when={changesError() && !changesLoading()}>
              <span class="kb-note">{ctx.t("detail.changes.error")}</span>
            </Show>
            <Show when={changes() && !changesLoading()}>
              <Show
                when={(changes()?.files.length ?? 0) > 0}
                fallback={<span class="kb-note">{ctx.t("detail.changes.empty")}</span>}
              >
                <div class="kb-row">
                  <span class="kb-row-main">
                    {ctx.t("detail.changes.files", { count: changes()!.files.length })}
                  </span>
                  <span class="kb-add">{ctx.t("detail.additions", { count: changes()!.additions })}</span>
                  <span class="kb-del">{ctx.t("detail.deletions", { count: changes()!.deletions })}</span>
                </div>
                <div class="kb-changes">
                  <For each={changes()!.files.slice(0, 60)}>
                    {(file) => (
                      <div class="kb-change">
                        <span class="kb-row-icon" aria-hidden="true">
                          {file.status === "added" ? "A" : file.status === "deleted" ? "D" : "M"}
                        </span>
                        <span class="kb-change-file" title={file.file}>
                          {file.file}
                        </span>
                        <span class="kb-add">+{file.additions}</span>
                        <span class="kb-del">−{file.deletions}</span>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </Show>
          </div>
        </div>
      )}
    </Show>
  )
}
