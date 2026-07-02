"use client"

import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Send,
  MessageCircle,
  User,
  Bot,
  Heart,
  X,
  Loader2,
  Paperclip,
} from "lucide-react"
import { ChatMessageContent } from "@/components/dripforge/chat-message-content"
import {
  EditableSiteTextField,
  SiteText,
  useSiteTextValue,
} from "@/components/dripforge/editable-site-text"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useSupportPageSettings } from "@/hooks/use-support-page-active"
import { useFloatingActionsVisible } from "@/hooks/use-floating-actions-visible"
import { useTawkChat } from "@/hooks/use-tawk-chat"
import { SUPPORT_ROUTE } from "@/components/dripforge/support-nav-link"
import { shopViewHref } from "@/lib/dripforge/shop-routes"

/** Globale schwebende Aktionen: Support-Herz + Live-Chat (Mobil + Desktop). */
export function StorefrontFloatingActions() {
  const router = useRouter()
  const chatWelcome = useSiteTextValue("chat_welcome")
  const chatInputPlaceholder = useSiteTextValue("chat_input_placeholder")
  const chatSupportMission = useSiteTextValue("chat_support_mission")
  const chatOpenLabel = useSiteTextValue("chat_open_label")
  const visible = useFloatingActionsVisible()
  const { showSupportOnMainSite: supportPageVisible } = useSupportPageSettings()
  const [mounted, setMounted] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { messages, loading, sending, uploading, sendMessage, uploadFile } = useTawkChat(
    chatOpen,
    chatWelcome
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!chatOpen || !scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [chatOpen, messages])

  const handleSendMessage = async () => {
    if (!chatInput.trim() || sending || uploading) return
    const text = chatInput
    setChatInput("")
    const ok = await sendMessage(text)
    if (!ok) setChatInput(text)
  }

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file || uploading || sending) return

    void uploadFile(file)
  }

  if (!visible || !mounted) {
    return null
  }

  const content = (
    <div
      className={cn(
        "pointer-events-none fixed z-[200] flex flex-col items-end gap-3",
        "bottom-[max(1.25rem,env(safe-area-inset-bottom))]",
        "right-[max(1.25rem,env(safe-area-inset-right))]"
      )}
    >
      {chatOpen && (
        <div
          className={cn(
            "pointer-events-auto overflow-hidden rounded-2xl border border-border bg-card shadow-2xl",
            "w-[min(20rem,calc(100vw-2rem))]"
          )}
        >
          <div className="flex items-center justify-between border-b border-border bg-secondary/50 p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  <SiteText k="chat_title" />
                </p>
                <p className="text-xs text-muted-foreground">
                  {loading ? (
                    <SiteText k="chat_status_connecting" />
                  ) : (
                    <SiteText k="chat_status_live" />
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Chat schliessen"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div ref={scrollRef} className="h-64 overflow-y-auto p-4">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <SiteText k="chat_loading" />
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn("flex gap-2", msg.role === "visitor" && "flex-row-reverse")}
                  >
                    <div
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                        msg.role === "visitor" ? "bg-secondary" : "bg-primary"
                      )}
                    >
                      {msg.role === "visitor" ? (
                        <User className="h-3 w-3" />
                      ) : (
                        <Bot className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                        msg.role === "visitor"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary"
                      )}
                    >
                      {msg.id === "welcome" ? (
                        <SiteText k="chat_welcome" />
                      ) : (
                        <ChatMessageContent message={msg} isVisitor={msg.role === "visitor"} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-border p-4">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleFileSelect}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || sending || uploading}
                aria-label="Datei anhängen"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </Button>
              <EditableSiteTextField textKey="chat_input_placeholder" className="min-w-0 flex-1">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleSendMessage()
                  }}
                  placeholder={chatInputPlaceholder}
                  className="w-full flex-1"
                  disabled={loading || sending || uploading}
                />
              </EditableSiteTextField>
              <Button
                size="icon"
                onClick={() => void handleSendMessage()}
                disabled={loading || sending || uploading || !chatInput.trim()}
                aria-label="Nachricht senden"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <button
              type="button"
              onClick={() => router.push(shopViewHref("kontakt"))}
              className="mt-2 text-xs text-primary hover:underline"
            >
              <SiteText k="chat_contact_link" />
            </button>
          </div>
        </div>
      )}

      {supportPageVisible && (
        <EditableSiteTextField textKey="chat_support_mission">
          <Link
            href={SUPPORT_ROUTE}
            prefetch
            className="pointer-events-auto flex h-12 w-12 touch-manipulation items-center justify-center rounded-full border border-primary/30 bg-background/95 text-primary shadow-lg backdrop-blur-sm transition-transform hover:scale-105 hover:bg-primary/10"
            title={chatSupportMission}
            aria-label={chatSupportMission}
          >
            <Heart className="h-5 w-5 fill-primary/20 text-primary" />
          </Link>
        </EditableSiteTextField>
      )}

      <EditableSiteTextField textKey="chat_open_label">
        <button
          type="button"
          onClick={() => setChatOpen((open) => !open)}
          className="pointer-events-auto flex h-14 w-14 touch-manipulation items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
          title={chatOpenLabel}
          aria-label={chatOpenLabel}
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      </EditableSiteTextField>
    </div>
  )

  return createPortal(content, document.body)
}
