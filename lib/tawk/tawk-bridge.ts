"use client"

import { getTawkEmbedSrc } from "@/lib/tawk/tawk-config"
import { dispatchTawkVisitorMessage, prepareTawkEmbeddedHost } from "@/lib/tawk/tawk-send-message"
import type { TawkApi, TawkChatRole, TawkUiMessage } from "@/lib/tawk/tawk-types"

type MessageListener = (message: TawkUiMessage) => void

let loadPromise: Promise<TawkApi> | null = null
let scriptInjected = false
let handlersWired = false
const listeners = new Set<MessageListener>()
const pendingVisitorTexts = new Set<string>()
const seenIncomingKeys = new Set<string>()

const MAX_SEEN_KEYS = 200

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function normalizeTawkMessageContent(message: unknown): string {
  if (typeof message === "string") return message.trim()
  if (message && typeof message === "object") {
    const record = message as Record<string, unknown>
    if (typeof record.message === "string") return record.message.trim()
    if (typeof record.text === "string") return record.text.trim()
    if (typeof record.body === "string") return record.body.trim()
  }
  return ""
}

function extractTawkMessageId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null
  const record = raw as Record<string, unknown>
  for (const key of ["id", "messageId", "msgId", "uuid"]) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

function extractTawkTimestamp(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null
  const record = raw as Record<string, unknown>
  for (const key of ["time", "timestamp", "createdAt", "date"]) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return null
}

export function buildIncomingMessageKey(
  role: TawkChatRole,
  content: string,
  raw: unknown
): string {
  const tawkId = extractTawkMessageId(raw)
  if (tawkId) return `${role}:id:${tawkId}`

  const timestamp = extractTawkTimestamp(raw)
  if (timestamp) return `${role}:ts:${timestamp}:${content}`

  return `${role}:content:${content}`
}

function rememberIncomingKey(key: string): boolean {
  if (seenIncomingKeys.has(key)) return false
  seenIncomingKeys.add(key)
  if (seenIncomingKeys.size > MAX_SEEN_KEYS) {
    const first = seenIncomingKeys.values().next().value
    if (first) seenIncomingKeys.delete(first)
  }
  return true
}

function hideTawkWidget(api: TawkApi): void {
  api.hideWidget?.()
}

function toUiMessage(role: TawkChatRole, raw: unknown, content: string): TawkUiMessage {
  const tawkId = extractTawkMessageId(raw)
  const timestamp = extractTawkTimestamp(raw)

  return {
    id: tawkId ?? createMessageId(role),
    role,
    content,
    createdAt: timestamp ?? new Date().toISOString(),
  }
}

/** Einziger Einstieg für eingehende Tawk-Nachrichten (Agent + Visitor). */
function handleChatMessageReceived(raw: unknown, role: TawkChatRole): void {
  const content = normalizeTawkMessageContent(raw)
  if (!content) return

  if (role === "visitor" && pendingVisitorTexts.has(content)) {
    pendingVisitorTexts.delete(content)
    return
  }

  const dedupeKey = buildIncomingMessageKey(role, content, raw)
  if (!rememberIncomingKey(dedupeKey)) return

  const uiMessage = toUiMessage(role, raw, content)
  listeners.forEach((listener) => listener(uiMessage))
}

function wireIncomingMessageHandlers(api: TawkApi): void {
  if (handlersWired) return
  handlersWired = true

  // Ein Hook für Agent-Antworten (Tawk ruft onChatMessageAgent nativ auf).
  api.onChatMessageAgent = (message) => {
    handleChatMessageReceived(message, "admin")
  }

  api.onChatMessageVisitor = (message) => {
    handleChatMessageReceived(message, "visitor")
  }
}

function injectTawkScript(): void {
  if (scriptInjected || typeof document === "undefined") return
  scriptInjected = true

  if (document.querySelector(`script[data-tawk-bridge="true"]`)) return

  if (window.Tawk_API) {
    prepareTawkEmbeddedHost(window.Tawk_API)
  }

  const script = document.createElement("script")
  script.async = true
  script.src = getTawkEmbedSrc()
  script.charset = "UTF-8"
  script.crossOrigin = "anonymous"
  script.dataset.tawkBridge = "true"

  const firstScript = document.getElementsByTagName("script")[0]
  firstScript?.parentNode?.insertBefore(script, firstScript)
}

export function subscribeTawkMessages(listener: MessageListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function loadTawkBridge(): Promise<TawkApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Tawk ist nur im Browser verfügbar."))
  }

  if (loadPromise) return loadPromise

  loadPromise = new Promise<TawkApi>((resolve, reject) => {
    window.Tawk_API = window.Tawk_API || {}
    window.Tawk_LoadStart = window.Tawk_LoadStart || new Date()

    const api = window.Tawk_API
    let settled = false

    prepareTawkEmbeddedHost(api)
    wireIncomingMessageHandlers(api)

    const markReady = () => {
      if (settled) return
      settled = true
      hideTawkWidget(api)
      api.start?.()
      resolve(api)
    }

    api.onBeforeLoad = function onBeforeLoad() {
      hideTawkWidget(api)
    }

    const previousOnLoad = api.onLoad
    api.onLoad = function onLoad() {
      previousOnLoad?.()
      markReady()
    }

    injectTawkScript()

    window.setTimeout(() => {
      if (!settled) {
        settled = true
        reject(new Error("Tawk konnte nicht geladen werden."))
      }
    }, 20_000)
  })

  return loadPromise
}

export async function sendTawkVisitorMessage(content: string): Promise<void> {
  const text = content.trim()
  if (!text) return

  const api = await loadTawkBridge()
  pendingVisitorTexts.add(text)

  const waitForTawkEcho = new Promise<void>((resolve) => {
    const started = Date.now()
    const timer = window.setInterval(() => {
      if (!pendingVisitorTexts.has(text) || Date.now() - started > 8_000) {
        window.clearInterval(timer)
        resolve()
      }
    }, 100)
  })

  try {
    await dispatchTawkVisitorMessage(api, text)
    await waitForTawkEcho
  } finally {
    window.setTimeout(() => pendingVisitorTexts.delete(text), 15_000)
  }
}
