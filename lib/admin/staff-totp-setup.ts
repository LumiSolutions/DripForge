import { getStaffById, saveStaff } from "@/lib/admin/staff-db"
import type { StaffAccount, StaffRole } from "@/lib/admin/staff-types"
import { createTotpQrDataUrl, generateTotpSecret } from "@/lib/admin/totp"
import { decryptTotpSecret, encryptTotpSecret } from "@/lib/admin/totp-crypto"

export type TotpSetupMaterial = {
  qrDataUrl: string
  secretBase32: string
  isNewSecret: boolean
}

export class TotpSecretError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TotpSecretError"
  }
}

/** Prüft, ob ein entschlüsselbares TOTP-Secret in Cosmos hinterlegt ist. */
export function staffHasPersistedTotpSecret(account: StaffAccount): boolean {
  if (!account.totpSecretEncrypted) return false
  return decryptTotpSecret(account.totpSecretEncrypted) !== null
}

/**
 * Liefert QR + Base32. Erzeugt das Secret nur beim allerersten Setup (oder bei forceNew)
 * und speichert es sofort in CosmosDB.
 */
export async function getTotpSetupMaterial(
  account: StaffAccount,
  options?: { forceNew?: boolean }
): Promise<{ account: StaffAccount; material: TotpSetupMaterial }> {
  const forceNew = options?.forceNew === true

  if (!forceNew && account.totpSecretEncrypted) {
    const existing = decryptTotpSecret(account.totpSecretEncrypted)
    if (existing) {
      const qrDataUrl = await createTotpQrDataUrl(account.role, existing)
      return {
        account,
        material: {
          qrDataUrl,
          secretBase32: existing,
          isNewSecret: false,
        },
      }
    }

    throw new TotpSecretError(
      "Gespeichertes 2FA-Secret konnte nicht gelesen werden. Bitte ADMIN_2FA_ENCRYPTION_KEY prüfen oder 2FA im Portal zurücksetzen."
    )
  }

  const secret = generateTotpSecret()
  const qrDataUrl = await createTotpQrDataUrl(account.role, secret)

  const updated = await saveStaff({
    ...account,
    totpSecretEncrypted: encryptTotpSecret(secret),
    totpEnabled: false,
  })

  return {
    account: updated,
    material: {
      qrDataUrl,
      secretBase32: secret,
      isNewSecret: true,
    },
  }
}

/** Entfernt 2FA-Secret und deaktiviert TOTP (für Neu-Einrichtung). */
export async function clearStaff2fa(role: StaffRole): Promise<StaffAccount | null> {
  const account = await getStaffById(role)
  if (!account) return null
  return saveStaff({
    ...account,
    totpSecretEncrypted: null,
    totpEnabled: false,
  })
}

export async function clearAllStaff2fa(): Promise<{ cleared: StaffRole[] }> {
  const roles: StaffRole[] = ["admin", "tester"]
  const cleared: StaffRole[] = []
  for (const role of roles) {
    const result = await clearStaff2fa(role)
    if (result) cleared.push(role)
  }
  return { cleared }
}

/** Lädt das gespeicherte TOTP-Secret für die Code-Validierung. */
export function loadStaffTotpSecret(account: StaffAccount): string | null {
  if (!account.totpSecretEncrypted) return null
  return decryptTotpSecret(account.totpSecretEncrypted)
}
