import { createHmac, timingSafeEqual } from "crypto"

const PAYREXX_API_BASE = "https://api.payrexx.com/v1.14"

export type PayrexxGateway = {
  id: number
  hash: string
  link: string
  referenceId?: string
}

type PayrexxApiResponse = {
  status?: string
  message?: string
  data?: PayrexxGateway[]
}

export function isPayrexxConfigured(): boolean {
  const instance = process.env.PAYREXX_INSTANCE_NAME?.trim() ?? ""
  const apiSecret = process.env.PAYREXX_API_SECRET?.trim() ?? ""
  if (!instance || !apiSecret) return false
  if (apiSecret.includes("placeholder")) return false
  return true
}

function getPayrexxCredentials(): { instance: string; apiSecret: string } {
  const instance = process.env.PAYREXX_INSTANCE_NAME?.trim()
  const apiSecret = process.env.PAYREXX_API_SECRET?.trim()
  if (!instance || !apiSecret) {
    throw new Error(
      "Payrexx ist nicht konfiguriert (PAYREXX_INSTANCE_NAME / PAYREXX_API_SECRET fehlt)."
    )
  }
  return { instance, apiSecret }
}

export type CreateTwintGatewayInput = {
  amountCents: number
  orderId: string
  purpose: string
  successRedirectUrl: string
  failedRedirectUrl: string
  cancelRedirectUrl: string
  customer: {
    firstName: string
    lastName: string
    email: string
    phone: string
    street: string
    zip: string
    city: string
    country: string
  }
  vatRate?: number
}

/** Payrexx-Gateway nur mit TWINT als Zahlungsmittel erstellen. */
export async function createTwintGateway(
  input: CreateTwintGatewayInput
): Promise<PayrexxGateway> {
  const { instance, apiSecret } = getPayrexxCredentials()

  const body = {
    amount: input.amountCents,
    currency: "CHF",
    pm: ["twint"],
    purpose: input.purpose.slice(0, 500),
    referenceId: input.orderId,
    successRedirectUrl: input.successRedirectUrl,
    failedRedirectUrl: input.failedRedirectUrl,
    cancelRedirectUrl: input.cancelRedirectUrl,
    skipResultPage: true,
    language: "de",
    ...(input.vatRate != null && input.vatRate > 0
      ? { vatRate: input.vatRate }
      : {}),
    fields: {
      forename: { value: input.customer.firstName },
      surname: { value: input.customer.lastName },
      email: { value: input.customer.email },
      phone: { value: input.customer.phone },
      street: { value: input.customer.street },
      postcode: { value: input.customer.zip },
      place: { value: input.customer.city },
      country: { value: input.customer.country },
    },
  }

  const url = `${PAYREXX_API_BASE}/Gateway/?instance=${encodeURIComponent(instance)}`
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-API-KEY": apiSecret,
    },
    body: JSON.stringify(body),
  })

  const raw = await response.text()
  let parsed: PayrexxApiResponse
  try {
    parsed = JSON.parse(raw) as PayrexxApiResponse
  } catch {
    throw new Error(
      `Payrexx-Antwort ungültig (${response.status}): ${raw.slice(0, 200)}`
    )
  }

  if (!response.ok || parsed.status !== "success") {
    const detail = parsed.message ?? raw.slice(0, 300)
    throw new Error(`Payrexx-Gateway konnte nicht erstellt werden: ${detail}`)
  }

  const gateway = parsed.data?.[0]
  if (!gateway?.link) {
    throw new Error("Payrexx hat keine Gateway-URL zurueckgegeben.")
  }

  return gateway
}

/** Webhook-Signatur (X-Webhook-Signature) mit dem Payrexx Signing Key prüfen. */
export function verifyPayrexxWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const signingKey = process.env.PAYREXX_WEBHOOK_SIGNING_KEY?.trim()
  if (!signingKey) {
    console.warn(
      "Payrexx Webhook: PAYREXX_WEBHOOK_SIGNING_KEY fehlt — Signatur wird nicht geprueft."
    )
    return true
  }

  if (!signatureHeader?.trim()) return false

  const expected = createHmac("sha256", signingKey)
    .update(rawBody, "utf8")
    .digest("base64")

  const received = signatureHeader.trim()
  try {
    const a = Buffer.from(expected, "utf8")
    const b = Buffer.from(received, "utf8")
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return expected === received
  }
}
