import { For, Index, Show, createEffect, createSignal, on } from "solid-js"
import { usePlugin, type MountedSession } from "@opencode/plugin/gui"
import type { definition } from "../definition.ts"
import type { KanbanServices } from "../api.ts"
import type { ProjectRow, Task } from "../model/types.ts"
import {
  addCategory,
  addTag,
  categories,
  DEFAULT_CATEGORIES,
  deleteCategory,
  deleteTag,
  generateBranch,
  hasBranch,
  moveCategory,
  tagsOf,
  updateCategory,
  updateTag,
  validateBranch,
} from "../model/board.ts"
import { Field, SwitchRow } from "../components.tsx"
import { findProject, insideFolder, nestedProjectFor } from "../model/projects.ts"
import type { BranchList } from "../data/actions.ts"

type TaskDialogProps = {
  session: MountedSession
  projects: ProjectRow[]
  initialProjectID: string
  initialCategoryID?: string
  task?: Task
  services: KanbanServices
  onClose(): void
}

const DEFAULT_BASE = "__opencode_kanban_default__"

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function TaskDialog(props: TaskDialogProps) {
  const ctx = usePlugin<typeof definition>()
  const ui = ctx.ui
  const prefs = () => ctx.stores.prefs.value
  const boardFor = (projectID: string) => {
    const root = findProject(props.projects, projectID)?.root ?? ""
    return props.services.boardFor(root, projectID)
  }
  const board = () => boardFor(projectID())
  const editing = () => props.task !== undefined
  const suggested = generateBranch()
  const initialProjectID = props.task?.projectID ?? props.initialProjectID
  const initialCategory = () => {
    const list = categories(boardFor(initialProjectID), initialProjectID)
    if (props.initialCategoryID && list.some((category) => category.id === props.initialCategoryID)) {
      return props.initialCategoryID
    }
    const value = prefs().defaultCategoryID
    if (value && list.some((category) => category.id === value)) return value
    return list[0]?.id ?? DEFAULT_CATEGORIES[0]!.id
  }

  const [projectID, setProjectID] = createSignal(props.task?.projectID ?? props.initialProjectID)
  const [title, setTitle] = createSignal(props.task?.title ?? "")
  const [branch, setBranch] = createSignal(props.task?.branch ?? "")
  const [base, setBase] = createSignal(props.task?.baseBranch ?? "")
  const [directory, setDirectory] = createSignal(props.task?.directory ?? "")
  const [categoryID, setCategoryID] = createSignal(props.task?.categoryID ?? initialCategory())
  const [notes, setNotes] = createSignal(props.task?.notes ?? "")
  const [tagIDs, setTagIDs] = createSignal<string[]>(props.task?.tagIDs ? [...props.task.tagIDs] : [])
  const [makeWorktree, setMakeWorktree] = createSignal(!editing())
  const [openOnCreate, setOpenOnCreate] = createSignal(prefs().openOnCreate)
  const [autoPrompt, setAutoPrompt] = createSignal(prefs().autoPrompt)
  const [prompt, setPrompt] = createSignal(prefs().initialPrompt)
  const [branches, setBranches] = createSignal<BranchList>({ isRepo: false, branches: [] })
  const [checking, setChecking] = createSignal(false)
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string | undefined>()
  let branchRequest = 0

  const project = () => findProject(props.projects, projectID())
  const currentBranch = () => branch().trim() || suggested

  /** A nested OpenCode project inside this one would open a different board for the session. */
  const nestedProject = (folder: string) => nestedProjectFor(props.projects, projectID(), folder)

  createEffect(
    on(
      projectID,
      () => {
        const row = project()
        if (!row || editing()) return
        const token = ++branchRequest
        setChecking(true)
        setBase("")
        setDirectory("")
        void props.services
          .branches(props.session, row.root)
          .then((result) => {
            if (token !== branchRequest) return
            setBranches(result)
            setMakeWorktree(result.isRepo)
            if (result.base) setBase(result.base)
          })
          .catch(() => {
            if (token !== branchRequest) return
            setBranches({ isRepo: false, branches: [] })
          })
          .finally(() => {
            if (token === branchRequest) setChecking(false)
          })
      },
    ),
  )

  const categoryOptions = () =>
    categories(board(), projectID()).map((category) => ({ value: category.id, label: category.name }))

  createEffect(
    on(projectID, (id) => {
      const list = categories(board(), id)
      if (!list.some((category) => category.id === categoryID())) {
        setCategoryID(list[0]?.id ?? DEFAULT_CATEGORIES[0]!.id)
      }
      const validTags = new Set(tagsOf(board(), id).map((tag) => tag.id))
      setTagIDs((ids) => ids.filter((tagID) => validTags.has(tagID)))
    }),
  )

  const toggleTag = (tagID: string) =>
    setTagIDs((ids) => (ids.includes(tagID) ? ids.filter((id) => id !== tagID) : [...ids, tagID]))

  const projectOptions = () =>
    props.projects.map((row) => ({ value: row.id, label: row.name }))

  const baseOptions = () => [
    { value: DEFAULT_BASE, label: ctx.t("task.field.base.auto") },
    ...branches().branches.map((value) => ({ value, label: value })),
  ]

  const pickDirectory = async () => {
    if (busy()) return
    try {
      const [picked] = (await ctx.desktop?.pick({
        directory: true,
        title: ctx.t("task.field.directory.pick"),
      })) ?? []
      if (!picked) return
      const row = project()
      if (row && !insideFolder(row.root, picked)) {
        setError(ctx.t("task.validation.directoryOutside"))
        return
      }
      if (nestedProject(picked)) {
        setError(ctx.t("task.validation.directoryProject"))
        return
      }
      setDirectory(picked)
      setMakeWorktree(false)
      setBase("")
      const info = await props.services.branches(props.session, picked).catch(() => undefined)
      if (info?.current) setBranch(info.current)
      else if (!branch().trim()) setBranch(generateBranch("existing"))
    } catch (cause) {
      setError(errorText(cause) || ctx.t("task.error.directory"))
    }
  }

  const validate = (): string | undefined => {
    const row = project()
    if (!row) return ctx.t("task.validation.project")
    if (!categories(board(), projectID()).some((category) => category.id === categoryID())) {
      return ctx.t("task.validation.category")
    }
    if (!title().trim() && !branch().trim()) return ctx.t("task.validation.title")
    const folder = directory().trim()
    if (folder && !folder.startsWith("/") && !folder.startsWith("\\\\") && !/^[a-zA-Z]:[\\/]/.test(folder)) {
      return ctx.t("task.validation.directory")
    }
    if (folder && !insideFolder(row.root, folder)) {
      return ctx.t("task.validation.directoryOutside")
    }
    if (folder && nestedProject(folder)) {
      return ctx.t("task.validation.directoryProject")
    }
    const value = currentBranch()
    const branchError = validateBranch(value)
    if (branchError) return ctx.t("task.validation.branch")
    if (hasBranch(board(), projectID(), value, props.task?.id, props.session.server.id)) {
      return ctx.t("task.validation.duplicate")
    }
    if (autoPrompt() && !prompt().trim()) return ctx.t("task.validation.prompt")
    return undefined
  }

  const submit = async () => {
    if (busy() || checking()) return
    setError(undefined)

    if (editing()) {
      props.services.updateTask(props.task!, {
        title: title().trim(),
        notes: notes().trim(),
        categoryID: categoryID(),
        tagIDs: tagIDs(),
      })
      props.onClose()
      return
    }

    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    const folder = directory().trim()
    if (folder) {
      const exists = await props.session.server.client.file
        .list({ location: { directory: folder } }, { signal: ctx.signal })
        .then(() => true)
        .catch(() => false)
      if (!exists) {
        setError(ctx.t("task.validation.directoryMissing"))
        return
      }
    }
    const row = project()!
    setBusy(true)
    try {
      await props.services.createTask(props.session, {
        projectID: row.id,
        projectRoot: row.root,
        projectName: row.name,
        title: title().trim(),
        branch: currentBranch(),
        baseBranch: base().trim() || undefined,
        directory: folder || undefined,
        categoryID: categoryID(),
        tagIDs: tagIDs(),
        notes: notes().trim() || undefined,
        makeWorktree: branches().isRepo && makeWorktree() && !folder,
        openOnCreate: openOnCreate(),
        autoPrompt: autoPrompt(),
        prompt: prompt(),
      })
      props.onClose()
    } catch (cause) {
      setError(errorText(cause) || ctx.t("task.error.create"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ui.Dialog
      title={editing() ? ctx.t("task.edit.title") : ctx.t("task.new.title")}
      description={editing() ? ctx.t("task.edit.description") : ctx.t("task.new.description")}
      size="large"
      footer={
        <div class="kb-form-footer">
          <ui.Button variant="ghost" onClick={props.onClose}>
            {ctx.t("action.cancel")}
          </ui.Button>
          <ui.Button variant="contrast" busy={busy()} disabled={checking()} onClick={() => void submit()}>
            {editing() ? ctx.t("action.save") : ctx.t("action.create")}
          </ui.Button>
        </div>
      }
    >
      <div class="kb kb-dialog-form">
        <div class="kb-form">
          <Field label={ctx.t("task.field.title")}>
            <ui.TextInput
              label={ctx.t("task.field.title")}
              value={title()}
              placeholder={ctx.t("task.field.title.placeholder")}
              onInput={setTitle}
              onSubmit={() => void submit()}
              size="large"
              autofocus
            />
          </Field>

          <Show when={!editing()}>
            <Field label={ctx.t("task.field.project")}>
              <ui.Select
                label={ctx.t("task.field.project")}
                options={projectOptions()}
                value={projectID()}
                onChange={setProjectID}
                disabled={busy()}
              />
            </Field>

            <Field
              label={ctx.t("task.field.directory")}
              hint={
                directory().trim()
                  ? `${ctx.t("task.field.directory.selected")} ${ctx.t("task.field.directory.board")}`
                  : `${ctx.t("task.field.directory.hint")} ${ctx.t("task.field.directory.project", {
                      path: project()?.root ?? "",
                    })}`
              }
            >
              <div class="kb-field-row">
                <ui.TextInput
                  label={ctx.t("task.field.directory")}
                  value={directory()}
                  placeholder={project()?.root ?? ctx.t("task.field.directory.placeholder")}
                  onInput={(value) => {
                    setDirectory(value)
                    if (value.trim()) setMakeWorktree(false)
                  }}
                  size="normal"
                />
                <ui.Button variant="neutral" size="small" onClick={() => void pickDirectory()}>
                  {ctx.t("task.field.directory.browse")}
                </ui.Button>
              </div>
            </Field>

            <Field
              label={ctx.t("task.field.branch")}
              hint={
                branches().isRepo
                  ? branch().trim()
                    ? undefined
                    : ctx.t("task.generate.branch")
                  : ctx.t("task.worktree.unavailable")
              }
            >
              <div class="kb-field-row">
                <ui.TextInput
                  label={ctx.t("task.field.branch")}
                  value={branch()}
                  placeholder={suggested}
                  onInput={setBranch}
                  size="normal"
                />
                <ui.Button variant="neutral" size="small" onClick={() => setBranch(generateBranch())}>
                  {ctx.t("task.field.branch.generate")}
                </ui.Button>
              </div>
            </Field>

            <Show when={makeWorktree() && branches().isRepo && !directory().trim()}>
              <Field label={ctx.t("task.field.base")}>
                <ui.Select
                  label={ctx.t("task.field.base")}
                  options={baseOptions()}
                  value={base().trim() || DEFAULT_BASE}
                  onChange={(value) => setBase(value === DEFAULT_BASE ? "" : value)}
                  disabled={busy()}
                />
              </Field>
            </Show>
          </Show>

          <Field label={ctx.t("task.field.category")}>
            <ui.Select
              label={ctx.t("task.field.category")}
              options={categoryOptions()}
              value={categoryID()}
              onChange={setCategoryID}
            />
          </Field>

          <Field label={ctx.t("task.field.tags")}>
            <div class="kb-tag-picker">
              <For each={tagsOf(board(), projectID())}>
                {(tag) => (
                  <button
                    type="button"
                    class="kb-tag"
                    style={`--kb-tag:${tag.color}`}
                    data-active={tagIDs().includes(tag.id) ? "true" : undefined}
                    aria-pressed={tagIDs().includes(tag.id)}
                    onClick={() => toggleTag(tag.id)}
                  >
                    {tag.name}
                  </button>
                )}
              </For>
              <Show when={tagsOf(board(), projectID()).length === 0}>
                <span class="kb-field-hint">{ctx.t("task.field.tags.empty")}</span>
              </Show>
              <ui.Button
                variant="ghost"
                size="small"
                icon="outline-sliders"
                onClick={() => {
                  const row = project()
                  if (row) props.services.openTagsDialog(row.id, row.name, row.root)
                }}
              >
                {ctx.t("tags.manage")}
              </ui.Button>
            </div>
          </Field>

          <Show when={editing()}>
            <Field label={ctx.t("task.field.branch")} hint={ctx.t("task.branchLocked")}>
              <span class="kb-mono">{props.task?.branch}</span>
            </Field>
            <Show when={props.task?.directory}>
              <Field label={ctx.t("task.field.directory")} hint={ctx.t("task.field.directory.locked")}>
                <span class="kb-mono">{props.task!.directory}</span>
              </Field>
            </Show>
          </Show>

          <Field label={ctx.t("task.field.notes")}>
            <textarea
              class="kb-textarea"
              aria-label={ctx.t("task.field.notes")}
              placeholder={ctx.t("task.field.notes.placeholder")}
              value={notes()}
              onInput={(event) => setNotes(event.currentTarget.value)}
            />
          </Field>

          <Show when={!editing()}>
            <SwitchRow
              label={ctx.t("task.worktree")}
              description={ctx.t("task.worktree.description")}
            >
              <ui.Switch
                label={ctx.t("task.worktree")}
                hideLabel
                checked={makeWorktree() && !directory().trim()}
                onChange={(checked) => {
                  setMakeWorktree(checked)
                  if (checked) setDirectory("")
                }}
                disabled={busy() || checking() || !branches().isRepo || !!directory().trim()}
              />
            </SwitchRow>
            <Show when={directory().trim()}>
              <span class="kb-field-hint">{ctx.t("task.field.directory.uses")}</span>
            </Show>
            <Show when={checking()}>
              <span class="kb-field-hint">{ctx.t("task.worktree.checking")}</span>
            </Show>
            <Show when={!branches().isRepo && !checking()}>
              <span class="kb-field-hint">{ctx.t("task.worktree.unavailable")}</span>
            </Show>

            <SwitchRow
              label={ctx.t("task.openOnCreate")}
              description={ctx.t("task.openOnCreate.description")}
            >
              <ui.Switch
                label={ctx.t("task.openOnCreate")}
                hideLabel
                checked={openOnCreate()}
                onChange={setOpenOnCreate}
                disabled={busy() || autoPrompt()}
              />
            </SwitchRow>

            <SwitchRow
              label={ctx.t("task.autoPrompt")}
              description={ctx.t("task.autoPrompt.description")}
            >
              <ui.Switch
                label={ctx.t("task.autoPrompt")}
                hideLabel
                checked={autoPrompt()}
                onChange={setAutoPrompt}
                disabled={busy()}
              />
            </SwitchRow>

            <Show when={autoPrompt() || openOnCreate()}>
              <Field label={ctx.t("task.field.prompt")}>
                <textarea
                  class="kb-textarea"
                  aria-label={ctx.t("task.field.prompt")}
                  placeholder={ctx.t("task.field.prompt.placeholder")}
                  value={prompt()}
                  onInput={(event) => setPrompt(event.currentTarget.value)}
                />
              </Field>
            </Show>
          </Show>

          <Show when={error()}>
            <div class="kb-error" role="alert">
              {error()}
            </div>
          </Show>
        </div>
      </div>
    </ui.Dialog>
  )
}

type ColumnsDialogProps = {
  projectID: string
  projectName?: string
  projectRoot?: string
  services: KanbanServices
  onClose(): void
}

export function ColumnsDialog(props: ColumnsDialogProps) {
  const ctx = usePlugin<typeof definition>()
  const ui = ctx.ui
  const board = () => props.services.boardFor(props.projectRoot, props.projectID)
  const columns = () => categories(board(), props.projectID)
  const save = (next: ReturnType<typeof addCategory>) =>
    props.services.saveBoard(props.projectRoot, next, props.projectID)

  const add = () => save(addCategory(board(), props.projectID, "New column"))

  const remove = async (id: string, name: string) => {
    if (columns().length <= 1) {
      await ctx.dialogs.alert({ title: ctx.t("columns.title"), description: ctx.t("columns.last") })
      return
    }
    const ok = await ctx.dialogs.confirm({
      title: ctx.t("column.delete.title"),
      description: `${name}. ${ctx.t("column.delete.description")}`,
      confirm: ctx.t("action.delete"),
      danger: true,
    })
    if (ok) save(deleteCategory(board(), props.projectID, id))
  }

  return (
    <ui.Dialog
      title={ctx.t("columns.title")}
      description={
        props.projectName
          ? ctx.t("columns.description.project", { project: props.projectName })
          : ctx.t("columns.description")
      }
      size="large"
      footer={
        <ui.Button variant="contrast" onClick={props.onClose}>
          {ctx.t("action.close")}
        </ui.Button>
      }
    >
      <div class="kb kb-dialog-form">
        <div class="kb-columns">
          <Index each={columns()}>
            {(category, index) => (
              <div class="kb-column-row">
                <input
                  class="kb-color"
                  type="color"
                  aria-label={`${ctx.t("columns.color")} ${index + 1}`}
                  value={category().color}
                  onChange={(event) =>
                    save(updateCategory(board(), props.projectID, category().id, { color: event.currentTarget.value }))
                  }
                />
                <input
                  type="text"
                  aria-label={`${ctx.t("columns.name")} ${index + 1}`}
                  value={category().name}
                  onInput={(event) =>
                    save(updateCategory(board(), props.projectID, category().id, { name: event.currentTarget.value }))
                  }
                />
                <span class="kb-col-count">
                  {board().tasks.filter(
                    (task) => task.projectID === props.projectID && task.categoryID === category().id,
                  ).length}
                </span>
                <button
                  type="button"
                  class="kb-icon-button"
                  aria-label={ctx.t("action.moveUp")}
                  disabled={index === 0}
                  onClick={() => save(moveCategory(board(), props.projectID, category().id, -1))}
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="kb-icon-button"
                  aria-label={ctx.t("action.moveDown")}
                  disabled={index === columns().length - 1}
                  onClick={() => save(moveCategory(board(), props.projectID, category().id, 1))}
                >
                  ↓
                </button>
                <button
                  type="button"
                  class="kb-icon-button"
                  aria-label={ctx.t("column.delete")}
                  disabled={columns().length <= 1}
                  onClick={() => void remove(category().id, category().name)}
                >
                  ×
                </button>
              </div>
            )}
          </Index>
          <div>
            <ui.Button variant="neutral" size="small" icon="plus" onClick={add}>
              {ctx.t("columns.add")}
            </ui.Button>
          </div>
        </div>
      </div>
    </ui.Dialog>
  )
}


type TagsDialogProps = {
  projectID: string
  projectName?: string
  projectRoot?: string
  services: KanbanServices
  onClose(): void
}

export function TagsDialog(props: TagsDialogProps) {
  const ctx = usePlugin<typeof definition>()
  const ui = ctx.ui
  const board = () => props.services.boardFor(props.projectRoot, props.projectID)
  const tags = () => tagsOf(board(), props.projectID)
  const save = (next: ReturnType<typeof addTag>) =>
    props.services.saveBoard(props.projectRoot, next, props.projectID)

  const add = () => save(addTag(board(), props.projectID, "New tag"))

  const remove = async (id: string, name: string) => {
    const used = board().tasks.filter(
      (task) => task.projectID === props.projectID && task.tagIDs?.includes(id),
    ).length
    const ok = await ctx.dialogs.confirm({
      title: ctx.t("tags.delete.title"),
      description: `${name}. ${ctx.t("tags.delete.description", { count: used })}`,
      confirm: ctx.t("action.delete"),
      danger: true,
    })
    if (ok) save(deleteTag(board(), props.projectID, id))
  }

  return (
    <ui.Dialog
      title={ctx.t("tags.title")}
      description={
        props.projectName
          ? ctx.t("tags.description.project", { project: props.projectName })
          : ctx.t("tags.description")
      }
      size="large"
      footer={
        <ui.Button variant="contrast" onClick={props.onClose}>
          {ctx.t("action.close")}
        </ui.Button>
      }
    >
      <div class="kb kb-dialog-form">
        <div class="kb-columns">
          <Show when={tags().length === 0}>
            <span class="kb-field-hint">{ctx.t("tags.empty")}</span>
          </Show>
          <Index each={tags()}>
            {(tag, index) => (
              <div class="kb-column-row">
                <input
                  class="kb-color"
                  type="color"
                  aria-label={`${ctx.t("tags.color")} ${index + 1}`}
                  value={tag().color}
                  onChange={(event) =>
                    save(updateTag(board(), props.projectID, tag().id, { color: event.currentTarget.value }))
                  }
                />
                <input
                  type="text"
                  aria-label={`${ctx.t("tags.name")} ${index + 1}`}
                  value={tag().name}
                  onInput={(event) =>
                    save(updateTag(board(), props.projectID, tag().id, { name: event.currentTarget.value }))
                  }
                />
                <span class="kb-col-count">
                  {board().tasks.filter(
                    (task) => task.projectID === props.projectID && task.tagIDs?.includes(tag().id),
                  ).length}
                </span>
                <button
                  type="button"
                  class="kb-icon-button"
                  aria-label={`${ctx.t("tags.delete.title")} ${tag().name}`}
                  onClick={() => void remove(tag().id, tag().name)}
                >
                  ×
                </button>
              </div>
            )}
          </Index>
          <div>
            <ui.Button variant="neutral" size="small" icon="plus" onClick={add}>
              {ctx.t("tags.add")}
            </ui.Button>
          </div>
        </div>
      </div>
    </ui.Dialog>
  )
}
