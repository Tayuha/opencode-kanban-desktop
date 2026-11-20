import { describe, expect, it } from "vitest"
import { baseName, formatClock, formatCost, formatCount, formatDelta, shortID, timeAgo } from "./format.ts"

describe("formatCost", () => {
  it("shows two decimals, more for sub-cent values, and a zero fallback", () => {
    expect(formatCost(1.234)).toBe("$1.23")
    expect(formatCost(0.004)).toBe("$0.0040")
    expect(formatCost(0)).toBe("$0.00")
    expect(formatCost(undefined)).toBe("$0.00")
    expect(formatCost(Number.NaN)).toBe("$0.00")
  })
})

describe("shortID", () => {
  it("truncates long ids and handles missing values", () => {
    expect(shortID("ses_1234567890")).toBe("ses_1234")
    expect(shortID("abc")).toBe("abc")
    expect(shortID(undefined)).toBe("—")
  })
})

describe("baseName", () => {
  it("reads the last path segment", () => {
    expect(baseName("/work/alpha/")).toBe("alpha")
    expect(baseName("C:\\work\\alpha")).toBe("alpha")
    expect(baseName(undefined)).toBe("—")
  })
})

describe("formatCount", () => {
  it("pluralizes", () => {
    expect(formatCount(1, "task", "tasks")).toBe("1 task")
    expect(formatCount(2, "task", "tasks")).toBe("2 tasks")
  })
})

describe("timeAgo", () => {
  const now = Date.UTC(2026, 0, 1, 12, 0, 0)
  it("formats relative times", () => {
    expect(timeAgo(now - 30_000, now, "en")).toBe("30 seconds ago")
    expect(timeAgo(now - 5 * 60_000, now, "en")).toBe("5 minutes ago")
    expect(timeAgo(now - 3 * 3_600_000, now, "en")).toBe("3 hours ago")
  })

  it("handles missing values", () => {
    expect(timeAgo(undefined)).toBe("")
    expect(timeAgo(Number.NaN)).toBe("")
  })
})

describe("formatClock and formatDelta", () => {
  it("renders a fixed clock and a diff summary", () => {
    expect(formatClock(Date.UTC(2026, 0, 1, 9, 5), "en-GB")).toMatch(/^\d{2}:\d{2}$/)
    expect(formatDelta(3, 1)).toBe("+3 −1")
  })
})
