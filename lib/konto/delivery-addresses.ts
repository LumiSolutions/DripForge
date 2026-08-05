import type { SavedDeliveryAddress } from "@/lib/konto/account-types"

export type LegacyDeliveryFields = {
  deliveryStreet?: string
  deliveryZip?: string
  deliveryCity?: string
  deliverySameAsBilling?: boolean
}

export function newDeliveryAddressId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `addr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function trimAddress(raw: Partial<SavedDeliveryAddress>): SavedDeliveryAddress | null {
  const street = typeof raw.street === "string" ? raw.street.trim() : ""
  const zip = typeof raw.zip === "string" ? raw.zip.trim() : ""
  const city = typeof raw.city === "string" ? raw.city.trim() : ""
  if (!street && !zip && !city) return null

  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : newDeliveryAddressId()
  const label =
    typeof raw.label === "string" && raw.label.trim()
      ? raw.label.trim()
      : "Lieferadresse"
  const firstName =
    typeof raw.firstName === "string" ? raw.firstName.trim() : ""
  const lastName =
    typeof raw.lastName === "string" ? raw.lastName.trim() : ""
  const company =
    typeof raw.company === "string" ? raw.company.trim() : ""
  const country =
    typeof raw.country === "string" && raw.country.trim()
      ? raw.country.trim()
      : "Schweiz"

  return {
    id,
    label,
    street,
    zip,
    city,
    country,
    isDefault: raw.isDefault === true,
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
    ...(company ? { company } : {}),
  }
}

/** Parse unknown JSON into SavedDeliveryAddress[]. */
export function parseSavedDeliveryAddresses(value: unknown): SavedDeliveryAddress[] {
  if (!Array.isArray(value)) return []
  const out: SavedDeliveryAddress[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const parsed = trimAddress(item as Partial<SavedDeliveryAddress>)
    if (parsed) out.push(parsed)
  }
  return out
}

/**
 * Ensure a usable list: synthesize from legacy flat fields when the array is empty,
 * and guarantee exactly one default when addresses exist.
 */
export function normalizeDeliveryAddresses(
  addresses: SavedDeliveryAddress[] | undefined | null,
  legacy?: LegacyDeliveryFields,
  options?: { defaultId?: string | null }
): SavedDeliveryAddress[] {
  let list = (addresses ?? [])
    .map((a) => trimAddress(a))
    .filter((a): a is SavedDeliveryAddress => a != null)

  if (list.length === 0 && legacy) {
    const sameAsBilling = legacy.deliverySameAsBilling !== false
    const street = (legacy.deliveryStreet ?? "").trim()
    const zip = (legacy.deliveryZip ?? "").trim()
    const city = (legacy.deliveryCity ?? "").trim()
    // Nur synthetisieren, wenn eine abweichende Lieferadresse existierte.
    if (!sameAsBilling && (street || zip || city)) {
      list = [
        {
          id: newDeliveryAddressId(),
          label: "Lieferadresse",
          street,
          zip,
          city,
          isDefault: true,
        },
      ]
    }
  }

  if (list.length === 0) return []

  const defaultId = options?.defaultId?.trim() || null
  const hasRequested = defaultId
    ? list.some((a) => a.id === defaultId)
    : false
  const existingDefault = list.find((a) => a.isDefault)

  return list.map((a, index) => {
    let isDefault = false
    if (hasRequested) {
      isDefault = a.id === defaultId
    } else if (existingDefault) {
      isDefault = a.id === existingDefault.id
    } else {
      isDefault = index === 0
    }
    return { ...a, isDefault }
  })
}

export function getDefaultDeliveryAddress(
  addresses: SavedDeliveryAddress[] | undefined | null
): SavedDeliveryAddress | undefined {
  const list = addresses ?? []
  return list.find((a) => a.isDefault) ?? list[0]
}

/** Keep flat legacy fields in sync with the default saved address. */
export function legacyFieldsFromDeliveryAddresses(
  addresses: SavedDeliveryAddress[],
  billing?: { street?: string; zip?: string; city?: string }
): LegacyDeliveryFields {
  const def = getDefaultDeliveryAddress(addresses)
  if (!def) {
    return {
      deliveryStreet: billing?.street ?? "",
      deliveryZip: billing?.zip ?? "",
      deliveryCity: billing?.city ?? "",
      deliverySameAsBilling: true,
    }
  }

  const sameAsBilling =
    Boolean(billing) &&
    def.street === (billing?.street ?? "").trim() &&
    def.zip === (billing?.zip ?? "").trim() &&
    def.city === (billing?.city ?? "").trim()

  return {
    deliveryStreet: def.street,
    deliveryZip: def.zip,
    deliveryCity: def.city,
    deliverySameAsBilling: sameAsBilling,
  }
}

export function setDefaultDeliveryAddressId(
  addresses: SavedDeliveryAddress[],
  defaultId: string
): SavedDeliveryAddress[] {
  if (addresses.length === 0) return []
  const exists = addresses.some((a) => a.id === defaultId)
  const targetId = exists ? defaultId : addresses[0].id
  return addresses.map((a) => ({ ...a, isDefault: a.id === targetId }))
}

/** Format for display in selects / lists. */
export function formatDeliveryAddressLabel(address: SavedDeliveryAddress): string {
  const name = [address.firstName, address.lastName]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean)
    .join(" ")
  const company =
    typeof address.company === "string" ? address.company.trim() : ""
  const nameLine = [name, company].filter(Boolean).join(", ")
  const parts = [address.street, [address.zip, address.city].filter(Boolean).join(" ")]
    .map((p) => p.trim())
    .filter(Boolean)
  const location = parts.join(", ")
  const detail = [nameLine, location].filter(Boolean).join(" — ")
  if (address.label && detail) return `${address.label} — ${detail}`
  return address.label || detail || "Lieferadresse"
}
