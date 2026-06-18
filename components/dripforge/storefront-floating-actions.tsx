"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Send,
  MessageCircle,
  User,
  Bot,
  Heart,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useSupportPageSettings } from "@/hooks/use-support-page-active"
import { SUPPORT_ROUTE } from "@/components/dripforge/support-nav-link"
import { shopViewHref } from "@/lib/dripforge/shop-routes"

type ChatMessage = {
  id: string
  role: "assistant" | "user"
  content: string
}

/** Globale schwebende Aktionen: Support-Herz + Chatbot auf allen Seiten. */
export function StorefrontFloatingActions() {
  const pathname = usePathname()
  const router = useRouter()
  const { showSupportOnMainSite: supportPageVisible } = useSupportPageSettings()
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Willkommen bei DripForge! Wie kann ich Ihnen heute helfen? Ich kann Fragen zu unseren 3D-Druck- und Lasergravur-Services beantworten.",
    },
  ])
  const [chatInput, setChatInput] = useState("")

  const handleSendMessage = useCallback(() => {
    if (!chatInput.trim()) return
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: chatInput,
    }
    setChatMessages((prev) => [...prev, newMessage])
    setChatInput("")
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            "Vielen Dank für Ihre Nachricht! Unser Team wird sich in Kürze bei Ihnen melden. Für dringende Anfragen erreichen Sie uns unter drip-forge@outlook.com",
        },
      ])
    }, 1000)
  }, [chatInput])

  // Launch-/Countdown-Startseite: nur Header-Herz, keine schwebenden Overlays unten rechts.
  if (pathname === "/") {
    return null
  }

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-3">
      {chatOpen && (
        <div className="pointer-events-auto w-80 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border bg-secondary/50 p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">DripForge Assistent</p>
                <p className="text-xs text-muted-foreground">Online</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="h-64 overflow-y-auto p-4">
            <div className="space-y-4">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn("flex gap-2", msg.role === "user" && "flex-row-reverse")}
                >
                  <div
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      msg.role === "assistant" ? "bg-primary" : "bg-secondary"
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <Bot className="h-3 w-3 text-primary-foreground" />
                    ) : (
                      <User className="h-3 w-3" />
                    )}
                  </div>
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-2 text-sm",
                      msg.role === "assistant"
                        ? "bg-secondary"
                        : "bg-primary text-primary-foreground"
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-border p-4">
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Nachricht eingeben..."
                className="flex-1"
              />
              <Button size="icon" onClick={handleSendMessage}>
                <Send className="h-4 w-4" />
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
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-background/95 text-primary shadow-lg backdrop-blur-sm transition-transform hover:scale-105 hover:bg-primary/10"
          title="Unsere Mission"
          aria-label="Unsere Mission unterstützen"
        >
          <Heart className="h-5 w-5 fill-primary/20 text-primary" />
        </Link>
      )}

      <button
        type="button"
        onClick={() => setChatOpen((open) => !open)}
        className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        title="Chat öffnen"
        aria-label="Chat öffnen"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    </div>
  )
}
