export type StaffRole = "admin" | "tester"

/** Normalisiert Rollen aus Session/Cookie (z. B. "ADMIN" → "admin"). */
export function normalizeStaffRole(value: unknown): StaffRole | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
  if (normalized === "admin" || normalized === "tester") return normalized
  return null
}

export type StaffAccount = {
  /** Feste ID: "admin" oder "tester" */
  id: StaffRole
  role: StaffRole
  passwordHash: string
  /** AES-256-GCM verschluesselter TOTP-Secret */
  totpSecretEncrypted: string | null
  totpEnabled: boolean
  passwordResetTokenHash?: string | null
  passwordResetExpiresAt?: string | null
  createdAt: string
  updatedAt: string
}

export type StaffAuthIntent = "admin" | "preview"

export type AdminSessionPayload = {
  userId: StaffRole
  role: StaffRole
  twoFactorVerified: boolean
  exp: number
}

export type AdminPendingPayload = {
  userId: StaffRole
  role: StaffRole
  intent: StaffAuthIntent
  exp: number
}
