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

/** Welche Meta-Zeilen im Artikel-/Bestellblock der Bestätigungsmail erscheinen. */
export type OrderEmailMetaFields = {
  invoiceNumber: boolean
  orderRef: boolean
  date: boolean
  paymentMethod: boolean
  paymentStatus: boolean
  shippingMethod: boolean
}

export const DEFAULT_ORDER_EMAIL_META_FIELDS: OrderEmailMetaFields = {
  invoiceNumber: true,
  orderRef: true,
  date: true,
  paymentMethod: true,
  paymentStatus: true,
  shippingMethod: true,
}

export const ORDER_EMAIL_META_FIELD_LABELS: Record<
  keyof OrderEmailMetaFields,
  string
> = {
  invoiceNumber: "Rechnungsnummer / Bestellnummer",
  orderRef: "Bestell-Ref",
  date: "Datum",
  paymentMethod: "Zahlungsart",
  paymentStatus: "Zahlungsstatus",
  shippingMethod: "Versandart",
}

export type OrderEmailLayout = {
  sectionOrder: OrderEmailSectionId[]
  showLogo: boolean
  logoPosition: OrderEmailLogoPosition
  headerTitle?: string
  /** Optionaler Override; leer = Dokumenten-Logo / Standard. */
  logoUrl?: string
  /** Sichtbare Datenfelder im Bestell-/Artikelblock */
  metaFields?: OrderEmailMetaFields
}

export const DEFAULT_ORDER_EMAIL_LAYOUT: OrderEmailLayout = {
  sectionOrder: [...ORDER_EMAIL_SECTION_IDS],
  showLogo: true,
  logoPosition: "center",
  headerTitle: "",
  logoUrl: "",
  metaFields: { ...DEFAULT_ORDER_EMAIL_META_FIELDS },
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

export function normalizeOrderEmailMetaFields(
  value: unknown
): OrderEmailMetaFields {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_ORDER_EMAIL_META_FIELDS }
  }
  const raw = value as Partial<Record<keyof OrderEmailMetaFields, unknown>>
  return {
    invoiceNumber:
      raw.invoiceNumber === undefined
        ? DEFAULT_ORDER_EMAIL_META_FIELDS.invoiceNumber
        : Boolean(raw.invoiceNumber),
    orderRef:
      raw.orderRef === undefined
        ? DEFAULT_ORDER_EMAIL_META_FIELDS.orderRef
        : Boolean(raw.orderRef),
    date:
      raw.date === undefined
        ? DEFAULT_ORDER_EMAIL_META_FIELDS.date
        : Boolean(raw.date),
    paymentMethod:
      raw.paymentMethod === undefined
        ? DEFAULT_ORDER_EMAIL_META_FIELDS.paymentMethod
        : Boolean(raw.paymentMethod),
    paymentStatus:
      raw.paymentStatus === undefined
        ? DEFAULT_ORDER_EMAIL_META_FIELDS.paymentStatus
        : Boolean(raw.paymentStatus),
    shippingMethod:
      raw.shippingMethod === undefined
        ? DEFAULT_ORDER_EMAIL_META_FIELDS.shippingMethod
        : Boolean(raw.shippingMethod),
  }
}

export function normalizeOrderEmailLayout(value: unknown): OrderEmailLayout {
  if (!value || typeof value !== "object") {
    return {
      ...DEFAULT_ORDER_EMAIL_LAYOUT,
      sectionOrder: [...DEFAULT_ORDER_EMAIL_LAYOUT.sectionOrder],
      metaFields: { ...DEFAULT_ORDER_EMAIL_META_FIELDS },
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
    metaFields: normalizeOrderEmailMetaFields(raw.metaFields),
  }
}
