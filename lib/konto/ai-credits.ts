import { normalizeCustomerEmail } from "@/lib/admin/customers"
import { getAccountByEmail, saveAccount } from "@/lib/konto/account-db"
import type { CustomerAccount } from "@/lib/konto/account-types"

export const CUSTOMER_DOC_TYPE = "user" as const
export const WELCOME_AI_CREDITS = 1

/** Staffelung: höchste passende Stufe gilt (nicht kumulativ). */
const CREDIT_TIERS: { minChf: number; credits: number }[] = [
  { minChf: 100, credits: 8 },
  { minChf: 50, credits: 3 },
  { minChf: 20, credits: 1 },
]

export function normalizeAiCredits(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.floor(n))
}

export function calculateAiCreditsForOrderTotal(totalChf: number): number {
  const amount = Number(totalChf)
  if (!Number.isFinite(amount) || amount < 20) return 0
  for (const tier of CREDIT_TIERS) {
    if (amount >= tier.minChf) return tier.credits
  }
  return 0
}

function ensureGrantMap(account: CustomerAccount): Record<string, number> {
  return { ...(account.aiCreditGrants ?? {}) }
}

export type GrantAiCreditsResult = {
  granted: boolean
  credits: number
  newBalance: number
  reason?: string
}

/** Idempotente Gutschrift (z. B. orderId oder Stripe-Session-ID als referenceId). */
export async function grantAiCreditsForPaidOrder(
  email: string,
  totalChf: number,
  referenceId: string
): Promise<GrantAiCreditsResult> {
  const normalizedEmail = normalizeCustomerEmail(email)
  const ref = referenceId?.trim()
  if (!normalizedEmail || !ref) {
    return { granted: false, credits: 0, newBalance: 0, reason: "invalid_input" }
  }

  const credits = calculateAiCreditsForOrderTotal(totalChf)
  if (credits <= 0) {
    return { granted: false, credits: 0, newBalance: 0, reason: "below_threshold" }
  }

  const account = await getAccountByEmail(normalizedEmail)
  if (!account) {
    return { granted: false, credits: 0, newBalance: 0, reason: "no_account" }
  }

  const grants = ensureGrantMap(account)
  if (grants[ref] != null) {
    return {
      granted: false,
      credits: grants[ref],
      newBalance: normalizeAiCredits(account.aiCredits),
      reason: "already_granted",
    }
  }

  const newBalance = normalizeAiCredits(account.aiCredits) + credits
  grants[ref] = credits

  await saveAccount({
    ...account,
    docType: CUSTOMER_DOC_TYPE,
    aiCredits: newBalance,
    aiCreditGrants: grants,
  })

  console.info(
    `KI-Credits: +${credits} für ${normalizedEmail} (Ref ${ref}, Total ${totalChf} CHF) → Saldo ${newBalance}.`
  )

  return { granted: true, credits, newBalance }
}

export type ConsumeAiCreditResult = {
  success: boolean
  remaining: number
  error?: string
}

export async function consumeAiCredit(email: string): Promise<ConsumeAiCreditResult> {
  const normalizedEmail = normalizeCustomerEmail(email)
  if (!normalizedEmail) {
    return { success: false, remaining: 0, error: "invalid_email" }
  }

  const account = await getAccountByEmail(normalizedEmail)
  if (!account) {
    return { success: false, remaining: 0, error: "no_account" }
  }

  const balance = normalizeAiCredits(account.aiCredits)
  if (balance <= 0) {
    return { success: false, remaining: 0, error: "insufficient_credits" }
  }

  const remaining = balance - 1
  await saveAccount({
    ...account,
    docType: CUSTOMER_DOC_TYPE,
    aiCredits: remaining,
  })

  return { success: true, remaining }
}

export async function refundAiCredit(email: string): Promise<number> {
  const normalizedEmail = normalizeCustomerEmail(email)
  if (!normalizedEmail) return 0

  const account = await getAccountByEmail(normalizedEmail)
  if (!account) return 0

  const remaining = normalizeAiCredits(account.aiCredits) + 1
  await saveAccount({
    ...account,
    docType: CUSTOMER_DOC_TYPE,
    aiCredits: remaining,
  })
  return remaining
}
