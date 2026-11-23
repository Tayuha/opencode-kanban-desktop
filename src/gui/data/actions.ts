import type { OpenCodeClient } from "@opencode/client/promise"
import type { Data } from "@opencode/client/solid"
import type { VcsFile, VcsSummary } from "../model/types.ts"

export type BranchList = {
  isRepo: boolean
  branches: string[]
  base?: string
  current?: string
}

export async function createWorktree(
  client: OpenCodeClient,
  projectID: string,
  name: string,
  base?: string,
  signal?: AbortSignal,
): Promise<string> {
  // OpenCode 2.3.2 runs `git worktree add --detach <dir> <ref>` and never creates a
  // branch. `name` labels the worktree directory; `base` must be an existing ref.
  const directoryName = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)

  const info = await client.worktree.create(
    {
      projectID,
      branch: base?.trim() || undefined,
      name: directoryName || undefined,
    },
    { signal },
  )
  try {
    await client.worktree.refresh({ projectID }, { signal })
  } catch {
    // The worktree exists even when the project refresh fails.
  }
  return info.directory
}

export async function removeWorktree(
  client: OpenCodeClient,
  projectID: string,
  directory: string,
  force: boolean,
  signal?: AbortSignal,
): Promise<void> {
  await client.worktree.remove({ projectID, directory, force }, { signal })
  try {
    await client.worktree.refresh({ projectID }, { signal })
  } catch {
    // Removal already succeeded.
  }
}

/** Reads the branch list, base, and whether the directory is a git repository. */
export async function listBranches(
  client: OpenCodeClient,
  directory: string,
  signal?: AbortSignal,
): Promise<BranchList> {
  try {
    const info = await client.vcs.get({ location: { directory } }, { signal })
    const current = info.data.branch.current
    let base: string | undefined
    let branches: string[] = []
    try {
      const baseInfo = await client.vcs.base({ location: { directory } }, { signal })
      base = baseInfo.data?.name
    } catch {
      base = info.data.branch.default
    }
    try {
      const list = await client.vcs.branch.list({ location: { directory }, limit: 200 }, { signal })
      branches = list.data
    } catch {
      branches = current ? [current] : []
    }
    if (base && !branches.includes(base)) branches.unshift(base)
    if (current && !branches.includes(current)) branches.unshift(current)
    return { isRepo: true, branches, base: base ?? info.data.branch.default, current }
  } catch {
    return { isRepo: false, branches: [] }
  }
}

export async function vcsChanges(
  client: OpenCodeClient,
  directory: string,
  signal?: AbortSignal,
): Promise<VcsSummary | undefined> {
  try {
    const [status, info, base] = await Promise.all([
      client.vcs.status({ location: { directory } }, { signal }),
      client.vcs.get({ location: { directory } }, { signal }).catch(() => undefined),
      client.vcs.base({ location: { directory } }, { signal }).catch(() => undefined),
    ])
    const files: VcsFile[] = status.data.map((file) => ({
      file: file.file,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
    }))
    return {
      branch: info?.data.branch.current,
      base: base?.data?.name,
      files,
      additions: files.reduce((sum, file) => sum + file.additions, 0),
      deletions: files.reduce((sum, file) => sum + file.deletions, 0),
    }
  } catch {
    return undefined
  }
}

/** Creates a session in a directory and sends the first prompt when there is one. */
export async function startSession(
  client: OpenCodeClient,
  data: Data,
  title: string,
  directory: string,
  prompt?: string,
  signal?: AbortSignal,
): Promise<{ id: string; promptError?: unknown }> {
  const session = await client.session.create(
    {
      title: title.trim() || undefined,
      location: { directory },
    },
    { signal },
  )
  let promptError: unknown
  try {
    if (prompt?.trim()) await client.session.prompt({ sessionID: session.id, text: prompt.trim() }, { signal })
  } catch (error) {
    promptError = error
  } finally {
    await data.session.sync(session.id).catch(() => undefined)
  }
  return { id: session.id, promptError }
}

/** Makes a session that exists on the server known to the app's data store. */
export async function ensureSessionKnown(data: Data, sessionID: string): Promise<void> {
  try {
    await data.session.sync(sessionID)
  } catch {
    // Opening the tab still works once the event stream catches up.
  }
}
