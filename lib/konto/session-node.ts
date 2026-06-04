/**
 * Node-only Session (API-Routen). Middleware nutzt session-edge.ts (Web Crypto).
 * Beide muessen dasselbe CUSTOMER_SESSION_SECRET verwenden.
 */
import { createHmac, timingSafeEqual } from "crypto"
import type { CustomerSessionPayload } from "@/lib/konto/account-types"

export const CUSTOMER_SESSION_COOKIE = "dripforge_customer_session"
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30

function getSessionSecret(): string {
  return (
    process.env.CUSTOMER_SESSION_SECRET?.trim() ||
    process.env.NEXT_PUBLIC_CUSTOMER_SESSION_SECRET?.trim() ||
    "dripforge-dev-customer-session-change-me"
  )
}

function sign(payloadB64: string): string {
  return createHmac("sha256", getSessionSecret()).update(payloadB64).digest("base64url")
}

export function createCustomerSessionToken(email: string): string {
  const payload: CustomerSessionPayload = {
    email: email.trim().toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC,
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${payloadB64}.${sign(payloadB64)}`
}

export function parseCustomerSessionToken(
  token: string | undefined | null
): CustomerSessionPayload | null {
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
    ) as CustomerSessionPayload
    if (!payload.email || typeof payload.exp !== "number") return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return { email: payload.email.trim().toLowerCase(), exp: payload.exp }
  } catch {
    return null
  }
}

export function customerSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  }
}
