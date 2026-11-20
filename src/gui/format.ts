export function formatCost(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return "$0.00"
  if (value < 0.01) return `$${value.toFixed(4)}`
  return `$${value.toFixed(2)}`
}

export function shortID(value: string | undefined): string {
  if (!value) return "—"
  return value.length > 8 ? value.slice(0, 8) : value
}

export function baseName(path: string | undefined): string {
  if (!path) return "—"
  const parts = path.replace(/\\/g, "/").replace(/\/+$/, "").split("/")
  return parts[parts.length - 1] || path
}

export function formatCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/** A compact relative time for cards and details. */
export function timeAgo(then: number | undefined, now = Date.now(), locale = "en"): string {
  if (!then || !Number.isFinite(then)) return ""
  const seconds = Math.round((then - now) / 1000)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 7],
    ["week", 4],
    ["month", 12],
    ["year", Number.POSITIVE_INFINITY],
  ]
  let value = seconds
  for (const [unit, limit] of units) {
    if (Math.abs(value) < limit) {
      return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(value, unit)
    }
    value = Math.round(value / limit)
  }
  return ""
}

export function formatClock(then: number, locale = "en"): string {
  return new Date(then).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false })
}

export function formatDelta(additions: number, deletions: number): string {
  return `+${additions} −${deletions}`
}
