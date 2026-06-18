import { getStaffAccountsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import type { StaffAccount } from "@/lib/admin/staff-types"

function cosmosErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  const err = error as { code?: number; statusCode?: number }
  return err.code ?? err.statusCode
}

export async function cosmosGetStaffById(
  id: StaffAccount["id"]
): Promise<StaffAccount | null> {
  const container = await getStaffAccountsContainer()
  try {
    const { resource } = await container.item(id, id).read<StaffAccount>()
    return resource ?? null
  } catch (error) {
    if (cosmosErrorCode(error) === 404) return null
    logCosmosError(`cosmosGetStaffById:${id}`, error)
    throw error
  }
}

export async function cosmosUpsertStaff(account: StaffAccount): Promise<StaffAccount> {
  const container = await getStaffAccountsContainer()
  const doc = { ...account, id: account.id }
  await container.items.upsert(doc)
  return doc
}
