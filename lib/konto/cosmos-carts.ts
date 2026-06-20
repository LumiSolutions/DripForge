import { getCustomerCartsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import { normalizeCustomerEmail } from "@/lib/admin/customers"
import type { CustomerCart } from "@/lib/konto/cart-types"
import type { CartItem } from "@/lib/dripforge/types"

type CosmosDoc<T> = T & { id: string }

function mapCosmosCart(doc: CosmosDoc<CustomerCart>): CustomerCart {
  return {
    id: doc.id,
    customerEmail: doc.customerEmail,
    items: Array.isArray(doc.items) ? doc.items : [],
    updatedAt: doc.updatedAt,
  }
}

export async function cosmosGetCartByEmail(
  email: string
): Promise<CustomerCart | null> {
  const customerEmail = normalizeCustomerEmail(email)
  if (!customerEmail) return null

  const container = await getCustomerCartsContainer()
  try {
    const { resource: doc } = await container
      .item(customerEmail, customerEmail)
      .read<CosmosDoc<CustomerCart>>()
    if (!doc) return null
    return mapCosmosCart(doc)
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return null
    logCosmosError(`cosmosGetCartByEmail:${customerEmail}`, error)
    throw error
  }
}

export async function cosmosUpsertCart(cart: CustomerCart): Promise<CustomerCart> {
  const container = await getCustomerCartsContainer()
  await container.items.upsert({ ...cart, id: cart.id })
  return cart
}

export async function cosmosSaveCartItems(
  email: string,
  items: CartItem[]
): Promise<CustomerCart> {
  const customerEmail = normalizeCustomerEmail(email)
  const now = new Date().toISOString()
  const cart: CustomerCart = {
    id: customerEmail,
    customerEmail,
    items,
    updatedAt: now,
  }
  return cosmosUpsertCart(cart)
}
