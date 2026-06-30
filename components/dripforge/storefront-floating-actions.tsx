"use client"

import { useEffect, useRef, useState } from "react"
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
} from "lucide-react"
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
  const visible = useFloatingActionsVisible()
  const { showSupportOnMainSite: supportPageVisible } = useSupportPageSettings()
  const [mounted, setMounted] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  const { messages, loading, sending, error, sendMessage } = useTawkChat(chatOpen)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!chatOpen || !scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [chatOpen, messages])

  const handleSendMessage = async () => {
    if (!chatInput.trim() || sending) return
    const text = chatInput
    setChatInput("")
    const ok = await sendMessage(text)
    if (!ok) setChatInput(text)
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
                <p className="text-sm font-medium">DripForge Live-Chat</p>
                <p className="text-xs text-muted-foreground">
                  {loading ? "Verbinden…" : "Team antwortet live"}
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
                Chat wird geladen…
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
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-border p-4">
            {error && (
              <p className="mb-2 text-xs text-red-500" role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSendMessage()
                }}
                placeholder="Nachricht eingeben..."
                className="flex-1"
                disabled={loading || sending}
              />
              <Button
                size="icon"
                onClick={() => void handleSendMessage()}
                disabled={loading || sending || !chatInput.trim()}
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
              Team kontaktieren
            </button>
          </div>
        </div>
      )}

      {supportPageVisible && (
        <Link
          href={SUPPORT_ROUTE}
          prefetch
          className="pointer-events-auto flex h-12 w-12 touch-manipulation items-center justify-center rounded-full border border-primary/30 bg-background/95 text-primary shadow-lg backdrop-blur-sm transition-transform hover:scale-105 hover:bg-primary/10"
          title="Unsere Mission"
          aria-label="Unsere Mission unterstützen"
        >
          <Heart className="h-5 w-5 fill-primary/20 text-primary" />
        </Link>
      )}

      <button
        type="button"
        onClick={() => setChatOpen((open) => !open)}
        className="pointer-events-auto flex h-14 w-14 touch-manipulation items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        title="Chat öffnen"
        aria-label="Chat öffnen"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    </div>
  )

  return createPortal(content, document.body)
}
