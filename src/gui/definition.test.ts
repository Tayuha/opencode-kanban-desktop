import { describe, expect, it } from "vitest"
import { definition } from "./definition.ts"

describe("definition", () => {
  it("declares the per-project board and preferences stores", () => {
    expect(Object.keys(definition.stores ?? {}).sort()).toEqual(["board", "boards", "prefs"])
  })

  it("ships English copy for every surface", () => {
    const en = definition.i18n?.en ?? {}
    for (const key of ["panel.title", "command.open", "settings.title", "settings.density", "density.compact", "action.compact", "help.key.c", "tags.description.project", "notify.done", "help.title"]) {
      expect(en[key], key).toBeTruthy()
    }
    for (const key of ["task.created", "task.updated"]) {
      expect(en[key], key).not.toContain("{{")
    }
  })

  it("keeps the default copy free of missing placeholders", () => {
    const en = definition.i18n?.en ?? {}
    for (const [key, value] of Object.entries(en)) {
      expect(value.length, key).toBeGreaterThan(0)
    }
  })
})
