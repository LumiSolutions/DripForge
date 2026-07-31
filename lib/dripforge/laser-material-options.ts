import { laserMaterials } from "@/lib/dripforge/data"
import type { LaserMaterial, LaserMaterialId } from "@/lib/dripforge/types"

export const CORE_LASER_MATERIAL_IDS = [
  "wood",
  "acrylic",
  "stone",
  "leather",
  "edelstahl",
] as const

export type CoreLaserMaterialId = (typeof CORE_LASER_MATERIAL_IDS)[number]

export function isCoreLaserMaterialId(id: string): id is CoreLaserMaterialId {
  return (CORE_LASER_MATERIAL_IDS as readonly string[]).includes(id)
}

/** Slug für freie Lager-Materialnamen → laserMaterialId */
export function slugifyLaserMaterialId(name: string): string {
  const cleaned = String(name ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return cleaned || "custom"
}

/** Bekannte Kern-IDs aus Freitext (Produktname, Lagermaterial, Slug). */
export function matchCoreLaserMaterialId(
  raw: string
): CoreLaserMaterialId | null {
  const s = String(raw ?? "").toLowerCase()
  if (!s.trim()) return null
  if (/edelstahl|stainless|inox|\bstahl\b|\bmetal\b|\bmetall\b/.test(s)) {
    return "edelstahl"
  }
  if (/acryl|acrylic|plexiglas|pmma/.test(s)) return "acrylic"
  if (/leder|leather|wildleder/.test(s)) return "leather"
  if (/schiefer|stein|slate|stone|marmor|granit/.test(s)) return "stone"
  if (/holz|wood|bambus|mdf|sperrholz|kork/.test(s)) return "wood"
  if (isCoreLaserMaterialId(s.trim())) return s.trim() as CoreLaserMaterialId
  return null
}

function humanizeLaserMaterialSlug(id: string): string {
  return id
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

/** Ableitung der Shop-Material-ID aus Lagermaterial-Stammdaten. */
export function resolveLaserMaterialIdFromStockItem(item: {
  name?: string | null
  materialType?: string | null
  typ?: string | null
  farbe?: string | null
  category?: string | null
}): LaserMaterialId | null {
  const hint = [item.materialType, item.typ, item.name, item.farbe]
    .filter(Boolean)
    .join(" ")
  const core = matchCoreLaserMaterialId(hint)
  if (core) return core
  if (item.category && item.category !== "lasermaterial") return null
  const slugSource = item.materialType?.trim() || item.name?.trim()
  if (!slugSource) return null
  return slugifyLaserMaterialId(slugSource)
}

/** Katalog + dynamische Lagermaterialien → Admin-Dropdown. */
export function buildLaserMaterialSelectOptions(
  stockMaterials: Array<{
    id: string
    name: string
    category: string
    dicke?: string | null
    materialType?: string | null
    typ?: string | null
  }>
): Array<{ value: LaserMaterialId; label: string }> {
  const options: Array<{ value: LaserMaterialId; label: string }> =
    laserMaterials.map((m) => ({ value: m.id, label: m.name }))
  const seen = new Set(options.map((o) => o.value))

  for (const item of stockMaterials) {
    if (item.category !== "lasermaterial") continue
    const name = item.name?.trim()
    if (!name) continue

    const artHint = [item.materialType, item.typ, name]
      .filter(Boolean)
      .join(" ")
    const core = matchCoreLaserMaterialId(artHint)
    if (core) {
      // Kernmaterial bereits im Katalog — Label ggf. mit Dicke ergänzen nicht nötig
      continue
    }

    const value = slugifyLaserMaterialId(item.materialType?.trim() || name)
    if (seen.has(value)) continue
    seen.add(value)
    const dicke = item.dicke?.trim()
    const labelBase = item.materialType?.trim()
      ? `${name} · ${item.materialType.trim()}`
      : name
    options.push({
      value,
      label: dicke ? `${labelBase} (${dicke})` : labelBase,
    })
  }

  return options
}

export function resolveLaserMaterialById(id: string): LaserMaterial {
  const trimmed = String(id ?? "").trim()
  if (!trimmed) {
    return laserMaterials[0]
  }

  const known = laserMaterials.find((m) => m.id === trimmed)
  if (known) return known

  const core = matchCoreLaserMaterialId(trimmed)
  if (core) {
    return laserMaterials.find((m) => m.id === core) ?? laserMaterials[0]
  }

  const name = humanizeLaserMaterialSlug(trimmed)
  return {
    id: trimmed,
    name,
    icon: "✨",
    iconBg: "bg-zinc-500/20",
    iconColor: "text-zinc-300",
    description: `Lasermaterial «${name}» aus dem Rohmaterial-Lager. Gravur und Bearbeitung nach Materialeigenschaften.`,
    types: [name],
    canEngrave: true,
    canCut: false,
    maxThickness: null,
    applications: [
      "Individuelle Gravur",
      "Beschilderung",
      "Geschenke",
      "Dekoration",
    ],
  }
}
