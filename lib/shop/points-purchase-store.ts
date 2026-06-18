import { getSettingsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"

const DOC_TYPE = "points-purchase-pending"

export type PendingPointsPurchase = {
  purchaseId: string
  email: string
  points: number
  amountChf: number
  createdAt: string
}

type PendingPointsPurchaseDoc = PendingPointsPurchase & {
  id: string
  docType: typeof DOC_TYPE
}

function docId(purchaseId: string): string {
  return `points-purchase-${purchaseId}`
}

export async function savePendingPointsPurchase(
  purchase: PendingPointsPurchase
): Promise<void> {
  const container = await getSettingsContainer()
  const doc: PendingPointsPurchaseDoc = {
    ...purchase,
    id: docId(purchase.purchaseId),
    docType: DOC_TYPE,
  }
  await container.items.upsert(doc)
}

export async function getPendingPointsPurchase(
  purchaseId: string
): Promise<PendingPointsPurchase | null> {
  const container = await getSettingsContainer()
  try {
    const id = docId(purchaseId)
    const { resource } = await container.item(id, id).read<PendingPointsPurchaseDoc>()
    if (!resource || resource.docType !== DOC_TYPE) return null
    return {
      purchaseId: resource.purchaseId,
      email: resource.email,
      points: resource.points,
      amountChf: resource.amountChf,
      createdAt: resource.createdAt,
    }
  } catch (error) {
    if ((error as { code?: number }).code === 404) return null
    logCosmosError(`getPendingPointsPurchase:${purchaseId}`, error)
    throw error
  }
}

export async function deletePendingPointsPurchase(purchaseId: string): Promise<void> {
  const container = await getSettingsContainer()
  try {
    const id = docId(purchaseId)
    await container.item(id, id).delete()
  } catch (error) {
    if ((error as { code?: number }).code === 404) return
    logCosmosError(`deletePendingPointsPurchase:${purchaseId}`, error)
  }
}
