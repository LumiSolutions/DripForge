import { createHash, randomUUID } from "crypto"
import { promises as fs } from "fs"
import path from "path"

export const VISITOR_ONLINE_WINDOW_MS = 2 * 60 * 1000

export type VisitorSession = {
  id: string
  /** Anonymisierter Hash der Client-IP (kein Klartext). */
  ipHash: string
  countryCode: string
  regionCode: string
  regionLabel: string
  lastSeenAt: string
  firstSeenAt: string
  path?: string
}

export type VisitorRegionStat = {
  countryCode: string
  regionCode: string
  regionLabel: string
  count: number
}

export type VisitorAnalyticsSnapshot = {
  onlineCount: number
  byRegion: VisitorRegionStat[]
  generatedAt: string
}

const DATA_DIR = path.join(process.cwd(), "data", "admin")
const SESSIONS_FILE = "visitor-sessions.json"

const CH_CANTONS: Record<string, string> = {
  ZH: "Zürich",
  BE: "Bern",
  LU: "Luzern",
  UR: "Uri",
  SZ: "Schwyz",
  OW: "Obwalden",
  NW: "Nidwalden",
  GL: "Glarus",
  ZG: "Zug",
  FR: "Freiburg",
  SO: "Solothurn",
  BS: "Basel-Stadt",
  BL: "Basel-Landschaft",
  SH: "Schaffhausen",
  AR: "Appenzell Ausserrhoden",
  AI: "Appenzell Innerrhoden",
  SG: "St. Gallen",
  GR: "Graubünden",
  AG: "Aargau",
  TG: "Thurgau",
  TI: "Tessin",
  VD: "Waadt",
  VS: "Wallis",
  NE: "Neuenburg",
  GE: "Genf",
  JU: "Jura",
}

const DE_STATES: Record<string, string> = {
  BW: "Baden-Württemberg",
  BY: "Bayern",
  BE: "Berlin",
  BB: "Brandenburg",
  HB: "Bremen",
  HH: "Hamburg",
  HE: "Hessen",
  MV: "Mecklenburg-Vorpommern",
  NI: "Niedersachsen",
  NW: "Nordrhein-Westfalen",
  RP: "Rheinland-Pfalz",
  SL: "Saarland",
  SN: "Sachsen",
  ST: "Sachsen-Anhalt",
  SH: "Schleswig-Holstein",
  TH: "Thüringen",
}

function regionName(country: string, region: string): string {
  const c = country.toUpperCase()
  const r = region.toUpperCase()
  if (!c || c === "XX" || c === "ZZ") return "Unbekannt"
  if (!r) return c
  if (c === "CH" && CH_CANTONS[r]) return `${c} - ${CH_CANTONS[r]}`
  if (c === "DE" && DE_STATES[r]) return `${c} - ${DE_STATES[r]}`
  return `${c} - ${r}`
}

export function anonymizeIp(ip: string): string {
  const salt = process.env.VISITOR_IP_SALT || "dripforge-visitor-salt"
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 24)
}

export function extractClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp
  return "0.0.0.0"
}

export function extractGeoFromHeaders(request: Request): {
  countryCode: string
  regionCode: string
  regionLabel: string
} {
  const country = (
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("cf-ipcountry") ||
    request.headers.get("x-country-code") ||
    ""
  )
    .trim()
    .toUpperCase()

  const region = (
    request.headers.get("x-vercel-ip-country-region") ||
    request.headers.get("x-region-code") ||
    request.headers.get("cf-region") ||
    ""
  )
    .trim()
    .toUpperCase()
    .replace(/^CH-/, "")
    .replace(/^DE-/, "")

  const countryCode = country && country !== "XX" ? country : "UN"
  const regionCode = region || "—"
  return {
    countryCode,
    regionCode,
    regionLabel: regionName(countryCode === "UN" ? "" : countryCode, region),
  }
}

async function readSessions(): Promise<VisitorSession[]> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, SESSIONS_FILE), "utf-8")
    const parsed = JSON.parse(raw) as VisitorSession[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeSessions(sessions: VisitorSession[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(
    path.join(DATA_DIR, SESSIONS_FILE),
    JSON.stringify(sessions, null, 2),
    "utf-8"
  )
}

function pruneStale(sessions: VisitorSession[], nowMs: number): VisitorSession[] {
  const cutoff = nowMs - 24 * 60 * 60 * 1000
  return sessions.filter((s) => new Date(s.lastSeenAt).getTime() >= cutoff)
}

export async function recordVisitorHeartbeat(input: {
  sessionId?: string | null
  request: Request
  path?: string
}): Promise<{ sessionId: string }> {
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const ip = extractClientIp(input.request)
  const ipHash = anonymizeIp(ip)
  const geo = extractGeoFromHeaders(input.request)
  const sessions = pruneStale(await readSessions(), now)

  const existingId = input.sessionId?.trim() || ""
  const index = existingId
    ? sessions.findIndex((s) => s.id === existingId)
    : -1

  if (index >= 0) {
    const current = sessions[index]!
    sessions[index] = {
      ...current,
      ipHash,
      countryCode: geo.countryCode,
      regionCode: geo.regionCode,
      regionLabel: geo.regionLabel,
      lastSeenAt: nowIso,
      path: input.path?.slice(0, 200) || current.path,
    }
    await writeSessions(sessions)
    return { sessionId: current.id }
  }

  const session: VisitorSession = {
    id: existingId || randomUUID(),
    ipHash,
    countryCode: geo.countryCode,
    regionCode: geo.regionCode,
    regionLabel: geo.regionLabel,
    firstSeenAt: nowIso,
    lastSeenAt: nowIso,
    path: input.path?.slice(0, 200),
  }
  sessions.push(session)
  await writeSessions(sessions)
  return { sessionId: session.id }
}

export async function getVisitorAnalyticsSnapshot(): Promise<VisitorAnalyticsSnapshot> {
  const now = Date.now()
  const sessions = pruneStale(await readSessions(), now)
  const online = sessions.filter(
    (s) => now - new Date(s.lastSeenAt).getTime() <= VISITOR_ONLINE_WINDOW_MS
  )

  const regionMap = new Map<string, VisitorRegionStat>()
  for (const session of sessions) {
    const key = `${session.countryCode}|${session.regionCode}|${session.regionLabel}`
    const existing = regionMap.get(key)
    if (existing) {
      existing.count += 1
    } else {
      regionMap.set(key, {
        countryCode: session.countryCode,
        regionCode: session.regionCode,
        regionLabel: session.regionLabel,
        count: 1,
      })
    }
  }

  const byRegion = Array.from(regionMap.values()).sort(
    (a, b) => b.count - a.count || a.regionLabel.localeCompare(b.regionLabel, "de")
  )

  // Persist pruned list occasionally
  await writeSessions(sessions)

  return {
    onlineCount: online.length,
    byRegion,
    generatedAt: new Date().toISOString(),
  }
}
