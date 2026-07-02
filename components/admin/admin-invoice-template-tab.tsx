"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Eye, Loader2, Save, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import type { InvoiceTemplateSettings } from "@/lib/invoices/invoice-template-types"

export function AdminInvoiceTemplateTab() {
  const [template, setTemplate] = useState<InvoiceTemplateSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadTemplate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/invoice-template", {
        cache: "no-store",
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      setTemplate(data.template as InvoiceTemplateSettings)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Rechnungsvorlage konnte nicht geladen werden."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTemplate()
  }, [loadTemplate])

  const updateField = <K extends keyof InvoiceTemplateSettings>(
    key: K,
    value: InvoiceTemplateSettings[K]
  ) => {
    setTemplate((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const saveTemplate = async () => {
    if (!template) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/admin/invoice-template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(template),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")
      setTemplate(data.template as InvoiceTemplateSettings)
      setSuccess("Rechnungsvorlage gespeichert. Firmendaten wurden mit Shop-Einstellungen synchronisiert.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen")
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/admin/invoice-template/logo", {
        method: "POST",
        credentials: "include",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Upload fehlgeschlagen")
      setTemplate(data.template as InvoiceTemplateSettings)
      setSuccess("Rechnungslogo hochgeladen.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logo-Upload fehlgeschlagen")
    } finally {
      setUploadingLogo(false)
    }
  }

  const openPreview = async () => {
    setPreviewing(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/invoice-template/preview", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "preview" }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? "Vorschau fehlgeschlagen")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, "_blank", "noopener,noreferrer")
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vorschau fehlgeschlagen")
    } finally {
      setPreviewing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Rechnungsvorlage wird geladen…
      </div>
    )
  }

  if (!template) {
    return (
      <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
        {error ?? "Rechnungsvorlage konnte nicht geladen werden."}
      </p>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rechnungsvorlage</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Firmendaten, Texte und Logo fuer automatisch generierte PDF-Rechnungen.
          Platzhalter: {"{firmenname}"}, {"{rechnungsnummer}"}, {"{zahlungsfrist}"}, {"{iban}"}, {"{bank}"}, {"{datum}"}
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {success}
        </p>
      )}

      <Card className={adminUi.section}>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-semibold">Firmendaten</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="firmenname">Firmenname</Label>
              <Input
                id="firmenname"
                value={template.firmenname}
                onChange={(e) => updateField("firmenname", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="inhaber">Inhaber / Geschaeftsfuehrung</Label>
              <Input
                id="inhaber"
                value={template.inhaber}
                onChange={(e) => updateField("inhaber", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="firmenAdresse">Adresse (Zeilenumbrueche erlaubt)</Label>
              <Textarea
                id="firmenAdresse"
                rows={3}
                value={template.firmenAdresse}
                onChange={(e) => updateField("firmenAdresse", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kontaktEmail">Support-E-Mail</Label>
              <Input
                id="kontaktEmail"
                type="email"
                value={template.kontaktEmail}
                onChange={(e) => updateField("kontaktEmail", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentTermsDays">Zahlungsfrist (Tage)</Label>
              <Input
                id="paymentTermsDays"
                type="number"
                min={1}
                max={120}
                value={template.paymentTermsDays}
                onChange={(e) =>
                  updateField("paymentTermsDays", Number(e.target.value) || 30)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="iban">IBAN</Label>
              <Input
                id="iban"
                value={template.iban}
                onChange={(e) => updateField("iban", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankname">Bankname</Label>
              <Input
                id="bankname"
                value={template.bankname}
                onChange={(e) => updateField("bankname", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={adminUi.section}>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-semibold">Rechnungslogo</h2>
          <div className="flex flex-wrap items-center gap-4">
            {template.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={template.logoUrl}
                alt="Rechnungslogo"
                className="h-16 w-16 rounded-lg border border-border object-contain bg-white p-1"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                Kein Logo
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleLogoUpload(file)
                e.target.value = ""
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={uploadingLogo}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadingLogo ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Logo hochladen
            </Button>
            {template.logoUrl ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => updateField("logoUrl", null)}
              >
                Logo entfernen
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className={adminUi.section}>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-semibold">Rechnungstexte</h2>
          <div className="space-y-2">
            <Label htmlFor="headerInvoiceLine">Kopfzeile Rechnung</Label>
            <Input
              id="headerInvoiceLine"
              value={template.headerInvoiceLine}
              onChange={(e) => updateField("headerInvoiceLine", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="headerReferenceLine">Kopfzeile Referenz (z.B. I/Referenz)</Label>
            <Input
              id="headerReferenceLine"
              value={template.headerReferenceLine}
              onChange={(e) => updateField("headerReferenceLine", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="introText">Einleitungstext</Label>
            <Textarea
              id="introText"
              rows={2}
              value={template.introText}
              onChange={(e) => updateField("introText", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentBlockText">Text im Zahlungsblock (unter IBAN)</Label>
            <Textarea
              id="paymentBlockText"
              rows={3}
              value={template.paymentBlockText}
              onChange={(e) => updateField("paymentBlockText", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="closingText">Zahlungshinweis (Legacy / E-Mail)</Label>
            <Textarea
              id="closingText"
              rows={3}
              value={template.closingText}
              onChange={(e) => updateField("closingText", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="centerFooterText">Zentrierter Footer (ganz unten)</Label>
            <Textarea
              id="centerFooterText"
              rows={2}
              value={template.centerFooterText}
              onChange={(e) => updateField("centerFooterText", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="footerNote">Abschlusstext / Fussnote im Dokument (optional)</Label>
            <Textarea
              id="footerNote"
              rows={2}
              value={template.footerNote}
              onChange={(e) => updateField("footerNote", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => void saveTemplate()} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Vorlage speichern
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={previewing}
          onClick={() => void openPreview()}
        >
          {previewing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Eye className="mr-2 h-4 w-4" />
          )}
          PDF-Vorschau
        </Button>
      </div>
    </div>
  )
}
