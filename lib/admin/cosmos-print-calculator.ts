import { getSettingsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  mergePrintCalculatorSettings,
  PRINT_CALCULATOR_DOC_ID,
  PRINT_CALCULATOR_DOC_TYPE,
  sanitizePrintCalculatorSettings,
  type PrintCalculatorSettings,
} from "@/lib/admin/print-calculator-types"

type PrintCalculatorCosmosDoc = PrintCalculatorSettings & {
  id: string
  docType: string
}

export async function cosmosGetPrintCalculatorSettings(): Promise<PrintCalculatorSettings> {
  const container = await getSettingsContainer()
  try {
    const { resource } = await container
      .item(PRINT_CALCULATOR_DOC_ID, PRINT_CALCULATOR_DOC_ID)
      .read<PrintCalculatorCosmosDoc>()
    if (resource?.docType === PRINT_CALCULATOR_DOC_TYPE) {
      return mergePrintCalculatorSettings(resource)
    }
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code !== 404) {
      logCosmosError("cosmosGetPrintCalculatorSettings", error)
      throw error
    }
  }
  return mergePrintCalculatorSettings(null)
}

export async function cosmosSavePrintCalculatorSettings(
  settings: PrintCalculatorSettings
): Promise<PrintCalculatorSettings> {
  const container = await getSettingsContainer()
  const sanitized = sanitizePrintCalculatorSettings({
    ...settings,
    updatedAt: new Date().toISOString(),
  })
  const doc: PrintCalculatorCosmosDoc = {
    id: PRINT_CALCULATOR_DOC_ID,
    docType: PRINT_CALCULATOR_DOC_TYPE,
    ...sanitized,
  }
  await container.items.upsert(doc)
  return sanitized
}
