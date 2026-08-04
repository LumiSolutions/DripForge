import { promises as fs } from "fs"
import path from "path"
import { normalizeCustomerEmail } from "@/lib/admin/customers"
import { withCosmosFallback } from "@/lib/admin/storage-bridge"
import {
  cosmosGetCustomerOfferById,
  cosmosListAllCustomerOffers,
  cosmosListOffersByEmail,
  cosmosUpsertCustomerOffer,
  cosmosDeleteCustomerOffer,
} from "@/lib/konto/cosmos-offers"
import {
  normalizeCustomerOffer,
  type CustomerOffer,
} from "@/lib/konto/customer-offer-types"

const DATA_DIR = path.join(process.cwd(), "data", "admin")
const OFFERS_FILE = "customer-offers.json"

async function readOffersFile(): Promise<CustomerOffer[]> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, OFFERS_FILE), "utf-8")
    const parsed = JSON.parse(raw) as CustomerOffer[]
    return Array.isArray(parsed)
      ? parsed
          .map((o) => normalizeCustomerOffer(o))
          .filter((o): o is CustomerOffer => Boolean(o))
      : []
  } catch {
    return []
  }
}

async function writeOffersFile(offers: CustomerOffer[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(
    path.join(DATA_DIR, OFFERS_FILE),
    JSON.stringify(offers, null, 2),
    "utf-8"
  )
}

export async function getOffersForCustomer(
  email: string
): Promise<CustomerOffer[]> {
  const normalized = normalizeCustomerEmail(email)
  return withCosmosFallback(
    "getOffersForCustomer",
    () => cosmosListOffersByEmail(normalized),
    async () => {
      const all = await readOffersFile()
      return all
        .filter((o) => o.customerEmail === normalized)
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
    }
  )
}

export async function getActiveOffersForCustomer(
  email: string
): Promise<CustomerOffer[]> {
  const offers = await getOffersForCustomer(email)
  return offers.filter((o) => o.status === "active")
}

export async function getOfferById(id: string): Promise<CustomerOffer | null> {
  return withCosmosFallback(
    "getOfferById",
    () => cosmosGetCustomerOfferById(id),
    async () => {
      const all = await readOffersFile()
      return all.find((o) => o.id === id) ?? null
    }
  )
}

export async function listAllCustomerOffers(): Promise<CustomerOffer[]> {
  return withCosmosFallback(
    "listAllCustomerOffers",
    () => cosmosListAllCustomerOffers(),
    () => readOffersFile()
  )
}

export async function saveCustomerOffer(
  offer: CustomerOffer
): Promise<CustomerOffer> {
  const next = normalizeCustomerOffer({
    ...offer,
    customerEmail: normalizeCustomerEmail(offer.customerEmail),
    updatedAt: new Date().toISOString(),
  })
  if (!next) throw new Error("Ungültiges Angebot")

  await withCosmosFallback(
    "saveCustomerOffer",
    async () => {
      await cosmosUpsertCustomerOffer(next)
    },
    async () => {
      const all = await readOffersFile()
      const index = all.findIndex((o) => o.id === next.id)
      if (index >= 0) all[index] = next
      else all.push(next)
      await writeOffersFile(all)
    }
  )
  return next
}

export async function deleteCustomerOffer(id: string): Promise<boolean> {
  const trimmed = id.trim()
  if (!trimmed) return false

  return withCosmosFallback(
    "deleteCustomerOffer",
    async () => {
      const existing = await cosmosGetCustomerOfferById(trimmed)
      if (!existing) return false
      await cosmosDeleteCustomerOffer(trimmed)
      return true
    },
    async () => {
      const all = await readOffersFile()
      const next = all.filter((o) => o.id !== trimmed)
      if (next.length === all.length) return false
      await writeOffersFile(next)
      return true
    }
  )
}
