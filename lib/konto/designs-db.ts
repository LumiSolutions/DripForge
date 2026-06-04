import { promises as fs } from "fs"
import path from "path"
import { normalizeCustomerEmail } from "@/lib/admin/customers"
import {
  cosmosGetDesignById,
  cosmosGetDesignsByEmail,
  cosmosUpsertDesign,
} from "@/lib/konto/cosmos-designs"
import type { SavedCustomerDesign } from "@/lib/konto/account-types"
import { withCosmosFallback } from "@/lib/admin/storage-bridge"

const DATA_DIR = path.join(process.cwd(), "data", "admin")
const DESIGNS_FILE = "customer-designs.json"

async function readDesignsFile(): Promise<SavedCustomerDesign[]> {
  const filePath = path.join(DATA_DIR, DESIGNS_FILE)
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    return JSON.parse(raw) as SavedCustomerDesign[]
  } catch {
    return []
  }
}

async function writeDesignsFile(designs: SavedCustomerDesign[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const filePath = path.join(DATA_DIR, DESIGNS_FILE)
  await fs.writeFile(filePath, JSON.stringify(designs, null, 2), "utf-8")
}

export async function getDesignsForCustomer(
  email: string
): Promise<SavedCustomerDesign[]> {
  const normalized = normalizeCustomerEmail(email)
  return withCosmosFallback(
    "getDesignsForCustomer",
    () => cosmosGetDesignsByEmail(normalized),
    async () => {
      const all = await readDesignsFile()
      return all
        .filter((d) => d.customerEmail === normalized)
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
    }
  )
}

export async function getDesignForCustomer(
  email: string,
  designId: string
): Promise<SavedCustomerDesign | null> {
  const normalized = normalizeCustomerEmail(email)
  return withCosmosFallback(
    "getDesignForCustomer",
    () => cosmosGetDesignById(normalized, designId),
    async () => {
      const all = await readDesignsFile()
      const design = all.find(
        (d) => d.id === designId && d.customerEmail === normalized
      )
      return design ?? null
    }
  )
}

export async function saveDesign(
  design: SavedCustomerDesign
): Promise<SavedCustomerDesign> {
  const next: SavedCustomerDesign = {
    ...design,
    customerEmail: normalizeCustomerEmail(design.customerEmail),
    updatedAt: new Date().toISOString(),
  }

  await withCosmosFallback(
    "saveDesign",
    async () => {
      await cosmosUpsertDesign(next)
    },
    async () => {
      const all = await readDesignsFile()
      const index = all.findIndex((d) => d.id === next.id)
      if (index >= 0) all[index] = next
      else all.push(next)
      await writeDesignsFile(all)
    }
  )
  return next
}
