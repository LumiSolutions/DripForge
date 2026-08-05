import { LEGAL_SITE_TEXT_DEFAULTS } from "@/lib/admin/legal-site-text-defaults"
import type { SiteTexts } from "@/lib/admin/site-texts"

export type CmsFaqItem = {
  id: string
  question: string
  answer: string
  sortOrder: number
  /** Optionale Kategorie (z. B. «3D-Druck & Dateivorgaben»). */
  category?: string
}

export const FAQ_CATEGORY_GENERAL = "Allgemein"
export const FAQ_CATEGORY_3D_PRINT =
  "3D-Druck & Dateivorgaben"

const DEFAULT_FAQ_COUNT = 10

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function defaultQuestion(index: number): string {
  const key = `faq_q${index}_question` as keyof typeof LEGAL_SITE_TEXT_DEFAULTS
  return LEGAL_SITE_TEXT_DEFAULTS[key] ?? `Frage ${index}`
}

function defaultAnswer(index: number): string {
  const key = `faq_q${index}_answer` as keyof typeof LEGAL_SITE_TEXT_DEFAULTS
  return LEGAL_SITE_TEXT_DEFAULTS[key] ?? ""
}

/** Statische Default-FAQs zur 3D-Druck-Machbarkeit. */
export function getDefault3dPrintFaqItems(startOrder = 100): CmsFaqItem[] {
  const items: Array<{ question: string; answer: string }> = [
    {
      question: "Welche 3D-Modelle sind gut druckbar?",
      answer:
        "Gut geeignet sind volumenechte, geschlossene Körper (watertight Solid Mesh) wie Gehäuse, Ersatzteile, Halterungen und Abdeckungen. Wichtig sind ausreichende Wandstärken (mind. 1,5–2,0 mm) und eine flache Grundfläche für stabile Druckbett-Haftung.",
    },
    {
      question: "Welche Mindestwandstärke braucht mein Modell?",
      answer:
        "Wir empfehlen mindestens 1,5 mm, besser 2,0 mm Wandstärke. Extrem dünne, papierähnliche Flächen oder frei schwebende Linien unter 1 mm sind nicht oder nur eingeschränkt druckbar.",
    },
    {
      question: "Was passiert, wenn mein Upload zu komplex oder fehlerhaft ist?",
      answer:
        "Jedes Modell wird vor dem Produktionsstart manuell geprüft. Bei fehlerhaften Geometrien oder zu komplexen Details stornieren wir nicht einfach — wir kontaktieren dich persönlich und bieten eine kostenlose Vereinfachung oder eine Anpassung gegen eine kleine Aufwandspauschale an.",
    },
    {
      question: "Welche Dateiformate kann ich hochladen?",
      answer:
        "Im 3D-Konfigurator akzeptieren wir STL, OBJ, GLB und GLTF (mit Live-Vorschau) sowie 3MF (max. 50 MB). Für die beste Prüfbarkeit empfehlen wir geschlossene STL-/OBJ-Meshes.",
    },
  ]

  return items.map((item, index) => ({
    id: `faq-3d-${index + 1}`,
    question: item.question,
    answer: item.answer,
    sortOrder: startOrder + index,
    category: FAQ_CATEGORY_3D_PRINT,
  }))
}

export function getDefaultCmsFaqItems(): CmsFaqItem[] {
  const general = Array.from({ length: DEFAULT_FAQ_COUNT }, (_, i) => {
    const index = i + 1
    return {
      id: `faq-${index}`,
      question: defaultQuestion(index),
      answer: defaultAnswer(index),
      sortOrder: i,
      category: FAQ_CATEGORY_GENERAL,
    }
  })
  return [...general, ...getDefault3dPrintFaqItems(general.length)]
}

/** Migriert ältere Text-Keys `faq_qN_*` in strukturierte FAQ-Einträge. */
export function faqItemsFromSiteTexts(
  texts: Partial<Record<string, string>> | SiteTexts | null | undefined
): CmsFaqItem[] {
  if (!texts) return getDefaultCmsFaqItems()
  const map = texts as Partial<Record<string, string>>
  const items: CmsFaqItem[] = []
  for (let index = 1; index <= 40; index += 1) {
    const question = map[`faq_q${index}_question`]
    const answer = map[`faq_q${index}_answer`]
    if (typeof question !== "string" && typeof answer !== "string") continue
    items.push({
      id: `faq-${index}`,
      question:
        typeof question === "string" && question.trim()
          ? question
          : defaultQuestion(index),
      answer: typeof answer === "string" ? answer : defaultAnswer(index),
      sortOrder: items.length,
      category: FAQ_CATEGORY_GENERAL,
    })
  }
  if (items.length === 0) return getDefaultCmsFaqItems()
  // 3D-Kategorie ergänzen, falls noch nicht vorhanden
  const has3d = items.some((item) => item.category === FAQ_CATEGORY_3D_PRINT)
  if (!has3d) {
    items.push(...getDefault3dPrintFaqItems(items.length))
  }
  return items
}

function sanitizeFaqItem(raw: unknown, index: number): CmsFaqItem | null {
  if (!isRecord(raw)) return null
  const id =
    typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `faq-${index + 1}`
  const question =
    typeof raw.question === "string" ? raw.question : `Frage ${index + 1}`
  const answer = typeof raw.answer === "string" ? raw.answer : ""
  const sortOrder =
    typeof raw.sortOrder === "number" && Number.isFinite(raw.sortOrder)
      ? raw.sortOrder
      : index
  const category =
    typeof raw.category === "string" && raw.category.trim()
      ? raw.category.trim().slice(0, 80)
      : FAQ_CATEGORY_GENERAL
  return { id, question, answer, sortOrder, category }
}

export function sanitizeCmsFaqItemsInput(input: unknown): CmsFaqItem[] {
  if (!Array.isArray(input)) return getDefaultCmsFaqItems()
  const items = input
    .map((item, index) => sanitizeFaqItem(item, index))
    .filter((item): item is CmsFaqItem => item !== null)
  if (items.length === 0) return getDefaultCmsFaqItems()
  const normalized = items
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, index) => ({ ...item, sortOrder: index }))

  // Bestehende CMS-Daten ohne 3D-Kategorie einmalig anreichern
  const has3d = normalized.some((item) => item.category === FAQ_CATEGORY_3D_PRINT)
  if (!has3d) {
    return [
      ...normalized,
      ...getDefault3dPrintFaqItems(normalized.length),
    ].map((item, index) => ({ ...item, sortOrder: index }))
  }
  return normalized
}

export function mergeCmsFaqItems(
  input: unknown,
  texts?: Partial<Record<string, string>> | SiteTexts | null
): CmsFaqItem[] {
  if (input == null) return faqItemsFromSiteTexts(texts ?? null)
  if (Array.isArray(input) && input.length === 0) {
    return faqItemsFromSiteTexts(texts ?? null)
  }
  return sanitizeCmsFaqItemsInput(input)
}

export function createEmptyCmsFaqItem(sortOrder: number): CmsFaqItem {
  const stamp = Date.now().toString(36)
  return {
    id: `faq-${stamp}`,
    question: "Neue Frage",
    answer: "Antwort hier eintragen…",
    sortOrder,
    category: FAQ_CATEGORY_GENERAL,
  }
}

export function groupFaqItemsByCategory(
  items: CmsFaqItem[]
): Array<{ category: string; items: CmsFaqItem[] }> {
  const order: string[] = []
  const map = new Map<string, CmsFaqItem[]>()
  for (const item of items) {
    const category = item.category?.trim() || FAQ_CATEGORY_GENERAL
    if (!map.has(category)) {
      map.set(category, [])
      order.push(category)
    }
    map.get(category)!.push(item)
  }
  // 3D-Kategorie nach Allgemein priorisieren, falls vorhanden
  const preferred = [FAQ_CATEGORY_GENERAL, FAQ_CATEGORY_3D_PRINT]
  const sorted = [
    ...preferred.filter((c) => map.has(c)),
    ...order.filter((c) => !preferred.includes(c)),
  ]
  return sorted.map((category) => ({
    category,
    items: map.get(category) ?? [],
  }))
}
