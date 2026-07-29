"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, ExternalLink, Package, ShoppingBag, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart } from "@/components/dripforge/cart-provider"

function TwintPayPanel({
  orderId,
  amount,
}: {
  orderId: string
  amount: string | null
}) {
  const [twintUrl, setTwintUrl] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      let url: string | null = null
      try {
        url = sessionStorage.getItem(`twintPaymentUrl:${orderId}`)
      } catch {
        url = null
      }

      if (!url) {
        try {
          const res = await fetch(
            `/api/checkout/twint?orderId=${encodeURIComponent(orderId)}`
          )
          const data = (await res.json()) as {
            twintPaymentUrl?: string
            error?: string
          }
          if (!res.ok || !data.twintPaymentUrl) {
            throw new Error(data.error || "TWINT-Link konnte nicht geladen werden.")
          }
          url = data.twintPaymentUrl
        } catch (err) {
          if (!cancelled) {
            setError(
              err instanceof Error
                ? err.message
                : "TWINT-Link konnte nicht geladen werden."
            )
            setLoading(false)
          }
          return
        }
      }

      if (cancelled || !url) return
      setTwintUrl(url)

      try {
        const QRCode = (await import("qrcode")).default
        const dataUrl = await QRCode.toDataURL(url, {
          width: 240,
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" },
        })
        if (!cancelled) setQrDataUrl(dataUrl)
      } catch {
        /* QR optional */
      }

      if (!cancelled) setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [orderId])

  return (
    <div className="mx-auto mt-8 max-w-md rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-6 text-left">
      <div className="flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
        <h2 className="text-lg font-bold">Jetzt mit TWINT bezahlen</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Deine Bestellung ist gespeichert und wartet auf die TWINT-Zahlung.
        {amount ? (
          <>
            {" "}
            Betrag: <span className="font-semibold text-foreground">{amount} CHF</span>
          </>
        ) : null}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Verwendungszweck:{" "}
        <span className="font-mono font-semibold text-foreground">{orderId}</span>
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">TWINT-Link wird geladen…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : (
        <div className="mt-5 flex flex-col items-center gap-4">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="TWINT QR-Code"
              className="h-52 w-52 rounded-xl border border-border/60 bg-white p-2"
            />
          ) : null}
          <Button asChild className="w-full bg-black text-white hover:bg-black/90">
            <a href={twintUrl ?? "#"} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              In TWINT-App öffnen
            </a>
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            Hinweis: Die Bearbeitung und der Versand deiner Bestellung erfolgen
            direkt nach Erhalt des Zahlungseingangs.
          </p>
        </div>
      )}
    </div>
  )
}

function BestellungErfolgInner() {
  const searchParams = useSearchParams()
  const { clearCart } = useCart()
  const sessionId = searchParams.get("session_id")
  const orderId = searchParams.get("order_id")
  const method = searchParams.get("method")
  const amount = searchParams.get("amount")
  const isTwintPending = method === "twint" && Boolean(orderId)

  // Warenkorb sofort leeren (localStorage + React-State + Konto-Sync)
  useEffect(() => {
    void clearCart()
  }, [clearCart])

  // Fallback: Stripe-Session fulfill + E-Mails, falls Webhook verzögert/geblockt
  useEffect(() => {
    if (!sessionId || isTwintPending) return

    const guardKey = `stripeConfirm:${sessionId}`
    try {
      if (sessionStorage.getItem(guardKey) === "done") return
      sessionStorage.setItem(guardKey, "pending")
    } catch {
      /* ignore */
    }

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/checkout/confirm-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        })
        const data = (await res.json()) as {
          ok?: boolean
          orderId?: string
          emails?: { sent?: boolean; skipped?: boolean }
          error?: string
        }
        if (!cancelled) {
          console.info("[Erfolg] Stripe confirm-session", data)
          try {
            sessionStorage.setItem(guardKey, "done")
          } catch {
            /* ignore */
          }
        }
      } catch (error) {
        console.error("[Erfolg] Stripe confirm-session fehlgeschlagen.", error)
        try {
          sessionStorage.removeItem(guardKey)
        } catch {
          /* ignore */
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [sessionId, isTwintPending])

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <CheckCircle2 className="mx-auto mb-6 h-16 w-16 text-emerald-500" />
      <h1 className="text-3xl font-bold">
        {isTwintPending
          ? "Bestellung erhalten — bitte bezahlen"
          : "Vielen Dank für Ihre Bestellung!"}
      </h1>
      <p className="mt-4 text-muted-foreground">
        {isTwintPending
          ? "Wir haben deine Bestellung gespeichert. Dies ist die Bestätigung deines Bestelleingangs — die Ausführung folgt nach Zahlungseingang. Schliesse die Zahlung jetzt mit TWINT ab."
          : "Wir haben Ihre Bestellung und Zahlung erhalten und mit der Verarbeitung begonnen. Eine Bestätigung folgt per E-Mail."}
      </p>
      {isTwintPending ? (
        <p className="mt-3 text-sm font-medium text-foreground">
          Hinweis: Die Bearbeitung und der Versand deiner Bestellung erfolgen
          direkt nach Erhalt des Zahlungseingangs.
        </p>
      ) : null}
      {orderId ? (
        <div className="mx-auto mt-6 max-w-sm rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Bestell-ID
          </p>
          <p className="mt-1 font-mono text-sm font-semibold">{orderId}</p>
        </div>
      ) : sessionId ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Referenz: {sessionId.slice(0, 24)}…
        </p>
      ) : null}

      {isTwintPending && orderId ? (
        <TwintPayPanel orderId={orderId} amount={amount} />
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link href="/konto/bestellungen">
            <Package className="mr-2 h-4 w-4" />
            Zu meinen Bestellungen
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/shop">
            <ShoppingBag className="mr-2 h-4 w-4" />
            Weiter einkaufen
          </Link>
        </Button>
      </div>
    </div>
  )
}

export default function BestellungErfolgPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-muted-foreground">
          Wird geladen…
        </div>
      }
    >
      <BestellungErfolgInner />
    </Suspense>
  )
}
