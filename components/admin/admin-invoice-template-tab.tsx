"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Eye, Loader2, Save, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import {
  DOCUMENT_TEMPLATE_TYPES,
  type DocumentTemplateSettings,
  type DocumentTemplateType,
  type DocumentTypeTextSettings,
} from "@/lib/documents/document-template-types"
import { cn } from "@/lib/utils"

const DOCUMENT_TYPE_LABELS: Record<DocumentTemplateType, string> = {
  invoice: "Rechnung",
  quote: "Angebot",
  deliveryNote: "Lieferschein",
}

const DOCUMENT_PLACEHOLDERS = [
  "{firmenname}",
  "{belegnummer}",
  "{dokumenttyp}",
  "{datum}",
  "{zahlungsfrist}",
  "{iban}",
  "{bank}",
  "{rechnungsnummer}",
  "{angebotsnummer}",
  "{lieferscheinnummer}",
]

export function AdminInvoiceTemplateTab() {
  const [template, setTemplate] = useState<DocumentTemplateSettings | null>(null)
  const [selectedType, setSelectedType] = useState<DocumentTemplateType>("invoice")
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
      const res = await fetch("/api/admin/document-template", {
        cache: "no-store",
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      setTemplate(data.template as DocumentTemplateSettings)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Dokumenten-Vorlage konnte nicht geladen werden."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTemplate(), 0)
    return () => window.clearTimeout(timer)
  }, [loadTemplate])

  const updateField = <K extends keyof DocumentTemplateSettings>(
    key: K,
    value: DocumentTemplateSettings[K]
  ) => {
    setTemplate((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const updateDocumentField = <K extends keyof DocumentTypeTextSettings>(
    key: K,
    value: DocumentTypeTextSettings[K]
  ) => {
    setTemplate((prev) =>
      prev
        ? {
            ...prev,
            documentTypes: {
              ...prev.documentTypes,
              [selectedType]: {
                ...prev.documentTypes[selectedType],
                [key]: value,
              },
            },
          }
        : prev
    )
  }

  const saveTemplate = async () => {
    if (!template) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/admin/document-template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(template),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")
      setTemplate(data.template as DocumentTemplateSettings)
      setSuccess("Dokumenten-Vorlage gespeichert. Firmendaten wurden mit Shop-Einstellungen synchronisiert.")
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
      const res = await fetch("/api/admin/document-template/logo", {
        method: "POST",
        credentials: "include",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Upload fehlgeschlagen")
      setTemplate(data.template as DocumentTemplateSettings)
      setSuccess("Dokumentenlogo hochgeladen.")
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
      const res = await fetch("/api/admin/document-template/preview", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "preview", documentType: selectedType }),
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
        Dokumenten-Vorlage wird geladen…
      </div>
    )
  }

  if (!template) {
    return (
      <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
        {error ?? "Dokumenten-Vorlage konnte nicht geladen werden."}
      </p>
    )
  }

  const documentText = template.documentTypes[selectedType]

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dokumenten-Vorlagen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Globales Master-Layout fuer Rechnungen, Angebote, Lieferscheine und weitere
          PDF-Belege. Platzhalter: {DOCUMENT_PLACEHOLDERS.join(", ")}
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
          <h2 className="font-semibold">Globale Firmendaten</h2>
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
          <h2 className="font-semibold">Dokumentenlogo</h2>
          <div className="flex flex-wrap items-center gap-4">
            {template.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={template.logoUrl}
                alt="Dokumentenlogo"
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
          <div>
            <h2 className="font-semibold">Texte pro Dokumenttyp</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Jeder Belegtyp nutzt dieselben globalen Daten, kann aber eigene Kopfzeilen,
              Hinweise und Footer-Texte haben.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {DOCUMENT_TEMPLATE_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  selectedType === type ? adminUi.navActive : adminUi.navInactive
                )}
              >
                {DOCUMENT_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="documentLabel">Belegname</Label>
            <Input
              id="documentLabel"
              value={documentText.label}
              onChange={(e) => updateDocumentField("label", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="numberPlaceholder">Nummern-Platzhalter</Label>
            <Input
              id="numberPlaceholder"
              value={documentText.numberPlaceholder}
              onChange={(e) => updateDocumentField("numberPlaceholder", e.target.value)}
              placeholder="z.B. rechnungsnummer"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="headerLine">Kopfzeile</Label>
            <Input
              id="headerLine"
              value={documentText.headerLine}
              onChange={(e) => updateDocumentField("headerLine", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="referenceLine">Referenzzeile</Label>
            <Input
              id="referenceLine"
              value={documentText.referenceLine}
              onChange={(e) => updateDocumentField("referenceLine", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="introText">Einleitungstext</Label>
            <Textarea
              id="introText"
              rows={2}
              value={documentText.introText}
              onChange={(e) => updateDocumentField("introText", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentBlockText">Text im QR-Zahlteil / Zahlungsblock</Label>
            <Textarea
              id="paymentBlockText"
              rows={3}
              value={documentText.paymentBlockText}
              onChange={(e) => updateDocumentField("paymentBlockText", e.target.value)}
              disabled={!documentText.showPaymentBlock}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="closingText">Zahlungs- oder Schlusstext (E-Mail / Legacy)</Label>
            <Textarea
              id="closingText"
              rows={3}
              value={documentText.closingText}
              onChange={(e) => updateDocumentField("closingText", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="centerFooterText">Zentrierter Footer (ganz unten)</Label>
            <Textarea
              id="centerFooterText"
              rows={2}
              value={documentText.centerFooterText}
              onChange={(e) => updateDocumentField("centerFooterText", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="footerNote">Abschlusstext / Fussnote im Dokument (optional)</Label>
            <Textarea
              id="footerNote"
              rows={2}
              value={documentText.footerNote}
              onChange={(e) => updateDocumentField("footerNote", e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={documentText.showPaymentBlock}
              onChange={(e) => updateDocumentField("showPaymentBlock", e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            QR-Zahlteil fuer diesen Dokumenttyp anzeigen
          </label>
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
