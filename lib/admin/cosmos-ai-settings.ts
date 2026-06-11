import { getSettingsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  AI_SETTINGS_DOC_ID,
  AI_SETTINGS_DOC_TYPE,
  mergeAiSettings,
  sanitizeAiSettingsInput,
  type AiSettingsDocument,
} from "@/lib/ai/ai-settings-types"

type AiSettingsCosmosDoc = AiSettingsDocument & {
  id: string
  docType: string
}

export async function cosmosGetAiSettings(): Promise<AiSettingsDocument> {
  const container = await getSettingsContainer()
  try {
    const { resource } = await container
      .item(AI_SETTINGS_DOC_ID, AI_SETTINGS_DOC_ID)
      .read<AiSettingsCosmosDoc>()
    if (resource?.docType === AI_SETTINGS_DOC_TYPE) {
      return mergeAiSettings(resource)
    }
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code !== 404) {
      logCosmosError("cosmosGetAiSettings", error)
      throw error
    }
  }
  return mergeAiSettings(null)
}

export async function cosmosSaveAiSettings(
  settings: AiSettingsDocument
): Promise<AiSettingsDocument> {
  const container = await getSettingsContainer()
  const sanitized = sanitizeAiSettingsInput(settings)
  const doc: AiSettingsCosmosDoc = {
    id: AI_SETTINGS_DOC_ID,
    docType: AI_SETTINGS_DOC_TYPE,
    categories: sanitized.categories,
    updatedAt: sanitized.updatedAt,
  }
  await container.items.upsert(doc)
  return sanitized
}
