import { getSettingsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  LASER_CONFIGURATOR_DOC_ID,
  LASER_CONFIGURATOR_DOC_TYPE,
  mergeLaserConfiguratorSettings,
  sanitizeLaserConfiguratorSettings,
  type LaserConfiguratorSettings,
} from "@/lib/admin/laser-configurator-types"

type LaserConfiguratorCosmosDoc = LaserConfiguratorSettings & {
  id: string
  docType: string
}

export async function cosmosGetLaserConfiguratorSettings(): Promise<LaserConfiguratorSettings> {
  const container = await getSettingsContainer()
  try {
    const { resource } = await container
      .item(LASER_CONFIGURATOR_DOC_ID, LASER_CONFIGURATOR_DOC_ID)
      .read<LaserConfiguratorCosmosDoc>()
    if (resource?.docType === LASER_CONFIGURATOR_DOC_TYPE) {
      return mergeLaserConfiguratorSettings(resource)
    }
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code !== 404) {
      logCosmosError("cosmosGetLaserConfiguratorSettings", error)
      throw error
    }
  }
  return mergeLaserConfiguratorSettings(null)
}

export async function cosmosSaveLaserConfiguratorSettings(
  settings: LaserConfiguratorSettings
): Promise<LaserConfiguratorSettings> {
  const container = await getSettingsContainer()
  const sanitized = sanitizeLaserConfiguratorSettings({
    ...settings,
    updatedAt: new Date().toISOString(),
  })
  const doc: LaserConfiguratorCosmosDoc = {
    id: LASER_CONFIGURATOR_DOC_ID,
    docType: LASER_CONFIGURATOR_DOC_TYPE,
    ...sanitized,
  }
  await container.items.upsert(doc)
  return sanitized
}
