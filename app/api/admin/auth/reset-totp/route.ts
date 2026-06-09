import { NextResponse } from "next/server"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { getStaffById, saveStaff } from "@/lib/admin/staff-db"
import { encryptTotpSecret } from "@/lib/admin/totp-crypto"
import { createTotpQrDataUrl, generateTotpSecret } from "@/lib/admin/totp"

/** Neuen 2FA-Secret fuer eingeloggten Admin generieren (Profil-Einrichtung). */
export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const account = await getStaffById(auth.userId)
    if (!account) {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden." },
        { status: 404 }
      )
    }

    const secret = generateTotpSecret()
    const qrDataUrl = await createTotpQrDataUrl(account.role, secret)

    await saveStaff({
      ...account,
      totpSecretEncrypted: encryptTotpSecret(secret),
      totpEnabled: false,
    })

    return NextResponse.json({
      success: true,
      qrDataUrl,
      message:
        "Neuer QR-Code erstellt. Bestaetigen Sie die Einrichtung mit einem Code aus der App.",
    })
  } catch (error) {
    console.error("Admin-Auth: 2FA-Reset fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "2FA konnte nicht zurueckgesetzt werden." },
      { status: 500 }
    )
  }
}
