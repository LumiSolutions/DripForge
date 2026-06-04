import { cookies } from "next/headers"
import {
  CUSTOMER_SESSION_COOKIE,
  parseCustomerSessionToken,
} from "@/lib/konto/session-node"

export async function getSessionEmailFromRequest(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value
  return parseCustomerSessionToken(token)?.email ?? null
}
