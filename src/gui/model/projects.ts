import type { ProjectRow, Task } from "./types.ts"

type RawProject = {
  id: string
  canonical: string
  name?: string
}

export function baseName(path: string): string {
  const parts = path.replace(/\\/g, "/").replace(/\/+$/, "").split("/")
  return parts[parts.length - 1] || path
}

export function projectRows(projects: readonly RawProject[]): ProjectRow[] {
  const rows: ProjectRow[] = []
  const seen = new Set<string>()
  for (const project of projects) {
    if (!project?.id || seen.has(project.id)) continue
    seen.add(project.id)
    rows.push({
      id: project.id,
      name: project.name?.trim() || baseName(project.canonical),
      root: project.canonical,
    })
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name))
}

/** Adds the routed session's project when the project list has not loaded yet. */
export function mergeProject(
  rows: readonly ProjectRow[],
  project: { id: string; name?: string; worktree?: string } | undefined,
): ProjectRow[] {
  if (!project?.id || rows.some((row) => row.id === project.id)) return [...rows]
  return [
    ...rows,
    {
      id: project.id,
      name: project.name?.trim() || baseName(project.worktree ?? project.id),
      root: project.worktree ?? "",
    },
  ].sort((a, b) => a.name.localeCompare(b.name))
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
