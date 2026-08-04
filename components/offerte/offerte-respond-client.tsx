"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type OffertePublic = {
  id: string
  typeLabel: string
  status: string
  statusLabel: string
  createdAtLabel: string
  kunde: {
    firstName: string
    lastName: string
    company: string | null
    email: string
  }
  positionen: Array<{
    name: string
    details: string | null
    quantity: number
    unit: string
    unitPrice: number
    lineTotal: number
  }>
  subtotal: number
  vatTotal: number
  total: number
  totalLabel: string
  notes: string | null
  customerResponseRemark: string | null
  customerRespondedAt: string | null
  canRespond: boolean
}

function formatChf(value: number): string {
  return `CHF ${value.toFixed(2)}`
}

type Props = {
  token: string
  initialAction?: "accept" | "reject" | null
}

export function OfferteRespondClient({ token, initialAction = null }: Props) {
  const [offerte, setOfferte] = useState<OffertePublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogAction, setDialogAction] = useState<"accept" | "reject" | null>(
    null
  )
  const [remark, setRemark] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [doneMessage, setDoneMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/public/offerte/${encodeURIComponent(token)}`,
        { cache: "no-store" }
      )
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? "Offerte konnte nicht geladen werden.")
      }
      setOfferte(data.offerte as OffertePublic)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Offerte konnte nicht geladen werden."
      )
      setOfferte(null)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!offerte?.canRespond || !initialAction) return
    setDialogAction(initialAction)
    setRemark("")
    setSubmitError(null)
  }, [offerte?.canRespond, initialAction])

  const openDialog = (action: "accept" | "reject") => {
    setDialogAction(action)
    setRemark("")
    setSubmitError(null)
  }

  const submit = async () => {
    if (!dialogAction) return
    if (dialogAction === "reject" && !remark.trim()) {
      setSubmitError("Bitte geben Sie einen Ablehnungsgrund an.")
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(
        `/api/public/offerte/${encodeURIComponent(token)}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: dialogAction,
            remark: remark.trim() || undefined,
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? "Antwort fehlgeschlagen.")
      }
      setDoneMessage(
        dialogAction === "accept"
          ? "Vielen Dank — die Offerte wurde angenommen."
          : "Die Offerte wurde abgelehnt."
      )
      setDialogAction(null)
      await load()
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Antwort fehlgeschlagen."
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white/80 px-6 py-16 text-stone-600 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin" />
        Offerte wird geladen…
      </div>
    )
  }

  if (error || !offerte) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white px-6 py-10 text-center shadow-sm">
        <p className="text-lg font-semibold text-stone-900">Offerte nicht gefunden</p>
        <p className="mt-2 text-sm text-stone-600">
          {error ?? "Der Link ist ungültig oder abgelaufen."}
        </p>
      </div>
    )
  }

  const customerName =
    `${offerte.kunde.firstName} ${offerte.kunde.lastName}`.trim() ||
    offerte.kunde.company ||
    "Kunde"

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-stone-200 bg-white px-6 py-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-orange-600">
          DripForge
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">
          {offerte.typeLabel} {offerte.id}
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          Für {customerName} · {offerte.createdAtLabel} · Status:{" "}
          <span className="font-medium text-stone-800">{offerte.statusLabel}</span>
        </p>
      </header>

      {doneMessage ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{doneMessage}</span>
        </div>
      ) : null}

      <section className="rounded-2xl border border-stone-200 bg-white px-6 py-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Positionen
        </h2>
        <ul className="mt-4 divide-y divide-stone-100">
          {offerte.positionen.map((pos, index) => (
            <li
              key={`${pos.name}-${index}`}
              className="flex items-start justify-between gap-4 py-3"
            >
              <div>
                <p className="font-medium text-stone-900">{pos.name}</p>
                {pos.details ? (
                  <p className="text-sm text-stone-500">{pos.details}</p>
                ) : null}
                <p className="text-xs text-stone-400">
                  {pos.quantity} {pos.unit}
                </p>
              </div>
              <p className="shrink-0 font-medium text-stone-900">
                {formatChf(pos.lineTotal)}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-1 border-t border-stone-100 pt-4 text-sm">
          <div className="flex justify-between text-stone-600">
            <span>Zwischensumme</span>
            <span>{formatChf(offerte.subtotal)}</span>
          </div>
          {offerte.vatTotal > 0 ? (
            <div className="flex justify-between text-stone-600">
              <span>MwSt.</span>
              <span>{formatChf(offerte.vatTotal)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-base font-semibold text-stone-900">
            <span>Total</span>
            <span>{offerte.totalLabel}</span>
          </div>
        </div>
      </section>

      {offerte.notes ? (
        <section className="rounded-2xl border border-stone-200 bg-white px-6 py-5 text-sm text-stone-700 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Notiz
          </h2>
          <p className="mt-2 whitespace-pre-wrap">{offerte.notes}</p>
        </section>
      ) : null}

      {offerte.customerResponseRemark ? (
        <section className="rounded-2xl border border-stone-200 bg-white px-6 py-5 text-sm text-stone-700 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Ihre Bemerkung
          </h2>
          <p className="mt-2 whitespace-pre-wrap">{offerte.customerResponseRemark}</p>
        </section>
      ) : null}

      {offerte.canRespond ? (
        <section className="flex flex-wrap gap-3 rounded-2xl border border-stone-200 bg-white px-6 py-5 shadow-sm">
          <Button
            className="bg-orange-600 hover:bg-orange-700"
            onClick={() => openDialog("accept")}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Annehmen
          </Button>
          <Button variant="outline" onClick={() => openDialog("reject")}>
            <XCircle className="mr-2 h-4 w-4" />
            Ablehnen
          </Button>
        </section>
      ) : (
        <section className="rounded-2xl border border-stone-200 bg-stone-50 px-6 py-5 text-sm text-stone-600">
          Diese Offerte ist bereits beantwortet oder nicht mehr offen
          {offerte.statusLabel ? ` (Status: ${offerte.statusLabel})` : ""}.
        </section>
      )}

      <Dialog
        open={dialogAction != null}
        onOpenChange={(open) => {
          if (!open) setDialogAction(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "accept"
                ? "Offerte annehmen?"
                : "Offerte ablehnen?"}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === "accept"
                ? "Optional können Sie eine Bemerkung hinterlassen."
                : "Bitte geben Sie einen Ablehnungsgrund an (Pflichtfeld)."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="offerte-remark">
              Bemerkung
              {dialogAction === "reject" ? " *" : " (optional)"}
            </Label>
            <Textarea
              id="offerte-remark"
              rows={4}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder={
                dialogAction === "reject"
                  ? "Grund der Ablehnung…"
                  : "Optionale Nachricht…"
              }
            />
            {submitError ? (
              <p className="text-sm text-red-600">{submitError}</p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDialogAction(null)}
              disabled={submitting}
            >
              Abbrechen
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={submitting}
              className={
                dialogAction === "accept"
                  ? "bg-orange-600 hover:bg-orange-700"
                  : undefined
              }
              variant={dialogAction === "reject" ? "destructive" : "default"}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {dialogAction === "accept" ? "Bestätigen" : "Ablehnen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
