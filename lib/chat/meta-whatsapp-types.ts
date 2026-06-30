/** Meta WhatsApp Cloud API — ausgehende Textnachricht. */
export type MetaSendTextMessagePayload = {
  messaging_product: "whatsapp"
  recipient_type?: "individual"
  to: string
  type: "text"
  text: {
    preview_url?: boolean
    body: string
  }
}

export type MetaSendMessageResponse = {
  messaging_product?: string
  contacts?: Array<{ input: string; wa_id: string }>
  messages?: Array<{ id: string }>
  error?: {
    message?: string
    type?: string
    code?: number
  }
}

/** Meta Webhook — eingehende Nachricht (vereinfacht). */
export type MetaWebhookTextMessage = {
  from: string
  id: string
  timestamp: string
  type: string
  text?: { body: string }
  context?: {
    from?: string
    id?: string
  }
}

export type MetaWebhookChangeValue = {
  messaging_product?: string
  metadata?: {
    display_phone_number?: string
    phone_number_id?: string
  }
  contacts?: Array<{ profile?: { name?: string }; wa_id: string }>
  messages?: MetaWebhookTextMessage[]
  statuses?: unknown[]
}

export type MetaWebhookPayload = {
  object?: string
  entry?: Array<{
    id: string
    changes?: Array<{
      field?: string
      value?: MetaWebhookChangeValue
    }>
  }>
}

export type ParsedMetaWhatsAppInbound = {
  fromPhone: string
  text: string
  messageId: string
  quotedMessageId?: string
  businessAccountId?: string
  phoneNumberId?: string
  sessionId: string | null
}
