"use client"

import { useCallback, useEffect, useState } from "react"
import {
  loadTawkBridge,
  sendTawkVisitorMessage,
  subscribeTawkMessages,
} from "@/lib/tawk/tawk-bridge"
import type { TawkUiMessage } from "@/lib/tawk/tawk-types"

const WELCOME_MESSAGE: TawkUiMessage = {
  id: "welcome",
  role: "admin",
  content:
    "Willkommen bei DripForge! Schreib uns deine Frage — unser Team antwortet live. Wir melden uns so schnell wie möglich.",
  createdAt: new Date(0).toISOString(),
}

export function useTawkChat(enabled: boolean) {
  const [messages, setMessages] = useState<TawkUiMessage[]>([WELCOME_MESSAGE])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [ready, setReady] = useState(false)

  const appendMessage = useCallback((message: TawkUiMessage) => {
    setMessages((prev) => {
      if (prev.some((entry) => entry.id === message.id)) return prev
      return [...prev, message]
    })
  }, [])

  useEffect(() => {
    if (!enabled) return

    setLoading(true)

    void loadTawkBridge()
      .then(() => setReady(true))
      .catch((err) => {
        console.warn("[Chat] Tawk konnte nicht geladen werden.", err)
      })
      .finally(() => setLoading(false))
  }, [enabled])

  useEffect(() => {
    if (!enabled || !ready) return
    return subscribeTawkMessages((message) => {
      appendMessage(message)
    })
  }, [enabled, ready, appendMessage])

  const sendMessage = useCallback(
    async (content: string) => {
      const text = content.trim()
      if (!text || !ready) return false

      setSending(true)

      appendMessage({
        id: `local-${Date.now()}`,
        role: "visitor",
        content: text,
        createdAt: new Date().toISOString(),
      })

      try {
        await sendTawkVisitorMessage(text)
      } catch (err) {
        console.warn("[Chat] Tawk-Übermittlung fehlgeschlagen.", err)
      } finally {
        setSending(false)
      }

      return true
    },
    [ready, appendMessage]
  )

  return {
    messages,
    loading,
    sending,
    sendMessage,
    ready,
  }
}
