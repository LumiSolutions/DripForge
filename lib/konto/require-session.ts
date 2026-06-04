import { cookies } from "next/headers"
import {
  CUSTOMER_SESSION_COOKIE,
  parseCustomerSessionToken,
} from "@/lib/konto/session-node"

export async function getCustomerSessionEmail(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value
  const session = parseCustomerSessionToken(token)
  return session?.email ?? null
}

export async function requireCustomerSessionEmail(): Promise<string> {
  const email = await getCustomerSessionEmail()
  if (!email) {
    throw new Error("UNAUTHORIZED")
  }
  return email
}
