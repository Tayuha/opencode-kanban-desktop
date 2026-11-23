import { describe, expect, it } from "vitest"
import type { OpenCodeClient } from "@opencode/client/promise"
import { createWorktree } from "./actions.ts"

function fake(dir = "/worktrees/feature") {
  const calls: unknown[] = []
  const client = {
    worktree: {
      create: async (input: unknown) => {
        calls.push({ create: input })
        return { directory: dir }
      },
      refresh: async (input: unknown) => {
        calls.push({ refresh: input })
      },
    },
  } as unknown as OpenCodeClient
  return { client, calls }
}

describe("createWorktree", () => {
  it("passes the base ref and a sanitized worktree name", async () => {
    const { client, calls } = fake()
    const directory = await createWorktree(client, "proj", "feature/amber otter", "main")
    expect(directory).toBe("/worktrees/feature")
    expect(calls).toEqual([
      { create: { projectID: "proj", branch: "main", name: "feature-amber-otter" } },
      { refresh: { projectID: "proj" } },
    ])
  })

  it("omits the ref and name when the inputs are blank", async () => {
    const { client, calls } = fake()
    await createWorktree(client, "proj", "  ", "")
    expect(calls).toEqual([
      { create: { projectID: "proj", branch: undefined, name: undefined } },
      { refresh: { projectID: "proj" } },
    ])
  })
})
