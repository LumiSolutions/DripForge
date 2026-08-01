import { createHash, randomUUID } from "crypto"
import { promises as fs } from "fs"
import path from "path"

export const VISITOR_ONLINE_WINDOW_MS = 2 * 60 * 1000
const PAGEVIEW_RETENTION_MS = 400 * 24 * 60 * 60 * 1000
const GEO_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

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

export type VisitorPageview = {
  id: string
  sessionId: string
  ipHash: string
  countryCode: string
  regionCode: string
  regionLabel: string
  path?: string
  at: string
}

export type VisitorRegionStat = {
  countryCode: string
  regionCode: string
  regionLabel: string
  count: number
}

export type VisitorTimeBucket = {
  key: string
  label: string
  count: number
}

export type VisitorAnalyticsSnapshot = {
  onlineCount: number
  byRegion: VisitorRegionStat[]
  byCountry: VisitorRegionStat[]
  viewsByDay: VisitorTimeBucket[]
  viewsByMonth: VisitorTimeBucket[]
  viewsByYear: VisitorTimeBucket[]
  heatmapWeekday: VisitorTimeBucket[]
  heatmapHour: VisitorTimeBucket[]
  generatedAt: string
}

type GeoResult = {
  countryCode: string
  regionCode: string
  regionLabel: string
}

type GeoCacheEntry = GeoResult & { cachedAt: string }

const DATA_DIR = path.join(process.cwd(), "data", "admin")
const SESSIONS_FILE = "visitor-sessions.json"
const PAGEVIEWS_FILE = "visitor-pageviews.json"
const GEO_CACHE_FILE = "visitor-geo-cache.json"

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

const WEEKDAY_LABELS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]

function regionName(country: string, region: string, regionNameHint?: string): string {
  const c = country.toUpperCase()
  const r = region.toUpperCase()
  if (!c || c === "XX" || c === "ZZ" || c === "UN") return "Unbekannt"
  if (c === "CH") {
    if (CH_CANTONS[r]) return `${c} - ${CH_CANTONS[r]}`
    if (regionNameHint?.trim()) return `${c} - ${regionNameHint.trim()}`
    if (r && r !== "—") return `${c} - ${r}`
    return c
  }
  if (c === "DE") {
    if (DE_STATES[r]) return `${c} - ${DE_STATES[r]}`
    if (regionNameHint?.trim()) return `${c} - ${regionNameHint.trim()}`
    if (r && r !== "—") return `${c} - ${r}`
    return c
  }
  if (regionNameHint?.trim()) return `${c} - ${regionNameHint.trim()}`
  if (r && r !== "—") return `${c} - ${r}`
  return c
}

export function anonymizeIp(ip: string): string {
  const salt = process.env.VISITOR_IP_SALT || "dripforge-visitor-salt"
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 24)
}

function isPrivateOrLocalIp(ip: string): boolean {
  const value = ip.trim().toLowerCase()
  if (!value || value === "0.0.0.0" || value === "::1" || value === "unknown") {
    return true
  }
  if (value.startsWith("127.") || value.startsWith("10.") || value.startsWith("192.168.")) {
    return true
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(value)) return true
  if (value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:")) {
    return true
  }
  return false
}

export function extractClientIp(request: Request): string {
  const candidates = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("true-client-ip"),
    request.headers.get("x-real-ip"),
    request.headers.get("x-client-ip"),
    request.headers.get("x-azure-clientip"),
    request.headers.get("x-appgateway-client-ip"),
    request.headers.get("x-forwarded-for")?.split(",")[0],
  ]
  for (const candidate of candidates) {
    const ip = candidate?.trim()
    if (ip) return ip.replace(/^::ffff:/, "")
  }
  return "0.0.0.0"
}

export function extractGeoFromHeaders(request: Request): GeoResult | null {
  const country = (
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("cf-ipcountry") ||
    request.headers.get("x-country-code") ||
    request.headers.get("cloudfront-viewer-country") ||
    ""
  )
    .trim()
    .toUpperCase()

  if (!country || country === "XX" || country === "ZZ") return null

  const regionRaw = (
    request.headers.get("x-vercel-ip-country-region") ||
    request.headers.get("x-region-code") ||
    request.headers.get("cf-region") ||
    request.headers.get("cloudfront-viewer-country-region") ||
    ""
  )
    .trim()
    .toUpperCase()
    .replace(/^CH-/, "")
    .replace(/^DE-/, "")

  const regionNameHint =
    request.headers.get("x-vercel-ip-city") ||
    request.headers.get("cf-region") ||
    undefined

  return {
    countryCode: country,
    regionCode: regionRaw || "—",
    regionLabel: regionName(country, regionRaw, regionNameHint ?? undefined),
  }
}

async function readJsonFile<T>(fileName: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, fileName), "utf-8")
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

async function writeJsonFile(fileName: string, data: unknown): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(
    path.join(DATA_DIR, fileName),
    JSON.stringify(data, null, 2),
    "utf-8"
  )
}

async function lookupGeoByIp(ip: string): Promise<GeoResult | null> {
  if (isPrivateOrLocalIp(ip)) return null
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2500)
    const res = await fetch(
      `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country_code,region,region_code,city`,
      { signal: controller.signal, cache: "no-store" }
    )
    clearTimeout(timer)
    if (!res.ok) return null
    const data = (await res.json()) as {
      success?: boolean
      country_code?: string
      region?: string
      region_code?: string
      city?: string
    }
    if (!data.success || !data.country_code) return null
    const country = data.country_code.toUpperCase()
    const regionCode = (data.region_code || "").toUpperCase().replace(/^CH-/, "").replace(/^DE-/, "")
    const hint = data.region || data.city || undefined
    return {
      countryCode: country,
      regionCode: regionCode || "—",
      regionLabel: regionName(country, regionCode, hint),
    }
  } catch {
    return null
  }
}

async function resolveGeo(request: Request, ip: string, ipHash: string): Promise<GeoResult> {
  const fromHeaders = extractGeoFromHeaders(request)
  if (fromHeaders) return fromHeaders

  const cache = await readJsonFile<Record<string, GeoCacheEntry>>(GEO_CACHE_FILE, {})
  const cached = cache[ipHash]
  if (cached) {
    const age = Date.now() - new Date(cached.cachedAt).getTime()
    if (age <= GEO_CACHE_TTL_MS) {
      return {
        countryCode: cached.countryCode,
        regionCode: cached.regionCode,
        regionLabel: cached.regionLabel,
      }
    }
  }

  const lookedUp = await lookupGeoByIp(ip)
  if (lookedUp) {
    cache[ipHash] = { ...lookedUp, cachedAt: new Date().toISOString() }
    await writeJsonFile(GEO_CACHE_FILE, cache)
    return lookedUp
  }

  return {
    countryCode: "UN",
    regionCode: "—",
    regionLabel: "Unbekannt",
  }
}

function pruneSessions(sessions: VisitorSession[], nowMs: number): VisitorSession[] {
  const cutoff = nowMs - 24 * 60 * 60 * 1000
  return sessions.filter((s) => new Date(s.lastSeenAt).getTime() >= cutoff)
}

function prunePageviews(views: VisitorPageview[], nowMs: number): VisitorPageview[] {
  const cutoff = nowMs - PAGEVIEW_RETENTION_MS
  return views.filter((v) => new Date(v.at).getTime() >= cutoff)
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
  const geo = await resolveGeo(input.request, ip, ipHash)
  const sessions = pruneSessions(
    await readJsonFile<VisitorSession[]>(SESSIONS_FILE, []),
    now
  )
  const pageviews = prunePageviews(
    await readJsonFile<VisitorPageview[]>(PAGEVIEWS_FILE, []),
    now
  )

  const existingId = input.sessionId?.trim() || ""
  const index = existingId
    ? sessions.findIndex((s) => s.id === existingId)
    : -1

  let sessionId = existingId || randomUUID()
  const pathValue = input.path?.slice(0, 200)

  if (index >= 0) {
    const current = sessions[index]!
    sessionId = current.id
    const lastAt = new Date(current.lastSeenAt).getTime()
    sessions[index] = {
      ...current,
      ipHash,
      countryCode: geo.countryCode,
      regionCode: geo.regionCode,
      regionLabel: geo.regionLabel,
      lastSeenAt: nowIso,
      path: pathValue || current.path,
    }
    // Neuer Pageview nur bei Pfadwechsel oder nach >2 Minuten
    const pathChanged = Boolean(pathValue && pathValue !== current.path)
    if (pathChanged || now - lastAt > VISITOR_ONLINE_WINDOW_MS) {
      pageviews.push({
        id: randomUUID(),
        sessionId,
        ipHash,
        countryCode: geo.countryCode,
        regionCode: geo.regionCode,
        regionLabel: geo.regionLabel,
        path: pathValue || current.path,
        at: nowIso,
      })
    }
  } else {
    sessions.push({
      id: sessionId,
      ipHash,
      countryCode: geo.countryCode,
      regionCode: geo.regionCode,
      regionLabel: geo.regionLabel,
      firstSeenAt: nowIso,
      lastSeenAt: nowIso,
      path: pathValue,
    })
    pageviews.push({
      id: randomUUID(),
      sessionId,
      ipHash,
      countryCode: geo.countryCode,
      regionCode: geo.regionCode,
      regionLabel: geo.regionLabel,
      path: pathValue,
      at: nowIso,
    })
  }

  await writeJsonFile(SESSIONS_FILE, sessions)
  await writeJsonFile(PAGEVIEWS_FILE, pageviews)
  return { sessionId }
}

function bucketCounts(
  views: VisitorPageview[],
  keyFn: (date: Date) => string,
  labelFn: (key: string) => string
): VisitorTimeBucket[] {
  const map = new Map<string, number>()
  for (const view of views) {
    const date = new Date(view.at)
    if (Number.isNaN(date.getTime())) continue
    const key = keyFn(date)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => ({ key, label: labelFn(key), count }))
}

export async function getVisitorAnalyticsSnapshot(): Promise<VisitorAnalyticsSnapshot> {
  const now = Date.now()
  const sessions = pruneSessions(
    await readJsonFile<VisitorSession[]>(SESSIONS_FILE, []),
    now
  )
  const pageviews = prunePageviews(
    await readJsonFile<VisitorPageview[]>(PAGEVIEWS_FILE, []),
    now
  )

  const online = sessions.filter(
    (s) => now - new Date(s.lastSeenAt).getTime() <= VISITOR_ONLINE_WINDOW_MS
  )

  const regionMap = new Map<string, VisitorRegionStat>()
  const countryMap = new Map<string, VisitorRegionStat>()
  for (const view of pageviews) {
    const regionKey = `${view.countryCode}|${view.regionCode}|${view.regionLabel}`
    const regionExisting = regionMap.get(regionKey)
    if (regionExisting) regionExisting.count += 1
    else {
      regionMap.set(regionKey, {
        countryCode: view.countryCode,
        regionCode: view.regionCode,
        regionLabel: view.regionLabel,
        count: 1,
      })
    }

    const countryLabel =
      view.countryCode === "UN" ? "Unbekannt" : view.countryCode
    const countryExisting = countryMap.get(view.countryCode)
    if (countryExisting) countryExisting.count += 1
    else {
      countryMap.set(view.countryCode, {
        countryCode: view.countryCode,
        regionCode: "—",
        regionLabel: countryLabel,
        count: 1,
      })
    }
  }

  const byRegion = Array.from(regionMap.values()).sort(
    (a, b) => b.count - a.count || a.regionLabel.localeCompare(b.regionLabel, "de")
  )
  const byCountry = Array.from(countryMap.values()).sort(
    (a, b) => b.count - a.count || a.regionLabel.localeCompare(b.regionLabel, "de")
  )

  const viewsByDay = bucketCounts(
    pageviews,
    (d) => d.toISOString().slice(0, 10),
    (key) => {
      const [y, m, day] = key.split("-").map(Number)
      return new Intl.DateTimeFormat("de-CH", {
        day: "2-digit",
        month: "short",
      }).format(new Date(y!, m! - 1, day))
    }
  ).slice(-60)

  const viewsByMonth = bucketCounts(
    pageviews,
    (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
    (key) => {
      const [y, m] = key.split("-").map(Number)
      return new Intl.DateTimeFormat("de-CH", {
        month: "short",
        year: "numeric",
      }).format(new Date(y!, m! - 1, 1))
    }
  )

  const viewsByYear = bucketCounts(
    pageviews,
    (d) => String(d.getUTCFullYear()),
    (key) => key
  )

  const weekdayCounts = Array.from({ length: 7 }, (_, i) => ({
    key: String(i),
    label: WEEKDAY_LABELS[i]!,
    count: 0,
  }))
  const hourCounts = Array.from({ length: 24 }, (_, i) => ({
    key: String(i),
    label: `${String(i).padStart(2, "0")}:00`,
    count: 0,
  }))
  for (const view of pageviews) {
    const date = new Date(view.at)
    if (Number.isNaN(date.getTime())) continue
    weekdayCounts[date.getDay()]!.count += 1
    hourCounts[date.getHours()]!.count += 1
  }

  await writeJsonFile(SESSIONS_FILE, sessions)
  await writeJsonFile(PAGEVIEWS_FILE, pageviews)

  return {
    onlineCount: online.length,
    byRegion,
    byCountry,
    viewsByDay,
    viewsByMonth,
    viewsByYear,
    heatmapWeekday: weekdayCounts,
    heatmapHour: hourCounts,
    generatedAt: new Date().toISOString(),
  }
}
