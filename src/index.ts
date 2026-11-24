import { Plugin } from "@opencode/plugin"
import { KanbanBoard } from "./rpc.ts"
import { readBoardFile, writeBoardFile } from "./server/board-file.ts"

/**
 * The board itself lives in the Desktop GUI's plugin storage. The server part
 * exposes load and save RPCs so the GUI can reload a board snapshot from, or
 * export it to, `<project>/kanban-board.json` without restarting Desktop.
 */
export default Plugin.define({
  id: "nmdra.kanban-desktop",
  async setup(ctx) {
    await ctx.rpc.register(KanbanBoard, {
      load: async (input, context) => {
        const directory = (input as { directory?: unknown }).directory
        if (typeof directory !== "string" || !directory) {
          return context.error("invalid", "A project directory is required.", {
            path: "",
            message: "A project directory is required.",
          })
        }

        const result = await readBoardFile(directory, context.signal)
        if (result.ok) return { path: result.path, json: result.json }

        if (result.code === "not_found") {
          return context.error("not_found", result.message, { path: result.path })
        }
        if (result.code === "invalid") {
          return context.error("invalid", result.message, {
            path: result.path,
            message: result.message,
          })
        }
        return context.error("unreadable", result.message, {
          path: result.path,
          message: result.message,
        })
      },

      save: async (input, context) => {
        const { directory, json, target } = input as {
          directory?: unknown
          json?: unknown
          target?: unknown
        }
        if (typeof directory !== "string" || !directory || typeof json !== "string") {
          return context.error("invalid", "A project directory and JSON are required.", {
            path: typeof directory === "string" ? directory : "",
            message: "A project directory and JSON are required.",
          })
        }
        if (target !== undefined && target !== "board" && target !== "backup") {
          return context.error("invalid", "Unknown board file target.", {
            path: directory,
            message: "Unknown board file target.",
          })
        }

        const result = await writeBoardFile(directory, json, target, context.signal)
        if (result.ok) return result.backupPath ? { path: result.path, backupPath: result.backupPath } : { path: result.path }
        return context.error(result.code, result.message, {
          path: result.path,
          message: result.message,
        })
      },
    })
  },
})
