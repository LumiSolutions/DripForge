import { promises as fs } from "fs"
import path from "path"
import { normalizeCustomerEmail } from "@/lib/admin/customers"
import {
  cosmosGetCartByEmail,
  cosmosSaveCartItems,
} from "@/lib/konto/cosmos-carts"
import type { CustomerCart } from "@/lib/konto/cart-types"
import type { CartItem } from "@/lib/dripforge/types"
import { withCosmosFallback } from "@/lib/admin/storage-bridge"

const DATA_DIR = path.join(process.cwd(), "data", "admin")
const CARTS_FILE = "customer-carts.json"

async function readCartsFile(): Promise<CustomerCart[]> {
  const filePath = path.join(DATA_DIR, CARTS_FILE)
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    return JSON.parse(raw) as CustomerCart[]
  } catch {
    return []
  }
}

async function writeCartsFile(carts: CustomerCart[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const filePath = path.join(DATA_DIR, CARTS_FILE)
  await fs.writeFile(filePath, JSON.stringify(carts, null, 2), "utf-8")
}

export async function getCartByEmail(email: string): Promise<CustomerCart | null> {
  const customerEmail = normalizeCustomerEmail(email)
  if (!customerEmail) return null

  return withCosmosFallback(
    "getCartByEmail",
    () => cosmosGetCartByEmail(customerEmail),
    async () => {
      const carts = await readCartsFile()
      return carts.find((cart) => cart.customerEmail === customerEmail) ?? null
    }
  )
}

export async function saveCartForCustomer(
  email: string,
  items: CartItem[]
): Promise<CustomerCart> {
  const customerEmail = normalizeCustomerEmail(email)
  const now = new Date().toISOString()
  const next: CustomerCart = {
    id: customerEmail,
    customerEmail,
    items,
    updatedAt: now,
  }

  await withCosmosFallback(
    "saveCartForCustomer",
    async () => {
      await cosmosSaveCartItems(customerEmail, items)
    },
    async () => {
      const carts = await readCartsFile()
      const index = carts.findIndex((cart) => cart.customerEmail === customerEmail)
      if (index >= 0) carts[index] = next
      else carts.push(next)
      await writeCartsFile(carts)
    }
  )

  return next
}
