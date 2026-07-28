import { getCustomersSnapshot } from "@/lib/admin/customer-store"
import {
  buildAllocatedCustomerNumber,
  buildInitialCounterSequence,
  canUseCosmosCustomerCounter,
  cosmosAllocateCustomerSequence,
} from "@/lib/admin/cosmos-customer-counter"
import {
  findMaxSequenceInPool,
  formatCustomerNumber,
  getCustomerNumberYearPrefix,
  getYearBaseSequence,
  isModernCustomerNumber,
} from "@/lib/admin/customer-number-config"
import { generateCustomerNumber } from "@/lib/admin/customers"
import { listAllAccounts } from "@/lib/konto/account-db"

async function collectNumberPool(): Promise<Array<{ kundennummer: string }>> {
  const customers = await getCustomersSnapshot()
  const accounts = await listAllAccounts()
  return [
    ...customers.map((customer) => ({ kundennummer: customer.kundennummer })),
    ...accounts
      .filter((account) => account.kundennummer)
      .map((account) => ({ kundennummer: account.kundennummer! })),
  ]
}

export async function isKundennummerTaken(
  kundennummer: string
): Promise<boolean> {
  const pool = await collectNumberPool()
  return pool.some((entry) => entry.kundennummer === kundennummer)
}

async function discoverMaxSequenceForCurrentYear(): Promise<number | null> {
  const yearPrefix = getCustomerNumberYearPrefix()
  const pool = await collectNumberPool()
  return findMaxSequenceInPool(pool, yearPrefix)
}

async function allocateWithCosmosCounter(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const discoveredMax = await discoverMaxSequenceForCurrentYear()
    const initialLastSequence = buildInitialCounterSequence(discoveredMax)
    const sequence = await cosmosAllocateCustomerSequence(initialLastSequence)
    const candidate = buildAllocatedCustomerNumber(sequence)

    if (!(await isKundennummerTaken(candidate))) {
      assertModernCustomerNumber(candidate)
      return candidate
    }
  }

  throw new Error("Kundennummer-Kollision nach mehreren Versuchen.")
}

async function allocateFromLocalPool(): Promise<string> {
  const pool = await collectNumberPool()
  return generateCustomerNumber(pool)
}

function assertModernCustomerNumber(kundennummer: string): void {
  if (!isModernCustomerNumber(kundennummer)) {
    throw new Error(`Ungültiges Kundennummern-Format: ${kundennummer}`)
  }
}

/**
 * Vergibt die nächste eindeutige Kundennummer im Format YY-#####.
 * Cosmos: atomarer Counter mit ETag; lokal: Pool-basierte +1-Logik.
 */
export async function allocateNextCustomerNumber(): Promise<string> {
  let candidate: string | null = null

  if (canUseCosmosCustomerCounter()) {
    try {
      candidate = await allocateWithCosmosCounter()
    } catch (error) {
      console.error(
        "Kundennummer: Cosmos-Counter fehlgeschlagen, Fallback auf Pool.",
        error
      )
    }
  }

  if (!candidate) {
    candidate = await allocateFromLocalPool()
  }

  assertModernCustomerNumber(candidate)

  if (!(await isKundennummerTaken(candidate))) {
    return candidate
  }

  const yearPrefix = getCustomerNumberYearPrefix()
  const year = new Date().getFullYear()
  const baseSequence = getYearBaseSequence(year)
  const max = (await discoverMaxSequenceForCurrentYear()) ?? baseSequence

  for (let offset = 1; offset <= 50; offset++) {
    const retry = formatCustomerNumber(yearPrefix, max + offset)
    assertModernCustomerNumber(retry)
    if (!(await isKundennummerTaken(retry))) {
      return retry
    }
  }

  throw new Error("Keine freie Kundennummer gefunden.")
}
