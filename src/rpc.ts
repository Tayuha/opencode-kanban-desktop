import { Rpc } from "@opencode/plugin/rpc"

/**
 * The GUI reads a project's `kanban-board.json` and can write a current snapshot
 * back. Writes are limited to fixed filenames under the project root.
 */
export const KanbanBoard = Rpc.define({
  id: "nmdra.kanban-desktop.board",
  methods: {
    load: {
      input: {
        type: "object",
        properties: {
          directory: { type: "string" },
        },
        required: ["directory"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          path: { type: "string" },
          json: { type: "string" },
        },
        required: ["path", "json"],
        additionalProperties: false,
      },
      errors: {
        not_found: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
          additionalProperties: false,
        },
        invalid: {
          type: "object",
          properties: {
            path: { type: "string" },
            message: { type: "string" },
          },
          required: ["path", "message"],
          additionalProperties: false,
        },
        unreadable: {
          type: "object",
          properties: {
            path: { type: "string" },
            message: { type: "string" },
          },
          required: ["path", "message"],
          additionalProperties: false,
        },
      },
    },
    save: {
      input: {
        type: "object",
        properties: {
          directory: { type: "string" },
          json: { type: "string" },
          target: { type: "string", enum: ["board", "backup"] },
        },
        required: ["directory", "json"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          path: { type: "string" },
          backupPath: { type: "string" },
        },
        required: ["path"],
        additionalProperties: false,
      },
      errors: {
        invalid: {
          type: "object",
          properties: {
            path: { type: "string" },
            message: { type: "string" },
          },
          required: ["path", "message"],
          additionalProperties: false,
        },
        write_failed: {
          type: "object",
          properties: {
            path: { type: "string" },
            message: { type: "string" },
          },
          required: ["path", "message"],
          additionalProperties: false,
        },
      },
    },
    remove: {
      input: {
        type: "object",
        properties: {
          directory: { type: "string" },
        },
        required: ["directory"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          paths: { type: "array", items: { type: "string" } },
        },
        required: ["paths"],
        additionalProperties: false,
      },
      errors: {
        invalid: {
          type: "object",
          properties: { message: { type: "string" } },
          required: ["message"],
          additionalProperties: false,
        },
        remove_failed: {
          type: "object",
          properties: { message: { type: "string" } },
          required: ["message"],
          additionalProperties: false,
        },
      },
    },
  },
  events: {},
})
