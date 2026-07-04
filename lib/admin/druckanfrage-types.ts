import type { PrintPriceBreakdown } from "@/lib/dripforge/calculate-3d-print-price"

export const DRUCKANFRAGE_DOC_TYPE = "druckanfrage"

export const DRUCKANFRAGE_CONTACT_METHODS = ["email", "whatsapp"] as const
export type DruckanfrageContactMethod = (typeof DRUCKANFRAGE_CONTACT_METHODS)[number]

export const DRUCKANFRAGE_STATUSES = ["neu", "in_bearbeitung", "abgeschlossen"] as const
export type DruckanfrageStatus = (typeof DRUCKANFRAGE_STATUSES)[number]

export type DruckanfrageDimensionsMm = {
  x: number
  y: number
  z: number
}

export type Druckanfrage = {
  id: string
  docType: typeof DRUCKANFRAGE_DOC_TYPE
  status: DruckanfrageStatus
  contactMethod: DruckanfrageContactMethod
  customerEmail: string
  customerPhone?: string
  fileName: string
  fileUrl: string | null
  fileSizeBytes: number
  leitbildUrl: string | null
  colorReferenceImageUrl: string | null
  quantity: number
  scalePercent: number
  dimensionsMm: DruckanfrageDimensionsMm
  volumeCm3: number
  filamentMaterial: string
  filamentColors: string[]
  colorWishes?: string
  hasEmbeddedModelColors: boolean
  estimatedUnitPrice: number
  estimatedTotalPrice: number
  priceBreakdown: PrintPriceBreakdown
  createdAt: string
  updatedAt: string
}

export type CreateDruckanfrageInput = Omit<
  Druckanfrage,
  "id" | "docType" | "status" | "createdAt" | "updatedAt"
>

export const MAX_DRUCKANFRAGE_FILE_BYTES = 50 * 1024 * 1024

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidContactEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
}

export function isValidContactPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "")
  if (digits.startsWith("41") && digits.length === 11) return true
  if (digits.startsWith("0") && digits.length === 10) return true
  return digits.length >= 9 && digits.length <= 15
}

export function createDruckanfrageId(): string {
  const stamp = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `da-${stamp}-${rand}`
}
