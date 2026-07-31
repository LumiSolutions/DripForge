"use client"

import { useCallback, useEffect, useState, type MouseEvent } from "react"
import { Heart, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type WishlistButtonProps = {
  productId: string
  className?: string
  size?: "sm" | "md"
}

export function WishlistButton({
  productId,
  className,
  size = "md",
}: WishlistButtonProps) {
  const [active, setActive] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const me = await fetch("/api/konto/me", { cache: "no-store" })
      if (!me.ok) {
        setLoggedIn(false)
        setActive(false)
        setReady(true)
        return
      }
      setLoggedIn(true)
      const res = await fetch("/api/konto/wishlist", {
        cache: "no-store",
        credentials: "include",
      })
      if (!res.ok) {
        setReady(true)
        return
      }
      const data = (await res.json()) as {
        items?: Array<{ productId: string }>
      }
      setActive(
        (data.items ?? []).some((item) => item.productId === productId)
      )
    } catch {
      setLoggedIn(false)
    } finally {
      setReady(true)
    }
  }, [productId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const toggle = async (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (!loggedIn) {
      window.location.href = `/konto/login?next=${encodeURIComponent(
        typeof window !== "undefined" ? window.location.pathname : "/shop"
      )}`
      return
    }
    setBusy(true)
    try {
      const res = await fetch("/api/konto/wishlist", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      })
      const data = (await res.json()) as {
        added?: boolean
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? "Fehler")
      setActive(Boolean(data.added))
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return null

  return (
    <button
      type="button"
      onClick={(e) => void toggle(e)}
      disabled={busy}
      title={active ? "Von Merkliste entfernen" : "Zur Merkliste hinzufügen"}
      aria-label={active ? "Von Merkliste entfernen" : "Zur Merkliste hinzufügen"}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center justify-center rounded-full border bg-background/90 shadow-sm backdrop-blur-sm transition",
        "hover:border-primary/40 hover:text-primary",
        active
          ? "border-primary/50 text-primary"
          : "border-border/60 text-muted-foreground",
        size === "sm" ? "h-8 w-8" : "h-9 w-9",
        className
      )}
    >
      {busy ? (
        <Loader2 className={cn("animate-spin", size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} />
      ) : (
        <Heart
          className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4", active && "fill-current")}
        />
      )}
    </button>
  )
}
