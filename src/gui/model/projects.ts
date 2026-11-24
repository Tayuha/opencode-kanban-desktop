import type { ProjectRow, Task } from "./types.ts"
import { normalizePath } from "./status.ts"

type RawProject = {
  id: string
  canonical: string
  name?: string
}

export function baseName(path: string): string {
  const parts = path.replace(/\\/g, "/").replace(/\/+$/, "").split("/")
  return parts[parts.length - 1] || path
}

/** Canonicalizes a folder for containment checks without resolving symlinks. */
export function normalizedFolder(value: string): string {
  const slashed = value.replace(/\\/g, "/").replace(/\/+/g, "/")
  const prefix = slashed.startsWith("/") ? "/" : ""
  const parts: string[] = []
  for (const part of slashed.split("/")) {
    if (!part || part === ".") continue
    if (part === "..") {
      parts.pop()
      continue
    }
    parts.push(part)
  }
  const joined = `${prefix}${parts.join("/")}`.replace(/\/+$/, "")
  return joined || "/"
}

/** Whether a folder is the root itself or is inside it. Windows paths compare case-insensitively. */
export function insideFolder(root: string, folder: string): boolean {
  if (!root.trim() || !folder.trim()) return false
  const base = normalizedFolder(root)
  const target = normalizedFolder(folder)
  const windows = /^[a-zA-Z]:/.test(base)
  const left = windows ? base.toLowerCase() : base
  const right = windows ? target.toLowerCase() : target
  return right === left || right.startsWith(left === "/" ? "/" : `${left}/`)
}

/**
 * A project root nested inside the current project that contains the folder. OpenCode assigns a
 * session there to the nested project, so the panel would switch to a different board.
 */
export function nestedProjectFor(
  rows: readonly ProjectRow[],
  currentID: string | undefined,
  folder: string,
): ProjectRow | undefined {
  const current = currentID ? rows.find((row) => row.id === currentID) : undefined
  if (!current?.root || !folder.trim()) return undefined
  return rows.find(
    (row) =>
      row.id !== current.id &&
      !!row.root &&
      insideFolder(current.root, row.root) &&
      insideFolder(row.root, folder),
  )
}

export function projectRows(projects: readonly RawProject[]): ProjectRow[] {
  const rows: ProjectRow[] = []
  const seen = new Set<string>()
  const roots = new Set<string>()
  for (const project of projects) {
    if (!project?.id || seen.has(project.id)) continue
    const root = normalizePath(project.canonical)
    if (root && roots.has(root)) continue
    seen.add(project.id)
    if (root) roots.add(root)
    rows.push({
      id: project.id,
      name: project.name?.trim() || baseName(project.canonical),
      root: project.canonical,
    })
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name))
}

/** Adds the routed project, replacing a duplicate record for the same folder. */
export function mergeProject(
  rows: readonly ProjectRow[],
  project: { id: string; name?: string; worktree?: string } | undefined,
): ProjectRow[] {
  if (!project?.id) return [...rows]
  if (rows.some((row) => row.id === project.id)) return [...rows]

  const root = project.worktree ?? ""
  const row: ProjectRow = {
    id: project.id,
    name: project.name?.trim() || baseName(root || project.id),
    root,
  }

  if (root) {
    const at = rows.findIndex((item) => normalizePath(item.root) === normalizePath(root))
    if (at >= 0) {
      const next = [...rows]
      next[at] = row
      return next.sort((a, b) => a.name.localeCompare(b.name))
    }
  }

  return [...rows, row].sort((a, b) => a.name.localeCompare(b.name))
}

export function findProject(rows: readonly ProjectRow[], id: string | undefined): ProjectRow | undefined {
  return id ? rows.find((row) => row.id === id) : undefined
}

export function projectForSession(
  session: {
    projectID?: string
    directory: string
    project?: { id: string; name?: string; worktree?: string }
  },
): ProjectRow | undefined {
  if (session.project?.id) {
    return {
      id: session.project.id,
      name: session.project.name?.trim() || baseName(session.project.worktree ?? session.directory),
      root: session.project.worktree ?? session.directory,
    }
  }
  if (session.projectID) {
    return { id: session.projectID, name: baseName(session.directory), root: session.directory }
  }
  return undefined
}

export function projectName(rows: readonly ProjectRow[], id: string | undefined, fallback = ""): string {
  return findProject(rows, id)?.name ?? fallback
}

export function projectRoot(rows: readonly ProjectRow[], id: string | undefined, fallback = ""): string {
  return findProject(rows, id)?.root ?? fallback
}

export function taskProject(task: Task): { id: string; name: string; root: string } {
  return { id: task.projectID, name: task.projectName, root: task.projectRoot }
}
