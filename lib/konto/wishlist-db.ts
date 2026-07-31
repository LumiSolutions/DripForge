import { promises as fs } from "fs"
import path from "path"
import { normalizeCustomerEmail } from "@/lib/admin/customers"
import { withCosmosFallback } from "@/lib/admin/storage-bridge"

export type WishlistItem = {
  productId: string
  addedAt: string
}

export type CustomerWishlist = {
  customerEmail: string
  items: WishlistItem[]
  updatedAt: string
}

const DATA_DIR = path.join(process.cwd(), "data", "admin")
const WISHLIST_FILE = "customer-wishlists.json"

async function readWishlistsFile(): Promise<CustomerWishlist[]> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, WISHLIST_FILE), "utf-8")
    return JSON.parse(raw) as CustomerWishlist[]
  } catch {
    return []
  }
}

async function writeWishlistsFile(rows: CustomerWishlist[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(
    path.join(DATA_DIR, WISHLIST_FILE),
    JSON.stringify(rows, null, 2),
    "utf-8"
  )
}

export async function getWishlistForCustomer(
  email: string
): Promise<CustomerWishlist> {
  const normalized = normalizeCustomerEmail(email)
  return withCosmosFallback(
    "getWishlistForCustomer",
    async () => {
      // Cosmos-Container optional — File-Fallback bleibt Source of Truth bis dedizierter Container.
      const all = await readWishlistsFile()
      return (
        all.find((row) => row.customerEmail === normalized) ?? {
          customerEmail: normalized,
          items: [],
          updatedAt: new Date().toISOString(),
        }
      )
    },
    async () => {
      const all = await readWishlistsFile()
      return (
        all.find((row) => row.customerEmail === normalized) ?? {
          customerEmail: normalized,
          items: [],
          updatedAt: new Date().toISOString(),
        }
      )
    }
  )
}

export async function toggleWishlistProduct(
  email: string,
  productId: string
): Promise<{ wishlist: CustomerWishlist; added: boolean }> {
  const normalized = normalizeCustomerEmail(email)
  const id = productId.trim()
  if (!id) throw new Error("productId fehlt")

  const existing = await getWishlistForCustomer(normalized)
  const has = existing.items.some((item) => item.productId === id)
  const items = has
    ? existing.items.filter((item) => item.productId !== id)
    : [
        ...existing.items,
        { productId: id, addedAt: new Date().toISOString() },
      ]

  const wishlist: CustomerWishlist = {
    customerEmail: normalized,
    items,
    updatedAt: new Date().toISOString(),
  }

  await withCosmosFallback(
    "saveWishlistForCustomer",
    async () => {
      const all = await readWishlistsFile()
      const index = all.findIndex((row) => row.customerEmail === normalized)
      if (index >= 0) all[index] = wishlist
      else all.push(wishlist)
      await writeWishlistsFile(all)
    },
    async () => {
      const all = await readWishlistsFile()
      const index = all.findIndex((row) => row.customerEmail === normalized)
      if (index >= 0) all[index] = wishlist
      else all.push(wishlist)
      await writeWishlistsFile(all)
    }
  )

  return { wishlist, added: !has }
}
