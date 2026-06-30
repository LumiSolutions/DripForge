"use client"

import { useCallback, useEffect, useState } from "react"
import { attachmentKey } from "@/lib/tawk/tawk-attachments"
import {
  loadTawkBridge,
  sendTawkVisitorMessage,
  subscribeTawkMessages,
} from "@/lib/tawk/tawk-bridge"
import type { TawkUiMessage } from "@/lib/tawk/tawk-types"
import { uploadTawkVisitorFile } from "@/lib/tawk/tawk-upload-file"

const WELCOME_MESSAGE: TawkUiMessage = {
  id: "welcome",
  role: "admin",
  content:
    "Willkommen bei DripForge! Schreib uns deine Frage — unser Team antwortet live. Wir melden uns so schnell wie möglich.",
  createdAt: new Date(0).toISOString(),
}

function messageAttachmentKey(message: TawkUiMessage): string {
  return attachmentKey(message.attachments ?? [])
}

function isDuplicateMessage(prev: TawkUiMessage[], next: TawkUiMessage): boolean {
  if (prev.some((entry) => entry.id === next.id && entry.id !== "welcome")) {
    return true
  }

  const nextAttachments = messageAttachmentKey(next)
  if (nextAttachments) {
    return prev.some(
      (entry) => entry.role === next.role && messageAttachmentKey(entry) === nextAttachments
    )
  }

  return prev.some(
    (entry) =>
      entry.role === next.role &&
      entry.content === next.content &&
      entry.createdAt === next.createdAt &&
      !messageAttachmentKey(entry)
  )
}

export function useTawkChat(enabled: boolean) {
  const [messages, setMessages] = useState<TawkUiMessage[]>([WELCOME_MESSAGE])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [ready, setReady] = useState(false)

  const appendMessage = useCallback((message: TawkUiMessage) => {
    setMessages((prev) => {
      if (isDuplicateMessage(prev, message)) return prev
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

      const optimisticMessage: TawkUiMessage = {
        id: `local-${Date.now()}`,
        role: "visitor",
        content: text,
        createdAt: new Date().toISOString(),
      }

      appendMessage(optimisticMessage)

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

  const uploadFile = useCallback(
    async (file: File) => {
      if (!file || uploading || sending) return false

      setUploading(true)

      try {
        if (!ready) {
          throw new Error("Tawk-Chat ist noch nicht bereit. Bitte kurz warten und erneut versuchen.")
        }

        const result = await uploadTawkVisitorFile(file)
        if (!result.success || !result.url) {
          throw new Error("Tawk Upload ohne bestätigte Bild-URL abgeschlossen.")
        }

        console.log("[Chat] Upload bestätigt:", result.url)
        return true
      } catch (err) {
        console.error("[Chat] Tawk-Upload fehlgeschlagen.", err)
        return false
      } finally {
        setUploading(false)
      }
    },
    [ready, uploading, sending]
  )

  return {
    messages,
    loading,
    sending,
    uploading,
    sendMessage,
    uploadFile,
    ready,
  }
}
