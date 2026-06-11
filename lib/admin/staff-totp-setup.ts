import { getStaffById, saveStaff } from "@/lib/admin/staff-db"
import type { StaffAccount, StaffRole } from "@/lib/admin/staff-types"
import { createTotpQrDataUrl, generateTotpSecret } from "@/lib/admin/totp"
import { decryptTotpSecret, encryptTotpSecret } from "@/lib/admin/totp-crypto"

export type TotpSetupMaterial = {
  qrDataUrl: string
  secretBase32: string
  isNewSecret: boolean
}

/** Liefert QR + Base32; erzeugt das Secret nur beim allerersten Setup (oder bei forceNew). */
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
  }

  const secret = generateTotpSecret()
  const updated = await saveStaff({
    ...account,
    totpSecretEncrypted: encryptTotpSecret(secret),
    totpEnabled: false,
  })
  const qrDataUrl = await createTotpQrDataUrl(updated.role, secret)
  return {
    account: updated,
    material: {
      qrDataUrl,
      secretBase32: secret,
      isNewSecret: true,
    },
  }
}

/** Entfernt 2FA-Secret und deaktiviert TOTP (fuer Neu-Einrichtung). */
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
