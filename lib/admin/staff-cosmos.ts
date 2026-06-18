import { getSettingsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import type { StaffAccount, StaffRole } from "@/lib/admin/staff-types"

const STAFF_DOC_TYPE = "staff-account"

function staffCosmosId(role: StaffRole): string {
  return `staff-${role}`
}

function cosmosErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  const err = error as { code?: number; statusCode?: number }
  return err.code ?? err.statusCode
}

type StaffCosmosDoc = Omit<StaffAccount, "id"> & {
  id: string
  docType: typeof STAFF_DOC_TYPE
}

function toCosmosDoc(account: StaffAccount): StaffCosmosDoc {
  return {
    ...account,
    id: staffCosmosId(account.role),
    docType: STAFF_DOC_TYPE,
  }
}

function fromCosmosDoc(doc: StaffCosmosDoc): StaffAccount {
  return {
    id: doc.role,
    role: doc.role,
    passwordHash: doc.passwordHash,
    totpSecretEncrypted: doc.totpSecretEncrypted,
    totpEnabled: doc.totpEnabled,
    passwordResetTokenHash: doc.passwordResetTokenHash,
    passwordResetExpiresAt: doc.passwordResetExpiresAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

export async function cosmosGetStaffById(
  id: StaffAccount["id"]
): Promise<StaffAccount | null> {
  const container = await getSettingsContainer()
  try {
    const { resource } = await container
      .item(staffCosmosId(id), staffCosmosId(id))
      .read<StaffCosmosDoc>()
    return resource ? fromCosmosDoc(resource) : null
  } catch (error) {
    if (cosmosErrorCode(error) === 404) return null
    logCosmosError(`cosmosGetStaffById:${id}`, error)
    throw error
  }
}

export async function cosmosUpsertStaff(account: StaffAccount): Promise<StaffAccount> {
  const container = await getSettingsContainer()
  const doc = toCosmosDoc(account)
  await container.items.upsert(doc)
  return account
}
