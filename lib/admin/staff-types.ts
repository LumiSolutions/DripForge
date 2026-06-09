export type StaffRole = "admin" | "tester"

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
