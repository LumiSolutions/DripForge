import { getSettingsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  INDIVIDUAL_PRICING_DOC_ID,
  INDIVIDUAL_PRICING_DOC_TYPE,
  mergeIndividualPricingSettings,
  sanitizeIndividualPricingSettings,
  type IndividualPricingSettings,
} from "@/lib/admin/individual-pricing-types"

type IndividualPricingCosmosDoc = IndividualPricingSettings & {
  id: string
  docType: string
}

export async function cosmosGetIndividualPricingSettings(): Promise<IndividualPricingSettings> {
  const container = await getSettingsContainer()
  try {
    const { resource } = await container
      .item(INDIVIDUAL_PRICING_DOC_ID, INDIVIDUAL_PRICING_DOC_ID)
      .read<IndividualPricingCosmosDoc>()
    if (resource?.docType === INDIVIDUAL_PRICING_DOC_TYPE) {
      return mergeIndividualPricingSettings(resource)
    }
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code !== 404) {
      logCosmosError("cosmosGetIndividualPricingSettings", error)
      throw error
    }
  }
  // Fehlendes Dokument: Defaults nur im Speicher — kein Auto-Write.
  return mergeIndividualPricingSettings(null)
}

export async function cosmosSaveIndividualPricingSettings(
  settings: IndividualPricingSettings
): Promise<IndividualPricingSettings> {
  const container = await getSettingsContainer()
  const sanitized = sanitizeIndividualPricingSettings({
    ...settings,
    updatedAt: new Date().toISOString(),
  })
  const doc: IndividualPricingCosmosDoc = {
    id: INDIVIDUAL_PRICING_DOC_ID,
    docType: INDIVIDUAL_PRICING_DOC_TYPE,
    ...sanitized,
  }
  await container.items.upsert(doc)
  return sanitized
}
