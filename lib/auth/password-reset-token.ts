import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto"

export const RESET_TOKEN_TTL_SEC = 60 * 60

export type ResetAccountType = "customer" | "admin"

export type PasswordResetPayload = {
  type: ResetAccountType
  accountId: string
  exp: number
}

function getResetSecret(): string {
  return (
    process.env.PASSWORD_RESET_SECRET?.trim() ||
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.CUSTOMER_SESSION_SECRET?.trim() ||
    "dripforge-dev-password-reset-change-me"
  )
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

function sign(payloadB64: string): string {
  return createHmac("sha256", getResetSecret())
    .update(payloadB64)
    .digest("base64url")
}

export function createPasswordResetToken(input: {
  type: ResetAccountType
  accountId: string
}): { token: string; expiresAt: string; hash: string } {
  const exp = Math.floor(Date.now() / 1000) + RESET_TOKEN_TTL_SEC
  const payload: PasswordResetPayload = {
    type: input.type,
    accountId: input.accountId,
    exp,
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const token = `${payloadB64}.${sign(payloadB64)}`
  return {
    token,
    expiresAt: new Date(exp * 1000).toISOString(),
    hash: hashResetToken(token),
  }
}

export function parsePasswordResetToken(
  token: string | null | undefined
): PasswordResetPayload | null {
  if (!token?.includes(".")) return null
  const [payloadB64, signature] = token.split(".")
  if (!payloadB64 || !signature) return null

  const expected = sign(payloadB64)
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as PasswordResetPayload
    if (!payload.type || !payload.accountId || typeof payload.exp !== "number") {
      return null
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function verifyStoredResetToken(
  token: string,
  storedHash: string | null | undefined,
  storedExpiresAt: string | null | undefined
): PasswordResetPayload | null {
  const payload = parsePasswordResetToken(token)
  if (!payload) return null
  if (!storedHash || !storedExpiresAt) return null
  if (new Date(storedExpiresAt).getTime() < Date.now()) return null

  const hash = hashResetToken(token)
  const hashBuf = Buffer.from(hash, "hex")
  const storedBuf = Buffer.from(storedHash, "hex")
  if (hashBuf.length !== storedBuf.length || !timingSafeEqual(hashBuf, storedBuf)) {
    return null
  }

  return payload
}

export function generateTemporaryPassword(): string {
  const raw = randomBytes(12).toString("base64url")
  return `Df-${raw.slice(0, 10)}!`
}
