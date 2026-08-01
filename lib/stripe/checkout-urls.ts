import { resolveSiteOrigin } from "@/lib/site/site-origin"

function forceHttpsOrigin(origin: string): string {
  const trimmed = origin.trim().replace(/\/$/, "")
  if (!trimmed) return "https://dripforge.ch"
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`)
    // Stripe Live verlangt HTTPS (außer localhost)
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      url.protocol = "https:"
    }
    return url.origin
  } catch {
    return "https://dripforge.ch"
  }
}

/** Stripe Checkout Redirect-URLs nach erfolgreicher / abgebrochener Zahlung. */
export function getStripeCheckoutUrls(): {
  successUrl: string
  cancelUrl: string
} {
  const base = forceHttpsOrigin(resolveSiteOrigin())

  const successUrl = `${base}/bestellung/erfolg?session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = `${base}/bestellung/abgebrochen`

  return { successUrl, cancelUrl }
}

export function assertStripeCheckoutUrls(successUrl: string, cancelUrl: string): void {
  for (const [label, value] of [
    ["success_url", successUrl],
    ["cancel_url", cancelUrl],
  ] as const) {
    let parsed: URL
    try {
      parsed = new URL(value.replace("{CHECKOUT_SESSION_ID}", "cs_test_placeholder"))
    } catch {
      throw new Error(`Ungültige ${label}: ${value}`)
    }
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      throw new Error(`${label} muss HTTPS sein (aktuell: ${parsed.protocol})`)
    }
  }
  if (!successUrl.includes("{CHECKOUT_SESSION_ID}")) {
    throw new Error("success_url muss {CHECKOUT_SESSION_ID} enthalten.")
  }
}
