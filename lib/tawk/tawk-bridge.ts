"use client"

import { getTawkEmbedSrc } from "@/lib/tawk/tawk-config"
import { dispatchTawkVisitorMessage, prepareTawkEmbeddedHost } from "@/lib/tawk/tawk-send-message"
import type { TawkApi, TawkChatRole, TawkUiMessage } from "@/lib/tawk/tawk-types"

type MessageListener = (message: TawkUiMessage) => void

let loadPromise: Promise<TawkApi> | null = null
let scriptInjected = false
const listeners = new Set<MessageListener>()
const pendingVisitorTexts = new Set<string>()

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

function hideTawkWidget(api: TawkApi): void {
  api.hideWidget?.()
}

function emitUiMessage(role: TawkChatRole, raw: unknown): void {
  const content = normalizeTawkMessageContent(raw)
  if (!content) return

  const uiMessage: TawkUiMessage = {
    id: createMessageId(role),
    role,
    content,
    createdAt: new Date().toISOString(),
  }

  listeners.forEach((listener) => listener(uiMessage))
}

function wireIncomingMessageHandlers(api: TawkApi): void {
  const handleAgent = (message: unknown) => {
    emitUiMessage("admin", message)
    api.onChatMessageReceived?.(message)
  }

  const handleVisitor = (message: unknown) => {
    const content = normalizeTawkMessageContent(message)
    if (content && pendingVisitorTexts.has(content)) {
      pendingVisitorTexts.delete(content)
      return
    }
    emitUiMessage("visitor", message)
    api.onChatMessageReceived?.(message)
  }

  api.onChatMessageAgent = handleAgent
  api.onChatMessageVisitor = handleVisitor

  window.addEventListener("tawkChatMessageAgent", (event) => {
    handleAgent((event as CustomEvent).detail)
  })
  window.addEventListener("tawkChatMessageVisitor", (event) => {
    handleVisitor((event as CustomEvent).detail)
  })
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
