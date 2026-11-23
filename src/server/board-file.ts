import { copyFile, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import { isAbsolute, join } from "node:path"

export const BOARD_FILE = "kanban-board.json"
export const BOARD_BACKUP = "kanban-board.backup.json"
export const BOARD_FILE_BAK = "kanban-board.json.bak"
export const MAX_BOARD_BYTES = 5_000_000

export type BoardTarget = "board" | "backup"

export type BoardFileResult =
  | { ok: true; path: string; json: string }
  | { ok: false; code: "not_found" | "invalid" | "unreadable"; path: string; message: string }

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Reads a board snapshot from `<directory>/kanban-board.json`, with a small size cap. */
export async function readBoardFile(
  directory: string,
  signal?: AbortSignal,
): Promise<BoardFileResult> {
  if (!directory || !isAbsolute(directory)) {
    return {
      ok: false,
      code: "invalid",
      path: directory ?? "",
      message: "The project directory must be an absolute path.",
    }
  }

  const path = join(directory, BOARD_FILE)
  if (signal?.aborted) return { ok: false, code: "unreadable", path, message: "Cancelled." }

  let info
  try {
    info = await stat(path)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return {
      ok: false,
      code: code === "ENOENT" ? "not_found" : "unreadable",
      path,
      message: messageOf(error),
    }
  }

  if (!info.isFile()) {
    return { ok: false, code: "not_found", path, message: "kanban-board.json is not a file." }
  }
  if (info.size > MAX_BOARD_BYTES) {
    return {
      ok: false,
      code: "invalid",
      path,
      message: `kanban-board.json is larger than ${MAX_BOARD_BYTES} bytes.`,
    }
  }

  let json: string
  try {
    json = await readFile(path, "utf8")
  } catch (error) {
    return { ok: false, code: "unreadable", path, message: messageOf(error) }
  }

  if (signal?.aborted) return { ok: false, code: "unreadable", path, message: "Cancelled." }
  if (Buffer.byteLength(json, "utf8") > MAX_BOARD_BYTES) {
    return { ok: false, code: "invalid", path, message: "kanban-board.json is too large." }
  }

  try {
    JSON.parse(json)
  } catch (error) {
    return { ok: false, code: "invalid", path, message: `Invalid JSON: ${messageOf(error)}` }
  }

  return { ok: true, path, json }
}


export type BoardWriteResult =
  | { ok: true; path: string; backupPath?: string }
  | { ok: false; code: "invalid" | "write_failed"; path: string; message: string }

export type BoardRemoveResult =
  | { ok: true; paths: string[] }
  | { ok: false; code: "invalid" | "remove_failed"; paths: string[]; message: string }

function targetPath(directory: string, target: BoardTarget): string {
  return join(directory, target === "backup" ? BOARD_BACKUP : BOARD_FILE)
}

/** Writes a board snapshot atomically and keeps the previous board file as `.bak`. */
export async function writeBoardFile(
  directory: string,
  json: string,
  target: BoardTarget = "board",
  signal?: AbortSignal,
): Promise<BoardWriteResult> {
  if (!directory || !isAbsolute(directory)) {
    return {
      ok: false,
      code: "invalid",
      path: directory ?? "",
      message: "The project directory must be an absolute path.",
    }
  }

  const path = targetPath(directory, target)
  if (signal?.aborted) return { ok: false, code: "write_failed", path, message: "Cancelled." }

  const directoryInfo = await stat(directory).catch(() => undefined)
  if (!directoryInfo?.isDirectory()) {
    return { ok: false, code: "invalid", path, message: "The project directory does not exist." }
  }

  if (Buffer.byteLength(json, "utf8") > MAX_BOARD_BYTES) {
    return { ok: false, code: "invalid", path, message: "kanban-board.json is too large." }
  }

  try {
    JSON.parse(json)
  } catch (error) {
    return { ok: false, code: "invalid", path, message: `Invalid JSON: ${messageOf(error)}` }
  }

  if (signal?.aborted) return { ok: false, code: "write_failed", path, message: "Cancelled." }

  let backupPath: string | undefined
  if (target === "board") {
    const existing = await stat(path).catch(() => undefined)
    if (existing?.isFile()) {
      backupPath = join(directory, BOARD_FILE_BAK)
      try {
        await copyFile(path, backupPath)
      } catch (error) {
        return {
          ok: false,
          code: "write_failed",
          path,
          message: `Could not keep the previous board file: ${messageOf(error)}`,
        }
      }
    }
  }

  const temporary = `${path}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`
  try {
    await writeFile(temporary, json, "utf8")
    await rename(temporary, path)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined)
    return { ok: false, code: "write_failed", path, message: messageOf(error) }
  }

  return { ok: true, path, backupPath }
}

/**
 * Removes only this plugin's three fixed snapshot files from a directory.
 * Used after the user changes or resets a project's board folder and confirms cleanup.
 */
export async function removeBoardFiles(
  directory: string,
  signal?: AbortSignal,
): Promise<BoardRemoveResult> {
  if (!directory || !isAbsolute(directory)) {
    return {
      ok: false,
      code: "invalid",
      paths: [],
      message: "The board directory must be an absolute path.",
    }
  }

  const paths = [BOARD_FILE, BOARD_FILE_BAK, BOARD_BACKUP].map((name) => join(directory, name))
  if (signal?.aborted) {
    return { ok: false, code: "remove_failed", paths, message: "Cancelled." }
  }

  try {
    for (const path of paths) {
      await rm(path, { force: true })
    }
    return { ok: true, paths }
  } catch (error) {
    return { ok: false, code: "remove_failed", paths, message: messageOf(error) }
  }
}
