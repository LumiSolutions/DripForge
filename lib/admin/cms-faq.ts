import { LEGAL_SITE_TEXT_DEFAULTS } from "@/lib/admin/legal-site-text-defaults"
import type { SiteTexts } from "@/lib/admin/site-texts"

export type CmsFaqItem = {
  id: string
  question: string
  answer: string
  sortOrder: number
}

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

export function getDefaultCmsFaqItems(): CmsFaqItem[] {
  return Array.from({ length: DEFAULT_FAQ_COUNT }, (_, i) => {
    const index = i + 1
    return {
      id: `faq-${index}`,
      question: defaultQuestion(index),
      answer: defaultAnswer(index),
      sortOrder: i,
    }
  })
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
    })
  }
  return items.length > 0 ? items : getDefaultCmsFaqItems()
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
  return { id, question, answer, sortOrder }
}

export function sanitizeCmsFaqItemsInput(input: unknown): CmsFaqItem[] {
  if (!Array.isArray(input)) return getDefaultCmsFaqItems()
  const items = input
    .map((item, index) => sanitizeFaqItem(item, index))
    .filter((item): item is CmsFaqItem => item !== null)
  if (items.length === 0) return getDefaultCmsFaqItems()
  return items
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, index) => ({ ...item, sortOrder: index }))
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
  }
}
