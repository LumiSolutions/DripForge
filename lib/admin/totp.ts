import { generateSecret, generateURI, verifySync } from "otplib"
import QRCode from "qrcode"
import type { StaffRole } from "@/lib/admin/staff-types"

const ISSUER = "DripForge"

export function generateTotpSecret(): string {
  return generateSecret()
}

export function buildTotpUri(role: StaffRole, secret: string): string {
  const label = role === "admin" ? "DripForge Admin" : "DripForge Tester"
  return generateURI({
    issuer: ISSUER,
    label,
    secret,
  })
}

export async function createTotpQrDataUrl(
  role: StaffRole,
  secret: string
): Promise<string> {
  const uri = buildTotpUri(role, secret)
  return QRCode.toDataURL(uri, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 220,
  })
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const normalized = code.replace(/\s/g, "")
  if (!/^\d{6}$/.test(normalized)) return false
  try {
    const result = verifySync({
      secret,
      token: normalized,
      epochTolerance: 30,
    })
    return result.valid
  } catch {
    return false
  }
}
