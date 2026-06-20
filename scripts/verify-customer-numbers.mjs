/** Quick sanity checks for YY-##### customer number allocation. */

const YEAR_BASE = { 2026: 53718, 2027: 61481 }

function yearPrefix(date) {
  return String(date.getFullYear()).slice(-2)
}

function yearBase(year) {
  return YEAR_BASE[year] ?? 48291 + (year % 100) * 137
}

function parseSequence(kundennummer, prefix) {
  const expected = `${prefix}-`
  if (!kundennummer.startsWith(expected)) return null
  const suffix = kundennummer.slice(expected.length)
  if (!/^\d+$/.test(suffix)) return null
  const parsed = Number.parseInt(suffix, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function findMax(existing, prefix) {
  let max = null
  for (const entry of existing) {
    const seq = parseSequence(entry.kundennummer, prefix)
    if (seq === null) continue
    max = max === null ? seq : Math.max(max, seq)
  }
  return max
}

function generate(existing, date = new Date()) {
  const prefix = yearPrefix(date)
  const base = yearBase(date.getFullYear())
  const max = findMax(existing, prefix)
  const next = max === null ? base + 1 : max + 1
  return `${prefix}-${next}`
}

const ref2026 = new Date("2026-06-01T12:00:00.000Z")
const checks = [
  ["year prefix", yearPrefix(ref2026) === "26", yearPrefix(ref2026)],
  [
    "first customer of year",
    generate([], ref2026) === "26-53719",
    generate([], ref2026),
  ],
  [
    "strict +1 increment",
    generate([{ kundennummer: "26-53719" }], ref2026) === "26-53720",
    generate([{ kundennummer: "26-53719" }], ref2026),
  ],
  [
    "legacy numbers ignored",
    generate(
      [{ kundennummer: "KD-2026-0001" }, { kundennummer: "26-53725" }],
      ref2026
    ) === "26-53726",
    generate(
      [{ kundennummer: "KD-2026-0001" }, { kundennummer: "26-53725" }],
      ref2026
    ),
  ],
  [
    "2027 base +1",
    generate([], new Date("2027-01-02T12:00:00.000Z")) === "27-61482",
    generate([], new Date("2027-01-02T12:00:00.000Z")),
  ],
]

let failed = 0
for (const [name, pass, detail] of checks) {
  if (pass) console.log(`OK  ${name}`)
  else {
    failed += 1
    console.error(`FAIL ${name}: ${detail}`)
  }
}

if (failed > 0) process.exit(1)
console.log(`Customer number checks passed (${checks.length}).`)
