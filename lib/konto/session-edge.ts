import type { CustomerSessionPayload } from "@/lib/konto/account-types"

export const CUSTOMER_SESSION_COOKIE = "dripforge_customer_session"

const KONTO_PUBLIC_PATHS = ["/konto/login", "/konto/registrieren"]

export function isKontoPublicPath(pathname: string): boolean {
  return KONTO_PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
}

function getSessionSecret(): string {
  return (
    process.env.CUSTOMER_SESSION_SECRET?.trim() ||
    process.env.NEXT_PUBLIC_CUSTOMER_SESSION_SECRET?.trim() ||
    "dripforge-dev-customer-session-change-me"
  )
}

function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}

async function signPayload(payloadB64: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64)
  )
  return bufferToBase64Url(sig)
}

export async function parseCustomerSessionEdge(
  token: string | undefined | null
): Promise<CustomerSessionPayload | null> {
  if (!token?.includes(".")) return null

  const [payloadB64, signature] = token.split(".")
  if (!payloadB64 || !signature) return null

  const expected = await signPayload(payloadB64)
  if (!constantTimeEqual(signature, expected)) return null

  try {
    const padded =
      payloadB64 + "=".repeat((4 - (payloadB64.length % 4)) % 4)
    const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"))
    const payload = JSON.parse(json) as CustomerSessionPayload
    if (!payload.email || typeof payload.exp !== "number") return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return { email: payload.email.trim().toLowerCase(), exp: payload.exp }
  } catch {
    return null
  }
}
