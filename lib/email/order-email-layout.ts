export const ORDER_EMAIL_SECTION_IDS = [
  "header",
  "intro",
  "orderItems",
  "totals",
  "addressBlock",
  "footer",
] as const

export type OrderEmailSectionId = (typeof ORDER_EMAIL_SECTION_IDS)[number]

export type OrderEmailLogoPosition = "left" | "center" | "right"

export type OrderEmailLayout = {
  sectionOrder: OrderEmailSectionId[]
  showLogo: boolean
  logoPosition: OrderEmailLogoPosition
  headerTitle?: string
  /** Optionaler Override; leer = Dokumenten-Logo / Standard. */
  logoUrl?: string
}

export const DEFAULT_ORDER_EMAIL_LAYOUT: OrderEmailLayout = {
  sectionOrder: [...ORDER_EMAIL_SECTION_IDS],
  showLogo: true,
  logoPosition: "center",
  headerTitle: "",
  logoUrl: "",
}

export const ORDER_EMAIL_SECTION_LABELS: Record<OrderEmailSectionId, string> = {
  header: "Kopfzeile (Logo + Titel)",
  intro: "Einleitung",
  orderItems: "Artikelliste",
  totals: "Gesamtsumme",
  addressBlock: "Adressen",
  footer: "Fusstext / Abschluss",
}

const LOGO_POSITIONS: OrderEmailLogoPosition[] = ["left", "center", "right"]

function isOrderEmailSectionId(value: unknown): value is OrderEmailSectionId {
  return (
    typeof value === "string" &&
    (ORDER_EMAIL_SECTION_IDS as readonly string[]).includes(value)
  )
}

export function normalizeOrderEmailLayout(value: unknown): OrderEmailLayout {
  if (!value || typeof value !== "object") {
    return {
      ...DEFAULT_ORDER_EMAIL_LAYOUT,
      sectionOrder: [...DEFAULT_ORDER_EMAIL_LAYOUT.sectionOrder],
    }
  }

  const raw = value as Partial<OrderEmailLayout>
  const seen = new Set<OrderEmailSectionId>()
  const sectionOrder: OrderEmailSectionId[] = []

  if (Array.isArray(raw.sectionOrder)) {
    for (const entry of raw.sectionOrder) {
      if (isOrderEmailSectionId(entry) && !seen.has(entry)) {
        seen.add(entry)
        sectionOrder.push(entry)
      }
    }
  }

  for (const id of DEFAULT_ORDER_EMAIL_LAYOUT.sectionOrder) {
    if (!seen.has(id)) sectionOrder.push(id)
  }

  const logoPosition = LOGO_POSITIONS.includes(
    raw.logoPosition as OrderEmailLogoPosition
  )
    ? (raw.logoPosition as OrderEmailLogoPosition)
    : DEFAULT_ORDER_EMAIL_LAYOUT.logoPosition

  return {
    sectionOrder,
    showLogo: raw.showLogo !== false,
    logoPosition,
    headerTitle:
      typeof raw.headerTitle === "string"
        ? raw.headerTitle
        : DEFAULT_ORDER_EMAIL_LAYOUT.headerTitle,
    logoUrl: typeof raw.logoUrl === "string" ? raw.logoUrl : "",
  }
}
