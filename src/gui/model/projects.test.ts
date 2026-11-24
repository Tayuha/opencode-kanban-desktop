import { describe, expect, it } from "vitest"
import {
  baseName,
  findProject,
  mergeProject,
  projectForSession,
  projectName,
  projectRoot,
  projectRows,
} from "./projects.ts"

describe("projectRows", () => {
  it("names, sorts, and deduplicates projects", () => {
    const rows = projectRows([
      { id: "b", canonical: "/work/zebra" },
      { id: "a", canonical: "/work/alpha", name: "Alpha" },
      { id: "a", canonical: "/work/alpha", name: "Duplicate" },
    ])
    expect(rows).toEqual([
      { id: "a", name: "Alpha", root: "/work/alpha" },
      { id: "b", name: "zebra", root: "/work/zebra" },
    ])
  })

  it("deduplicates different ids for the same canonical folder", () => {
    const rows = projectRows([
      { id: "one", canonical: "/work/repo/" },
      { id: "two", canonical: "/work/repo" },
      { id: "three", canonical: "C:\\Work\\Repo\\" },
      { id: "four", canonical: "c:/work/repo" },
    ])
    expect(rows.map((row) => row.id)).toEqual(["one", "three"])
  })

  it("derives names from a trailing slash and Windows path", () => {
    expect(baseName("/work/alpha/")).toBe("alpha")
    expect(baseName("C:\\work\\alpha")).toBe("alpha")
    expect(baseName("")).toBe("")
  })
})

describe("mergeProject", () => {
  it("adds the routed project when the list has not loaded", () => {
    const rows = mergeProject([{ id: "a", name: "A", root: "/a" }], {
      id: "b",
      name: "B",
      worktree: "/b",
    })
    expect(rows.map((row) => row.id)).toEqual(["a", "b"])
  })

  it("does not duplicate an existing project", () => {
    const rows = [{ id: "a", name: "A", root: "/a" }]
    expect(mergeProject(rows, { id: "a", name: "Renamed", worktree: "/a" })).toEqual(rows)
  })

  it("replaces a duplicate folder with the routed project id", () => {
    const rows = [
      { id: "old", name: "Repo", root: "/work/repo/" },
      { id: "other", name: "Other", root: "/other" },
    ]
    expect(mergeProject(rows, { id: "live", name: "Repo", worktree: "/work/repo" })).toEqual([
      { id: "other", name: "Other", root: "/other" },
      { id: "live", name: "Repo", root: "/work/repo" },
    ])
  })
})

describe("projectForSession", () => {
  it("prefers the mounted project", () => {
    expect(
      projectForSession({
        projectID: "p",
        directory: "/worktree",
        project: { id: "p", name: "Repo", worktree: "/repo" },
      }),
    ).toEqual({ id: "p", name: "Repo", root: "/repo" })
  })

  it("falls back to the session directory", () => {
    expect(projectForSession({ projectID: "p", directory: "/work/repo" })).toEqual({
      id: "p",
      name: "repo",
      root: "/work/repo",
    })
  })

  it("returns nothing without a project", () => {
    expect(projectForSession({ directory: "/tmp" })).toBeUndefined()
  })
})

describe("lookups", () => {
  const rows = [{ id: "a", name: "A", root: "/a" }]
  it("finds names and roots", () => {
    expect(findProject(rows, "a")?.root).toBe("/a")
    expect(findProject(rows, "missing")).toBeUndefined()
    expect(projectName(rows, "a")).toBe("A")
    expect(projectName(rows, "missing", "fallback")).toBe("fallback")
    expect(projectRoot(rows, "a")).toBe("/a")
  })
})
