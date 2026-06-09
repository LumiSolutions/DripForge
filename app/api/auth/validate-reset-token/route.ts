import { NextResponse } from "next/server"
import {
  parsePasswordResetToken,
  verifyStoredResetToken,
} from "@/lib/auth/password-reset-token"
import { getStaffById } from "@/lib/admin/staff-db"
import { getAccountByEmail } from "@/lib/konto/account-db"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get("token")?.trim() ?? ""

  if (!token) {
    return NextResponse.json({ valid: false }, { status: 400 })
  }

  const payload = parsePasswordResetToken(token)
  if (!payload) {
    return NextResponse.json({ valid: false }, { status: 400 })
  }

  if (payload.type === "admin") {
    const account = await getStaffById("admin")
    const verified = verifyStoredResetToken(
      token,
      account?.passwordResetTokenHash,
      account?.passwordResetExpiresAt
    )
    return NextResponse.json({
      valid: Boolean(verified),
      type: "admin",
      requiresTotp: Boolean(account?.totpEnabled),
    })
  }

  const account = await getAccountByEmail(payload.accountId)
  const verified = verifyStoredResetToken(
    token,
    account?.passwordResetTokenHash,
    account?.passwordResetExpiresAt
  )

  return NextResponse.json({
    valid: Boolean(verified),
    type: "customer",
    requiresTotp: false,
  })
}
