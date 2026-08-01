import { createHmac, timingSafeEqual } from "crypto"
import type {
  AdminPendingPayload,
  AdminSessionPayload,
  StaffAuthIntent,
  StaffRole,
} from "@/lib/admin/staff-types"
import { normalizeStaffRole } from "@/lib/admin/staff-types"
import { resolveSigningSecret } from "@/lib/security/env-secrets"

export const ADMIN_SESSION_COOKIE = "dripforge_admin_session"
export const ADMIN_PENDING_COOKIE = "dripforge_admin_pending"
export const ADMIN_SESSION_MAX_AGE_SEC = 60 * 60 * 8
export const ADMIN_PENDING_MAX_AGE_SEC = 60 * 10

function getSessionSecret(): string {
  return resolveSigningSecret(
    "Admin-Session-Secret",
    "ADMIN_SESSION_SECRET",
    "CUSTOMER_SESSION_SECRET"
  )
}

function sign(payloadB64: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(payloadB64)
    .digest("base64url")
}

function verifySignedToken<T>(token: string | undefined | null): T | null {
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
    return JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as T
  } catch {
    return null
  }
}

export function createAdminSessionToken(input: {
  userId: StaffRole
  role: StaffRole
  twoFactorVerified: boolean
}): string {
  const payload: AdminSessionPayload = {
    userId: input.userId,
    role: input.role,
    twoFactorVerified: input.twoFactorVerified,
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SEC,
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${payloadB64}.${sign(payloadB64)}`
}

export function createAdminPendingToken(input: {
  userId: StaffRole
  role: StaffRole
  intent: StaffAuthIntent
}): string {
  const payload: AdminPendingPayload = {
    userId: input.userId,
    role: input.role,
    intent: input.intent,
    exp: Math.floor(Date.now() / 1000) + ADMIN_PENDING_MAX_AGE_SEC,
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${payloadB64}.${sign(payloadB64)}`
}

export function parseAdminSessionToken(
  token: string | undefined | null
): AdminSessionPayload | null {
  const payload = verifySignedToken<AdminSessionPayload>(token)
  if (!payload) return null
  if (typeof payload.exp !== "number") return null
  if (payload.exp < Math.floor(Date.now() / 1000)) return null
  const role =
    normalizeStaffRole(payload.role) ?? normalizeStaffRole(payload.userId)
  if (!role) return null
  return {
    ...payload,
    userId: role,
    role,
  }
}

export function parseAdminPendingToken(
  token: string | undefined | null
): AdminPendingPayload | null {
  const payload = verifySignedToken<AdminPendingPayload>(token)
  if (!payload) return null
  if (typeof payload.exp !== "number") return null
  if (!payload.intent) return null
  if (payload.exp < Math.floor(Date.now() / 1000)) return null
  const role =
    normalizeStaffRole(payload.role) ?? normalizeStaffRole(payload.userId)
  if (!role) return null
  return {
    ...payload,
    userId: role,
    role,
  }
}

function readCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get("cookie") ?? ""
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  const raw = match?.[1]
  if (!raw) return undefined
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export function getAdminSessionFromRequest(
  request: Request
): AdminSessionPayload | null {
  return parseAdminSessionToken(readCookie(request, ADMIN_SESSION_COOKIE))
}

export function getAdminPendingFromRequest(
  request: Request
): AdminPendingPayload | null {
  return parseAdminPendingToken(readCookie(request, ADMIN_PENDING_COOKIE))
}

export function adminSessionCookieOptions(maxAge = ADMIN_SESSION_MAX_AGE_SEC) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  }
}

export function adminPendingCookieOptions(maxAge = ADMIN_PENDING_MAX_AGE_SEC) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  }
}

export function clearAdminSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  }
}
