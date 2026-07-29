"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, ExternalLink, Package, ShoppingBag, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCart } from "@/components/dripforge/cart-provider"
import { clearClientCart } from "@/lib/dripforge/cart-storage"

/**
 * TWINT-Zahlung: kein selbst generierter QR-Code (wird von der TWINT-App
 * nicht erkannt). Stattdessen klarer Button + Auto-Redirect auf den
 * offiziellen go.twint.ch-Paylink.
 */
function TwintPayPanel({
  orderId,
  amount,
}: {
  orderId: string
  amount: string | null
}) {
  const [twintUrl, setTwintUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [redirecting, setRedirecting] = useState(false)
  const hasRedirectedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    let redirectTimer: number | undefined

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
      setLoading(false)

      // Direkt zur offiziellen TWINT-Paylink-Seite (kein QR)
      if (!hasRedirectedRef.current) {
        hasRedirectedRef.current = true
        setRedirecting(true)
        redirectTimer = window.setTimeout(() => {
          window.location.href = url!
        }, 1200)
      }
    }

    void load()
    return () => {
      cancelled = true
      if (redirectTimer !== undefined) window.clearTimeout(redirectTimer)
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
          {redirecting ? (
            <p className="text-sm text-muted-foreground">
              Weiterleitung zur TWINT-Zahlung…
            </p>
          ) : null}
          <Button asChild className="w-full bg-black text-white hover:bg-black/90">
            <a
              href={twintUrl ?? "#"}
              rel="noopener noreferrer"
              onClick={() => {
                hasRedirectedRef.current = true
              }}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Jetzt mit TWINT bezahlen
            </a>
          </Button>
          {twintUrl ? (
            <p className="break-all text-center text-xs text-muted-foreground">
              {twintUrl}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-muted-foreground">
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
  const orderIdParam = searchParams.get("order_id")
  const method = searchParams.get("method")
  const amount = searchParams.get("amount")
  const isTwintPending = method === "twint" && Boolean(orderIdParam)

  const [resolvedOrderId, setResolvedOrderId] = useState<string | null>(
    orderIdParam
  )
  const [emailStatus, setEmailStatus] = useState<
    "idle" | "pending" | "sent" | "skipped" | "error"
  >("idle")

  const hasClearedRef = useRef(false)
  const hasConfirmedRef = useRef(false)

  // 1) Warenkorb genau einmal beim Mount leeren — kein Dependency auf clearCart
  useEffect(() => {
    if (hasClearedRef.current) return
    hasClearedRef.current = true
    // Synchron localStorage zuerst (verhindert Hydration-Race)
    clearClientCart()
    void clearCart()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only by design
  }, [])

  // 2) Stripe: einmalig Session bestätigen + E-Mails auslösen
  useEffect(() => {
    if (!sessionId || isTwintPending) return
    if (hasConfirmedRef.current) return
    hasConfirmedRef.current = true

    setEmailStatus("pending")

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/orders/confirm-stripe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        })
        const data = (await res.json()) as {
          ok?: boolean
          orderId?: string | null
          emails?: { sent?: boolean; skipped?: boolean }
          error?: string
        }

        if (cancelled) return

        if (data.orderId) setResolvedOrderId(data.orderId)

        if (data.emails?.sent) setEmailStatus("sent")
        else if (data.emails?.skipped || data.ok) setEmailStatus("skipped")
        else setEmailStatus("error")

        console.info("[Erfolg] confirm-stripe", data)
      } catch (error) {
        if (!cancelled) {
          setEmailStatus("error")
          console.error("[Erfolg] confirm-stripe fehlgeschlagen.", error)
          // Erlaubt einen manuellen Retry beim nächsten Besuch derselben Session
          hasConfirmedRef.current = false
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [sessionId, isTwintPending])

  const displayOrderId = resolvedOrderId || orderIdParam

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
          ? "Wir haben deine Bestellung gespeichert. Dies ist die Bestätigung deines Bestelleingangs — die Ausführung folgt nach Zahlungseingang. Du wirst zur TWINT-Zahlung weitergeleitet."
          : "Wir haben Ihre Bestellung und Zahlung erhalten und mit der Verarbeitung begonnen. Eine Bestätigung folgt per E-Mail."}
      </p>
      {isTwintPending ? (
        <p className="mt-3 text-sm font-medium text-foreground">
          Hinweis: Die Bearbeitung und der Versand deiner Bestellung erfolgen
          direkt nach Erhalt des Zahlungseingangs.
        </p>
      ) : null}
      {displayOrderId ? (
        <div className="mx-auto mt-6 max-w-sm rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Bestell-ID
          </p>
          <p className="mt-1 font-mono text-sm font-semibold">{displayOrderId}</p>
        </div>
      ) : sessionId ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Referenz: {sessionId.slice(0, 24)}…
        </p>
      ) : null}

      {!isTwintPending && sessionId && emailStatus === "error" ? (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
          Die Bestätigungs-E-Mail konnte noch nicht ausgelöst werden. Bitte die
          Seite kurz neu laden oder den Support kontaktieren.
        </p>
      ) : null}

      {isTwintPending && displayOrderId ? (
        <TwintPayPanel orderId={displayOrderId} amount={amount} />
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link href="/konto/bestellungen" prefetch={false}>
            <Package className="mr-2 h-4 w-4" />
            Zu meinen Bestellungen
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/shop" prefetch={false}>
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
