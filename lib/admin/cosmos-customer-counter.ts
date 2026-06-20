import { getSettingsContainer, isCosmosConfigured } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import {
  formatCustomerNumber,
  getCustomerNumberYearPrefix,
  getYearBaseSequence,
} from "@/lib/admin/customer-number-config"

type CustomerCounterDoc = {
  id: string
  yearPrefix: string
  lastSequence: number
  updatedAt: string
}

function counterDocId(yearPrefix: string): string {
  return `customer-counter-${yearPrefix}`
}

export async function cosmosAllocateCustomerSequence(
  initialLastSequence: number
): Promise<number> {
  const container = await getSettingsContainer()
  const yearPrefix = getCustomerNumberYearPrefix()
  const docId = counterDocId(yearPrefix)
  const maxAttempts = 10

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const { resource, etag } = await container
        .item(docId, docId)
        .read<CustomerCounterDoc>()

      if (!resource || !etag) {
        throw new Error("Counter-Dokument ohne ETag.")
      }

      const baseline = Math.max(resource.lastSequence, initialLastSequence)
      const nextSequence = baseline + 1
      const nextDoc: CustomerCounterDoc = {
        ...resource,
        lastSequence: nextSequence,
        updatedAt: new Date().toISOString(),
      }

      await container.item(docId, docId).replace(nextDoc, {
        accessCondition: { type: "IfMatch", condition: etag },
      })

      return nextSequence
    } catch (error) {
      const code = (error as { code?: number }).code

      if (code === 404) {
        const nextSequence = initialLastSequence + 1
        const doc: CustomerCounterDoc = {
          id: docId,
          yearPrefix,
          lastSequence: nextSequence,
          updatedAt: new Date().toISOString(),
        }

        try {
          await container.items.create(doc)
          return nextSequence
        } catch (createError) {
          const createCode = (createError as { code?: number }).code
          if (createCode === 409) continue
          logCosmosError(`cosmosAllocateCustomerSequence:create:${docId}`, createError)
          throw createError
        }
      }

      if (code === 412 || code === 449) {
        continue
      }

      logCosmosError(`cosmosAllocateCustomerSequence:${docId}`, error)
      throw error
    }
  }

  throw new Error("Kundennummer konnte nicht atomar vergeben werden.")
}

export function canUseCosmosCustomerCounter(): boolean {
  return isCosmosConfigured()
}

export function buildInitialCounterSequence(
  discoveredMax: number | null,
  referenceDate = new Date()
): number {
  const year = referenceDate.getFullYear()
  const baseSequence = getYearBaseSequence(year)
  return discoveredMax ?? baseSequence
}

export function buildAllocatedCustomerNumber(sequence: number): string {
  return formatCustomerNumber(getCustomerNumberYearPrefix(), sequence)
}
