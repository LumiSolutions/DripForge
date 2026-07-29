/**
 * Offizieller TWINT-Zahlungslink (Business Portal).
 * Prefill laut TWINT/edoobox-Doku: amount + trxInfo (Verwendungszweck).
 */

const DEFAULT_TWINT_PAYMENT_LINK =
  "https://go.twint.ch/1/e/tw?tw=acq.j2p9NZeaRHGzqlQcrqvX9tzy23j85dKTYSPwH-H6zS86NnTxMCQKDJxPWcRnvZNd"

export function getTwintPaymentLinkBase(): string {
  return (
    process.env.TWINT_PAYMENT_LINK?.trim() ||
    process.env.NEXT_PUBLIC_TWINT_PAYMENT_LINK?.trim() ||
    DEFAULT_TWINT_PAYMENT_LINK
  )
}

export function isTwintPaymentLinkConfigured(): boolean {
  return Boolean(getTwintPaymentLinkBase())
}

/** CHF-Betrag als Dezimalstring mit zwei Stellen (z. B. 29.90). */
export function formatTwintAmount(amountChf: number): string {
  const n = Number(amountChf)
  if (!Number.isFinite(n) || n < 0) return "0.00"
  return n.toFixed(2)
}

/**
 * Baut den TWINT-Link mit Betrag und Bestellnummer als trxInfo.
 * Bestehende Query-Parameter (tw=…) bleiben erhalten.
 */
export function buildTwintPaymentUrl(options: {
  orderId: string
  amountChf: number
  baseUrl?: string
}): string {
  const base = (options.baseUrl || getTwintPaymentLinkBase()).trim()
  if (!base) {
    throw new Error("TWINT_PAYMENT_LINK ist nicht konfiguriert.")
  }

  const url = new URL(base)
  url.searchParams.set("amount", formatTwintAmount(options.amountChf))
  url.searchParams.set("trxInfo", options.orderId.trim())
  return url.toString()
}
