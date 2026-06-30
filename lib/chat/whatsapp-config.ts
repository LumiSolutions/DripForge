export const META_GRAPH_API_VERSION = "v20.0"

export type MetaWhatsAppConfig = {
  phoneNumberId: string
  businessAccountId: string
  accessToken: string
  verifyToken: string
  /** Empfänger für Kundennachrichten-Benachrichtigungen (Admin-Handy). */
  adminPhoneNumber?: string
}

export type MetaWhatsAppWebhookConfig = Omit<MetaWhatsAppConfig, "accessToken"> & {
  accessToken?: string
}

function readAdminPhoneNumber(): string | undefined {
  return (
    process.env.META_ADMIN_PHONE_NUMBER?.trim() ||
    process.env.ADMIN_PHONE_NUMBER?.trim() ||
    undefined
  )
}

/** Für Webhook-Verifizierung & Empfang — Access Token optional. */
export function getMetaWhatsAppWebhookConfig(): MetaWhatsAppWebhookConfig | null {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID?.trim()
  const businessAccountId = process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID?.trim()
  const verifyToken = process.env.META_VERIFY_TOKEN?.trim()
  const accessToken = process.env.META_ACCESS_TOKEN?.trim() || undefined

  if (!phoneNumberId || !businessAccountId || !verifyToken) {
    return null
  }

  return {
    phoneNumberId,
    businessAccountId,
    verifyToken,
    accessToken,
    adminPhoneNumber: readAdminPhoneNumber(),
  }
}

/** Vollständige Konfiguration inkl. Access Token (für ausgehende Nachrichten). */
export function getMetaWhatsAppConfig(): MetaWhatsAppConfig | null {
  const webhook = getMetaWhatsAppWebhookConfig()
  const accessToken = process.env.META_ACCESS_TOKEN?.trim()
  if (!webhook || !accessToken) return null

  return { ...webhook, accessToken }
}

export function isMetaWhatsAppConfigured(): boolean {
  return getMetaWhatsAppConfig() != null
}

export function normalizePhoneNumber(value: string): string {
  return value.replace(/[^\d]/g, "")
}

export function phonesMatch(a: string, b: string): boolean {
  const na = normalizePhoneNumber(a)
  const nb = normalizePhoneNumber(b)
  if (!na || !nb) return false
  if (na === nb) return true
  return na.endsWith(nb.slice(-9)) || nb.endsWith(na.slice(-9))
}

export function buildMetaMessagesUrl(phoneNumberId: string): string {
  return `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${phoneNumberId}/messages`
}
