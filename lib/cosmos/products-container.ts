import type { Container } from "@azure/cosmos"
import { ensureDatabase, getSettingsContainer } from "@/lib/cosmos/client"

export const PRODUCT_DOC_TYPE = "product"

export type ProductsStorageMode = "dedicated" | "shared"

type ProductsContainerState = {
  container: Container
  mode: ProductsStorageMode
}

let resolved: ProductsContainerState | null = null

/**
 * Produkte-Container: dediziert wenn vorhanden, sonst Fallback auf
 * den bestehenden settings-Container (wichtig bei Cosmos RU-Limits).
 */
export async function resolveProductsContainer(): Promise<ProductsContainerState> {
  if (resolved) return resolved

  const database = await ensureDatabase()

  try {
    const dedicated = database.container("products")
    await dedicated.read()
    resolved = { container: dedicated, mode: "dedicated" }
    console.info("Cosmos DB: Produkte-Container 'products' aktiv.")
    return resolved
  } catch {
    const shared = await getSettingsContainer()
    resolved = { container: shared, mode: "shared" }
    console.warn(
      "Cosmos DB: Container 'products' nicht verfügbar — Produkte werden im Container 'settings' (docType=product) gespeichert."
    )
    return resolved
  }
}

export function productsQuerySql(mode: ProductsStorageMode): string {
  return mode === "shared"
    ? `SELECT * FROM c WHERE c.docType = '${PRODUCT_DOC_TYPE}'`
    : "SELECT * FROM c"
}

export function toProductCosmosDoc<T extends { id: string }>(
  product: T,
  mode: ProductsStorageMode
): T & { docType?: string } {
  if (mode === "shared") {
    return { ...product, docType: PRODUCT_DOC_TYPE }
  }
  return product
}

export function resetProductsContainerCache(): void {
  resolved = null
}
