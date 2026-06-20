import { getCartByEmail, saveCartForCustomer } from "@/lib/konto/cart-db"
import {
  mergeCartItems,
  normalizeCartItem,
  parseGuestCartItems,
  stripCartForPersistence,
} from "@/lib/konto/cart-merge"
import type { CartItem } from "@/lib/dripforge/types"

export async function getAccountCartItems(email: string): Promise<CartItem[]> {
  const cart = await getCartByEmail(email)
  if (!cart?.items?.length) return []
  return cart.items
    .map((item) => normalizeCartItem(item))
    .filter((item): item is CartItem => item !== null)
}

export async function mergeGuestCartForCustomer(
  email: string,
  guestCartRaw: unknown
): Promise<CartItem[]> {
  const guestItems = parseGuestCartItems(guestCartRaw)
  const accountItems = await getAccountCartItems(email)

  if (guestItems.length === 0) {
    return accountItems
  }

  const merged = mergeCartItems(guestItems, accountItems)
  await saveCartForCustomer(email, stripCartForPersistence(merged))
  return merged
}

export async function replaceCustomerCart(
  email: string,
  itemsRaw: unknown
): Promise<CartItem[]> {
  const items = parseGuestCartItems(itemsRaw)
  await saveCartForCustomer(email, stripCartForPersistence(items))
  return items
}
