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
      if (!ready || !file) return false

      setUploading(true)

      try {
        const link = await uploadTawkVisitorFile(file)
        if (link) {
          appendMessage({
            id: `local-file-${Date.now()}`,
            role: "visitor",
            content: file.name,
            attachments: [{ url: link, name: file.name, mimeType: file.type }],
            createdAt: new Date().toISOString(),
          })
        }
      } catch (err) {
        console.warn("[Chat] Tawk-Upload fehlgeschlagen.", err)
        return false
      } finally {
        setUploading(false)
      }

      return true
    },
    [ready, appendMessage]
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
