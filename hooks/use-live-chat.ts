"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { PublicChatMessage } from "@/lib/chat/chat-types"

const STORAGE_KEY = "dripforge_chat_session_id"

const WELCOME_MESSAGE: PublicChatMessage = {
  id: "welcome",
  sessionId: "",
  role: "admin",
  content:
    "Willkommen bei DripForge! Schreib uns deine Frage — unser Team antwortet live. Wir melden uns so schnell wie möglich.",
  createdAt: new Date(0).toISOString(),
}

type ChatSessionResponse = {
  session: { id: string; visitorLabel: string }
  messages: PublicChatMessage[]
}

export function useLiveChat(enabled: boolean) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<PublicChatMessage[]>([WELCOME_MESSAGE])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const appendMessage = useCallback((message: PublicChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev
      return [...prev, message]
    })
  }, [])

  const initSession = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      const res = await fetch("/api/chat/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stored ? { sessionId: stored } : {}),
      })
      const data = (await res.json()) as ChatSessionResponse & { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Chat konnte nicht gestartet werden.")

      localStorage.setItem(STORAGE_KEY, data.session.id)
      setSessionId(data.session.id)

      const serverMessages = data.messages ?? []
      setMessages(
        serverMessages.length > 0
          ? serverMessages
          : [{ ...WELCOME_MESSAGE, sessionId: data.session.id }]
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat konnte nicht gestartet werden.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void initSession()
  }, [enabled, initSession])

  useEffect(() => {
    if (!enabled || !sessionId) return

    const source = new EventSource(
      `/api/chat/stream?sessionId=${encodeURIComponent(sessionId)}`
    )
    eventSourceRef.current = source

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          type?: string
          message?: PublicChatMessage
        }
        if (payload.type === "message" && payload.message) {
          appendMessage(payload.message)
        }
      } catch {
        /* ignore malformed SSE payloads */
      }
    }

    source.onerror = () => {
      source.close()
    }

    return () => {
      source.close()
      eventSourceRef.current = null
    }
  }, [enabled, sessionId, appendMessage])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId || !content.trim()) return false
      setSending(true)
      setError(null)
      try {
        const res = await fetch("/api/chat/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, content: content.trim() }),
        })
        const data = (await res.json()) as {
          message?: PublicChatMessage
          whatsappError?: string
          error?: string
        }
        if (!res.ok) throw new Error(data.error ?? "Senden fehlgeschlagen.")

        if (data.message) appendMessage(data.message)
        if (data.whatsappError) {
          console.warn("[Chat] WhatsApp:", data.whatsappError)
        }
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : "Senden fehlgeschlagen.")
        return false
      } finally {
        setSending(false)
      }
    },
    [sessionId, appendMessage]
  )

  return {
    sessionId,
    messages,
    loading,
    sending,
    error,
    sendMessage,
    reloadSession: initSession,
  }
}
