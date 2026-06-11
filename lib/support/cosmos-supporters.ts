import { getProjectSupportersContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  emptyCategoryTotals,
  normalizeSupportCategory,
  SUPPORTER_DOC_TYPE,
  type ProjectSupporter,
  type SupportCategoryId,
  type SupportCategoryTotals,
} from "@/lib/support/types"

type SupporterCosmosDoc = ProjectSupporter

export async function cosmosSaveProjectSupporter(
  supporter: ProjectSupporter
): Promise<ProjectSupporter> {
  const container = await getProjectSupportersContainer()
  await container.items.upsert(supporter)
  return supporter
}

export async function cosmosGetProjectSupporterBySessionId(
  stripeSessionId: string
): Promise<ProjectSupporter | null> {
  const trimmed = stripeSessionId?.trim()
  if (!trimmed) return null

  const container = await getProjectSupportersContainer()
  try {
    const { resource } = await container
      .item(trimmed, trimmed)
      .read<SupporterCosmosDoc>()
    if (!resource || resource.docType !== SUPPORTER_DOC_TYPE) return null
    return resource
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return null
    logCosmosError(`cosmosGetProjectSupporterBySessionId:${trimmed}`, error)
    throw error
  }
}

export async function cosmosGetSupportCategoryTotals(): Promise<SupportCategoryTotals> {
  const container = await getProjectSupportersContainer()
  const { resources } = await container.items
    .query<Pick<ProjectSupporter, "category" | "amountChf">>({
      query: `
        SELECT c.category, c.amountChf FROM c
        WHERE c.docType = @docType AND c.status = "completed"
      `,
      parameters: [{ name: "@docType", value: SUPPORTER_DOC_TYPE }],
    })
    .fetchAll()

  const totals = emptyCategoryTotals()
  for (const row of resources) {
    const category = normalizeSupportCategory(row.category ?? "general")
    const amount = Number(row.amountChf)
    if (Number.isFinite(amount)) {
      totals[category] += amount
    }
  }
  return totals
}

export async function cosmosGetTotalSupportRaisedChf(): Promise<number> {
  const totals = await cosmosGetSupportCategoryTotals()
  return totals.general + totals.materials + totals.printer + totals.laser
}

export async function cosmosGetProjectSupporters(): Promise<ProjectSupporter[]> {
  const container = await getProjectSupportersContainer()
  const { resources } = await container.items
    .query<SupporterCosmosDoc>({
      query: `
        SELECT * FROM c
        WHERE c.docType = @docType
        ORDER BY c.createdAt DESC
      `,
      parameters: [{ name: "@docType", value: SUPPORTER_DOC_TYPE }],
    })
    .fetchAll()
  return resources
}
