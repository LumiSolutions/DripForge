import { getProjectSupportersContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  SUPPORTER_DOC_TYPE,
  type ProjectSupporter,
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

export async function cosmosGetTotalSupportRaisedChf(): Promise<number> {
  const container = await getProjectSupportersContainer()
  const { resources } = await container.items
    .query<{ total: number }>({
      query: `
        SELECT VALUE SUM(c.amountChf)
        FROM c
        WHERE c.docType = @docType AND c.status = "completed"
      `,
      parameters: [{ name: "@docType", value: SUPPORTER_DOC_TYPE }],
    })
    .fetchAll()

  const total = resources[0]
  return typeof total === "number" && Number.isFinite(total) ? total : 0
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
