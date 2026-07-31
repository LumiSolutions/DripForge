/** CMS-Listen für Storefront-Unterseiten (Ablauf, Erwartungen, Kontaktformular). */

export type CmsProcessStep = {
  id: string
  title: string
  description: string
  /** Lucide-Icon-Name (z. B. Upload, Layers, Package) */
  icon: string
  sortOrder: number
}

export type CmsExpectItem = {
  id: string
  title: string
  description: string
  materialLabel: string
  imageUrl: string | null
  /** URL-Slug für Detailseite */
  slug: string
  sortOrder: number
}

export type CmsContactFieldType =
  | "text"
  | "email"
  | "textarea"
  | "select"
  | "file"

export type CmsContactField = {
  id: string
  type: CmsContactFieldType
  label: string
  placeholder: string
  required: boolean
  options: string[]
  sortOrder: number
  /** Stabiler Schlüssel für API (name, email, …) */
  key: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64)
}

export function getDefaultProcessSteps3d(): CmsProcessStep[] {
  return [
    {
      id: "3d-step-1",
      title: "Design & Upload",
      description:
        "Laden Sie Ihr 3D-Modell (STL, OBJ) hoch oder beschreiben Sie Ihre Idee. Unser System analysiert Dimensionen und Komplexität.",
      icon: "Upload",
      sortOrder: 0,
    },
    {
      id: "3d-step-2",
      title: "Materialauswahl",
      description:
        "Wählen Sie aus unseren Premium-Filamenten basierend auf Ihren Anwendungsanforderungen - Festigkeit, Flexibilität oder Ästhetik.",
      icon: "Layers",
      sortOrder: 1,
    },
    {
      id: "3d-step-3",
      title: "Präzisionsdruck",
      description:
        "Ihr Modell wird Schicht für Schicht mit industrieller Präzision und Qualitätskontrolle gedruckt.",
      icon: "Printer",
      sortOrder: 2,
    },
    {
      id: "3d-step-4",
      title: "Nachbearbeitung",
      description:
        "Teile werden gereinigt, Stützstrukturen entfernt und optionale Veredelung für ein professionelles Ergebnis angewendet.",
      icon: "Sparkles",
      sortOrder: 3,
    },
    {
      id: "3d-step-5",
      title: "Qualitätsprüfung & Versand",
      description:
        "Jedes Stück wird vor der sorgfältigen Verpackung und dem Versand zu Ihnen inspiziert.",
      icon: "Package",
      sortOrder: 4,
    },
  ]
}

export function getDefaultProcessStepsLaser(): CmsProcessStep[] {
  return [
    {
      id: "laser-step-1",
      title: "Datei hochladen",
      description:
        "Laden Sie ein Bild (PNG, SVG, JPG) hoch oder geben Sie Ihren Text ein. Vektordateien liefern die schärfsten Ergebnisse.",
      icon: "Image",
      sortOrder: 0,
    },
    {
      id: "laser-step-2",
      title: "Material wählen",
      description:
        "Wählen Sie aus Holz, Acryl, Leder oder Schiefer. Jedes Material reagiert anders auf den Laserstrahl.",
      icon: "Layers",
      sortOrder: 1,
    },
    {
      id: "laser-step-3",
      title: "Laserpräzision",
      description:
        "Unser Laser graviert mit bis zu 0.1mm Präzision. Die Intensität wird automatisch auf das gewählte Material abgestimmt.",
      icon: "Zap",
      sortOrder: 2,
    },
    {
      id: "laser-step-4",
      title: "Versand",
      description:
        "Jedes gravierte Stück wird sorgfältig geprüft, verpackt und innert 3–5 Werktagen zu Ihnen geliefert.",
      icon: "Package",
      sortOrder: 3,
    },
  ]
}

export function getDefaultExpectItemsLaser(): CmsExpectItem[] {
  return [
    {
      id: "expect-laser-wood",
      title: "Individuelle Holzschilder",
      description: "Handgefertigte Schilder mit präziser Lasergravur",
      materialLabel: "Holz",
      imageUrl: null,
      slug: "holzschilder",
      sortOrder: 0,
    },
    {
      id: "expect-laser-acrylic",
      title: "LED Edge-Lit Displays",
      description: "Moderne Acrylschilder mit atemberaubender Beleuchtung",
      materialLabel: "Acryl",
      imageUrl: null,
      slug: "acryl-displays",
      sortOrder: 1,
    },
    {
      id: "expect-laser-leather",
      title: "Personalisierte Accessoires",
      description: "Individuelle Lederartikel mit eleganten Gravuren",
      materialLabel: "Leder",
      imageUrl: null,
      slug: "leder-accessoires",
      sortOrder: 2,
    },
  ]
}

export function getDefaultExpectItems3d(): CmsExpectItem[] {
  return [
    {
      id: "expect-3d-prototype",
      title: "Funktionale Prototypen",
      description: "Präzise Prototypen für Entwicklung und Fit-Checks",
      materialLabel: "PLA / PETG",
      imageUrl: null,
      slug: "prototypen",
      sortOrder: 0,
    },
    {
      id: "expect-3d-product",
      title: "Endprodukte",
      description: "Seriennahe Teile mit hochwertiger Oberflächenqualität",
      materialLabel: "ASA / PETG",
      imageUrl: null,
      slug: "endprodukte",
      sortOrder: 1,
    },
    {
      id: "expect-3d-custom",
      title: "Individuelle Kreationen",
      description: "Massgeschneiderte Designs nach Ihrer Vorlage",
      materialLabel: "Nach Wahl",
      imageUrl: null,
      slug: "individuell",
      sortOrder: 2,
    },
  ]
}

export function getDefaultContactFormFields(): CmsContactField[] {
  return [
    {
      id: "cf-name",
      key: "name",
      type: "text",
      label: "Name",
      placeholder: "Ihr Name",
      required: true,
      options: [],
      sortOrder: 0,
    },
    {
      id: "cf-email",
      key: "email",
      type: "email",
      label: "E-Mail",
      placeholder: "ihre@email.com",
      required: true,
      options: [],
      sortOrder: 1,
    },
    {
      id: "cf-company",
      key: "company",
      type: "text",
      label: "Firma (optional)",
      placeholder: "Ihre Firma",
      required: false,
      options: [],
      sortOrder: 2,
    },
    {
      id: "cf-inquiryType",
      key: "inquiryType",
      type: "select",
      label: "Anfrage-Typ",
      placeholder: "Typ auswählen",
      required: true,
      options: [
        "3D-Druck Anfrage",
        "Lasergravur Anfrage",
        "Allgemeine Frage",
        "Offerte anfordern",
      ],
      sortOrder: 3,
    },
    {
      id: "cf-subject",
      key: "subject",
      type: "text",
      label: "Betreff",
      placeholder: "Kurzer Betreff Ihrer Anfrage",
      required: true,
      options: [],
      sortOrder: 4,
    },
    {
      id: "cf-message",
      key: "message",
      type: "textarea",
      label: "Nachricht",
      placeholder: "Erzählen Sie uns von Ihrem Projekt oder Ihrer Frage...",
      required: true,
      options: [],
      sortOrder: 5,
    },
  ]
}

function sanitizeProcessStep(raw: unknown, index: number): CmsProcessStep | null {
  if (!isRecord(raw)) return null
  const title = typeof raw.title === "string" ? raw.title : `Schritt ${index + 1}`
  const description = typeof raw.description === "string" ? raw.description : ""
  const icon =
    typeof raw.icon === "string" && raw.icon.trim() ? raw.icon.trim() : "Circle"
  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : `step-${Date.now().toString(36)}-${index}`
  const sortOrder =
    typeof raw.sortOrder === "number" && Number.isFinite(raw.sortOrder)
      ? raw.sortOrder
      : index
  return { id, title, description, icon, sortOrder }
}

export function sanitizeCmsProcessSteps(
  input: unknown,
  fallback: () => CmsProcessStep[]
): CmsProcessStep[] {
  if (!Array.isArray(input)) return fallback()
  const items = input
    .map((item, index) => sanitizeProcessStep(item, index))
    .filter((item): item is CmsProcessStep => item !== null)
  if (items.length === 0) return fallback()
  return items
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, index) => ({ ...item, sortOrder: index }))
}

function sanitizeExpectItem(raw: unknown, index: number): CmsExpectItem | null {
  if (!isRecord(raw)) return null
  const title = typeof raw.title === "string" ? raw.title : `Beispiel ${index + 1}`
  const description = typeof raw.description === "string" ? raw.description : ""
  const materialLabel =
    typeof raw.materialLabel === "string" ? raw.materialLabel : ""
  const imageUrl =
    typeof raw.imageUrl === "string" && raw.imageUrl.trim()
      ? raw.imageUrl.trim()
      : null
  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : `expect-${Date.now().toString(36)}-${index}`
  const slugRaw =
    typeof raw.slug === "string" && raw.slug.trim()
      ? raw.slug.trim()
      : slugify(title) || `item-${index + 1}`
  const sortOrder =
    typeof raw.sortOrder === "number" && Number.isFinite(raw.sortOrder)
      ? raw.sortOrder
      : index
  return {
    id,
    title,
    description,
    materialLabel,
    imageUrl,
    slug: slugify(slugRaw) || `item-${index + 1}`,
    sortOrder,
  }
}

export function sanitizeCmsExpectItems(
  input: unknown,
  fallback: () => CmsExpectItem[]
): CmsExpectItem[] {
  if (!Array.isArray(input)) return fallback()
  const items = input
    .map((item, index) => sanitizeExpectItem(item, index))
    .filter((item): item is CmsExpectItem => item !== null)
  if (items.length === 0) return fallback()
  return items
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, index) => ({ ...item, sortOrder: index }))
}

const CONTACT_FIELD_TYPES: CmsContactFieldType[] = [
  "text",
  "email",
  "textarea",
  "select",
  "file",
]

function sanitizeContactField(
  raw: unknown,
  index: number
): CmsContactField | null {
  if (!isRecord(raw)) return null
  const type = CONTACT_FIELD_TYPES.includes(raw.type as CmsContactFieldType)
    ? (raw.type as CmsContactFieldType)
    : "text"
  const label = typeof raw.label === "string" ? raw.label : `Feld ${index + 1}`
  const placeholder =
    typeof raw.placeholder === "string" ? raw.placeholder : ""
  const required = Boolean(raw.required)
  const options = Array.isArray(raw.options)
    ? raw.options.filter((o): o is string => typeof o === "string")
    : []
  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : `cf-${Date.now().toString(36)}-${index}`
  const key =
    typeof raw.key === "string" && raw.key.trim()
      ? raw.key.trim().replace(/[^a-zA-Z0-9_]/g, "_")
      : `field_${index + 1}`
  const sortOrder =
    typeof raw.sortOrder === "number" && Number.isFinite(raw.sortOrder)
      ? raw.sortOrder
      : index
  return { id, type, label, placeholder, required, options, key, sortOrder }
}

export function sanitizeCmsContactFormFields(input: unknown): CmsContactField[] {
  if (!Array.isArray(input)) return getDefaultContactFormFields()
  const items = input
    .map((item, index) => sanitizeContactField(item, index))
    .filter((item): item is CmsContactField => item !== null)
  if (items.length === 0) return getDefaultContactFormFields()
  return items
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, index) => ({ ...item, sortOrder: index }))
}

export function createEmptyProcessStep(sortOrder: number): CmsProcessStep {
  return {
    id: `step-${Date.now().toString(36)}`,
    title: "Neuer Schritt",
    description: "Beschreibung hier eintragen…",
    icon: "Circle",
    sortOrder,
  }
}

export function createEmptyExpectItem(sortOrder: number): CmsExpectItem {
  const stamp = Date.now().toString(36)
  return {
    id: `expect-${stamp}`,
    title: "Neues Beispiel",
    description: "Beschreibung…",
    materialLabel: "Material",
    imageUrl: null,
    slug: `beispiel-${stamp}`,
    sortOrder,
  }
}

export function createEmptyContactField(sortOrder: number): CmsContactField {
  const stamp = Date.now().toString(36)
  return {
    id: `cf-${stamp}`,
    key: `custom_${stamp}`,
    type: "text",
    label: "Neues Feld",
    placeholder: "",
    required: false,
    options: [],
    sortOrder,
  }
}

export type CmsPageContentLists = {
  processSteps3d: CmsProcessStep[]
  processStepsLaser: CmsProcessStep[]
  expectItems3d: CmsExpectItem[]
  expectItemsLaser: CmsExpectItem[]
  contactFormFields: CmsContactField[]
}

export function getDefaultCmsPageContentLists(): CmsPageContentLists {
  return {
    processSteps3d: getDefaultProcessSteps3d(),
    processStepsLaser: getDefaultProcessStepsLaser(),
    expectItems3d: getDefaultExpectItems3d(),
    expectItemsLaser: getDefaultExpectItemsLaser(),
    contactFormFields: getDefaultContactFormFields(),
  }
}

export function mergeCmsPageContentLists(
  partial: Partial<CmsPageContentLists> | null | undefined
): CmsPageContentLists {
  return {
    processSteps3d: sanitizeCmsProcessSteps(
      partial?.processSteps3d,
      getDefaultProcessSteps3d
    ),
    processStepsLaser: sanitizeCmsProcessSteps(
      partial?.processStepsLaser,
      getDefaultProcessStepsLaser
    ),
    expectItems3d: sanitizeCmsExpectItems(
      partial?.expectItems3d,
      getDefaultExpectItems3d
    ),
    expectItemsLaser: sanitizeCmsExpectItems(
      partial?.expectItemsLaser,
      getDefaultExpectItemsLaser
    ),
    contactFormFields: sanitizeCmsContactFormFields(partial?.contactFormFields),
  }
}
