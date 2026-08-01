import { promises as fs } from "fs"
import path from "path"
import {
  cosmosGetIndividualPricingSettings,
  cosmosSaveIndividualPricingSettings,
} from "@/lib/admin/cosmos-individual-pricing"
import {
  mergeIndividualPricingSettings,
  sanitizeIndividualPricingSettings,
  type IndividualPricingSettings,
} from "@/lib/admin/individual-pricing-types"
import { withCosmosFallback } from "@/lib/admin/storage-bridge"
import { logCosmosError } from "@/lib/cosmos/log-error"

const DATA_DIR = path.join(process.cwd(), "data", "admin")
const FILE_NAME = "individual-pricing.json"

async function readFileSettings(): Promise<IndividualPricingSettings> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, FILE_NAME), "utf-8")
    return mergeIndividualPricingSettings(JSON.parse(raw) as IndividualPricingSettings)
  } catch {
    return mergeIndividualPricingSettings(null)
  }
}

async function writeFileSettings(
  settings: IndividualPricingSettings
): Promise<IndividualPricingSettings> {
  const sanitized = sanitizeIndividualPricingSettings(settings)
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(
    path.join(DATA_DIR, FILE_NAME),
    JSON.stringify(sanitized, null, 2),
    "utf-8"
  )
  return sanitized
}

export async function getIndividualPricingSettings(): Promise<IndividualPricingSettings> {
  try {
    return await withCosmosFallback(
      "getIndividualPricingSettings",
      cosmosGetIndividualPricingSettings,
      readFileSettings
    )
  } catch (error) {
    logCosmosError("getIndividualPricingSettings:total-failure", error)
    return mergeIndividualPricingSettings(null)
  }
}

export async function saveIndividualPricingSettings(
  settings: IndividualPricingSettings
): Promise<IndividualPricingSettings> {
  return withCosmosFallback(
    "saveIndividualPricingSettings",
    () => cosmosSaveIndividualPricingSettings(settings),
    () => writeFileSettings(settings)
  )
}
