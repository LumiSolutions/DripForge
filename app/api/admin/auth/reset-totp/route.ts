import { NextResponse } from "next/server"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { getStaffById } from "@/lib/admin/staff-db"
import { getTotpSetupMaterial, TotpSecretError } from "@/lib/admin/staff-totp-setup"

/** 2FA-Einrichtung im Profil: bestehendes Secret wiederverwenden oder bei force neu erzeugen. */
export async function POST(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const body = (await request.json().catch(() => ({}))) as { force?: boolean }
    const forceNew = body.force === true

    const account = await getStaffById(auth.userId)
    if (!account) {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden." },
        { status: 404 }
      )
    }

    if (account.totpEnabled && !forceNew) {
      return NextResponse.json(
        { error: "2FA ist bereits aktiv. Nutzen Sie «2FA neu einrichten»." },
        { status: 400 }
      )
    }

    if (forceNew && account.totpEnabled) {
      const confirmed = request.headers.get("x-confirm-reset") === "1"
      if (!confirmed) {
        return NextResponse.json(
          {
            error:
              "Aktive 2FA kann nur mit Bestätigung zurückgesetzt werden (Header x-confirm-reset).",
          },
          { status: 400 }
        )
      }
    }

    const { material } = await getTotpSetupMaterial(account, {
      forceNew,
    })

    return NextResponse.json({
      success: true,
      qrDataUrl: material.qrDataUrl,
      secretBase32: material.secretBase32,
      isNewSecret: material.isNewSecret,
      message: material.isNewSecret
        ? "Neuer QR-Code erstellt. Bestaetigen Sie die Einrichtung mit einem Code aus der App."
        : "Bestehender QR-Code. Beide Geräte können nacheinander scannen oder den Schlüssel manuell eintragen.",
    })
  } catch (error) {
    if (error instanceof TotpSecretError) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    console.error("Admin-Auth: 2FA-Reset fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "2FA konnte nicht zurückgesetzt werden." },
      { status: 500 }
    )
  }
}
