import type { CartItem } from "@/lib/dripforge/types"

const MAX_CART_ITEMS = 50
const MAX_ITEM_QUANTITY = 99

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function parseGuestCartItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return []

  const parsed: CartItem[] = []
  for (const entry of raw) {
    const item = normalizeCartItem(entry)
    if (item) parsed.push(item)
  }
  return parsed.slice(0, MAX_CART_ITEMS)
}

export function normalizeCartItem(raw: unknown): CartItem | null {
  if (!isRecord(raw)) return null

  const name = typeof raw.name === "string" ? raw.name.trim() : ""
  const price = Number(raw.price)
  const quantity = Number(raw.quantity)
  const type = raw.type

  if (!name || !Number.isFinite(price) || price < 0) return null
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
    return null
  }
  if (type !== "3d" && type !== "laser") return null

  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : `cart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const item: CartItem = {
    id,
    name,
    price,
    quantity,
    type,
  }

  if (typeof raw.leitbild === "string" && raw.leitbild.length > 0) {
    item.leitbild = raw.leitbild
  }
  if (typeof raw.previewMockup === "string" && raw.previewMockup.length > 0) {
    item.previewMockup = raw.previewMockup
  }

  if (isRecord(raw.customDetails)) {
    item.customDetails = raw.customDetails as CartItem["customDetails"]
  }

  return item
}

function cartItemSignature(item: CartItem): string {
  const {
    id: _id,
    quantity: _quantity,
    leitbild: _leitbild,
    previewMockup: _previewMockup,
    ...rest
  } = item
  return JSON.stringify(rest)
}

export function mergeCartItems(
  guestItems: CartItem[],
  accountItems: CartItem[]
): CartItem[] {
  const merged = accountItems.map((item) => ({ ...item, quantity: item.quantity }))
  let idCounter = Date.now()

  for (const guestItem of guestItems) {
    const signature = cartItemSignature(guestItem)
    const existing = merged.find((item) => cartItemSignature(item) === signature)

    if (existing) {
      existing.quantity = Math.min(
        MAX_ITEM_QUANTITY,
        existing.quantity + guestItem.quantity
      )
      if (!existing.leitbild && guestItem.leitbild) {
        existing.leitbild = guestItem.leitbild
      }
      if (!existing.previewMockup && guestItem.previewMockup) {
        existing.previewMockup = guestItem.previewMockup
      }
    } else {
      merged.push({
        ...guestItem,
        id: `${guestItem.id}-m${idCounter++}`,
      })
    }
  }

  return merged.slice(0, MAX_CART_ITEMS)
}

/** Entfernt grosse Base64-Felder vor der Cosmos-Persistenz. */
export function stripCartForPersistence(items: CartItem[]): CartItem[] {
  return items.map((item) => {
    const next: CartItem = {
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      type: item.type,
    }

    if (item.customDetails) {
      const details = { ...item.customDetails }
      if (
        typeof details.colorReferenceImage === "string" &&
        details.colorReferenceImage.startsWith("data:")
      ) {
        details.colorReferenceImage = null
      }
      if (
        typeof details.uploadedImage === "string" &&
        details.uploadedImage.startsWith("data:")
      ) {
        details.uploadedImage = null
      }
      next.customDetails = details
    }

    return next
  })
}
