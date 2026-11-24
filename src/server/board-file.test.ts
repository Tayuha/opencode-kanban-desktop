import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  BOARD_BACKUP,
  BOARD_FILE,
  BOARD_FILE_BAK,
  MAX_BOARD_BYTES,
  readBoardFile,
  writeBoardFile,
} from "./board-file.ts"

const directories: string[] = []

async function directory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "kanban-board-file-"))
  directories.push(path)
  return path
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe("readBoardFile", () => {
  it("reads a valid board file", async () => {
    const path = await directory()
    await writeFile(join(path, BOARD_FILE), '{"version":1,"categories":[],"tasks":[]}')
    const result = await readBoardFile(path)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.path).toBe(join(path, BOARD_FILE))
      expect(JSON.parse(result.json).version).toBe(1)
    }
  })

  it("reports a missing file", async () => {
    const path = await directory()
    const result = await readBoardFile(path)
    expect(result).toMatchObject({ ok: false, code: "not_found" })
  })

  it("reports invalid JSON", async () => {
    const path = await directory()
    await writeFile(join(path, BOARD_FILE), "{not json")
    const result = await readBoardFile(path)
    expect(result).toMatchObject({ ok: false, code: "invalid" })
  })

  it("rejects a relative directory", async () => {
    const result = await readBoardFile("relative/project")
    expect(result).toMatchObject({ ok: false, code: "invalid" })
  })

  it("rejects an oversized file", async () => {
    const path = await directory()
    await writeFile(join(path, BOARD_FILE), "x".repeat(MAX_BOARD_BYTES + 1))
    const result = await readBoardFile(path)
    expect(result).toMatchObject({ ok: false, code: "invalid" })
  })

  it("honours an aborted signal", async () => {
    const path = await directory()
    await writeFile(join(path, BOARD_FILE), "{}")
    const controller = new AbortController()
    controller.abort()
    const result = await readBoardFile(path, controller.signal)
    expect(result).toMatchObject({ ok: false, code: "unreadable" })
  })
})


describe("writeBoardFile", () => {
  it("writes the board and keeps the previous file as .bak", async () => {
    const path = await directory()
    const first = JSON.stringify({ version: 1, tags: [], categories: [], tasks: [] })
    const second = JSON.stringify({ version: 1, tags: [], categories: [], tasks: [{ id: "t" }] })

    const created = await writeBoardFile(path, first)
    expect(created).toMatchObject({ ok: true })
    expect(await readFile(join(path, BOARD_FILE), "utf8")).toBe(first)

    const replaced = await writeBoardFile(path, second)
    expect(replaced).toMatchObject({ ok: true })
    expect(await readFile(join(path, BOARD_FILE), "utf8")).toBe(second)
    expect(await readFile(join(path, BOARD_FILE_BAK), "utf8")).toBe(first)
  })

  it("writes a separate pre-reload backup without touching the board", async () => {
    const path = await directory()
    const board = JSON.stringify({ version: 1, tags: [], categories: [], tasks: [] })
    const backup = JSON.stringify({ version: 1, tags: [], categories: [], tasks: [{ id: "live" }] })
    await writeBoardFile(path, board)

    const result = await writeBoardFile(path, backup, "backup")
    expect(result).toMatchObject({ ok: true })
    expect(await readFile(join(path, BOARD_FILE), "utf8")).toBe(board)
    expect(await readFile(join(path, BOARD_BACKUP), "utf8")).toBe(backup)
    if (result.ok) expect(result.backupPath).toBeUndefined()
  })

  it("rejects invalid JSON, relative paths, oversized content, and aborts", async () => {
    const path = await directory()
    expect(await writeBoardFile(path, "{bad")).toMatchObject({ ok: false, code: "invalid" })
    expect(await writeBoardFile("relative", "{}")).toMatchObject({ ok: false, code: "invalid" })
    expect(await writeBoardFile(path, "x".repeat(MAX_BOARD_BYTES + 1))).toMatchObject({
      ok: false,
      code: "invalid",
    })
    const controller = new AbortController()
    controller.abort()
    expect(await writeBoardFile(path, "{}", "board", controller.signal)).toMatchObject({
      ok: false,
      code: "write_failed",
    })
  })
})
