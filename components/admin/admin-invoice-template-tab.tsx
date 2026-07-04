"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Save, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import {
  DOCUMENT_TEMPLATE_TYPES,
  applyDocumentTemplatePlaceholders,
  buildDocumentPlaceholderValues,
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

const PREVIEW_NUMBERS: Record<DocumentTemplateType, string> = {
  invoice: "RE-00001",
  quote: "AN-00001",
  deliveryNote: "LI-00001",
}

const PREVIEW_ITEMS = [
  {
    name: "3D-Druck Prototyp",
    details: "PLA Schwarz, 80 x 60 x 25 mm, gehaeuse.stl",
    quantity: 2,
    unit: "CHF 45.50",
    total: "CHF 91.00",
  },
  {
    name: "Lasergravur Holz",
    details: "Birke, Gravurtext: DripForge 2026",
    quantity: 1,
    unit: "CHF 28.00",
    total: "CHF 28.00",
  },
]

function formatPreviewDate(date: Date): string {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

function addressLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

function renderTemplateText(text: string, values: Record<string, string>): string {
  return applyDocumentTemplatePlaceholders(text, values)
}

function DocumentLivePreview({
  template,
  documentType,
}: {
  template: DocumentTemplateSettings
  documentType: DocumentTemplateType
}) {
  const documentText = template.documentTypes[documentType]
  const documentNumber = PREVIEW_NUMBERS[documentType]
  const formattedDate = formatPreviewDate(new Date())
  const placeholderValues = buildDocumentPlaceholderValues(template, {
    belegnummer: documentNumber,
    dokumentnummer: documentNumber,
    dokumenttyp: documentText.label,
    rechnungsnummer: documentType === "invoice" ? documentNumber : "RE-00001",
    angebotsnummer: documentType === "quote" ? documentNumber : "AN-00001",
    lieferscheinnummer:
      documentType === "deliveryNote" ? documentNumber : "LI-00001",
    datum: formattedDate,
  })
  const companyAddressLines = addressLines(template.firmenAdresse)
  const returnAddress =
    `${template.firmenname} · ${companyAddressLines.slice(1).join(", ") || companyAddressLines[0] || ""}`.trim()
  const headerLine = renderTemplateText(documentText.headerLine, placeholderValues)
  const referenceLine = renderTemplateText(documentText.referenceLine, placeholderValues)
  const introText = renderTemplateText(documentText.introText, placeholderValues)
  const footerNote = renderTemplateText(documentText.footerNote, placeholderValues)
  const paymentBlockText = renderTemplateText(
    documentText.paymentBlockText,
    placeholderValues
  )
  const centerFooterText = renderTemplateText(
    documentText.centerFooterText,
    placeholderValues
  )

  return (
    <div className="rounded-2xl border border-border bg-slate-100 p-4 shadow-inner dark:bg-slate-950/60">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-500">
            Live-Vorschau
          </p>
          <p className="text-sm text-muted-foreground">
            {documentText.label} · {documentNumber}
          </p>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          Live
        </span>
      </div>

      <div className="mx-auto aspect-[210/297] w-full max-w-[620px] overflow-hidden rounded-sm bg-white text-slate-900 shadow-2xl">
        <div className="relative flex h-full flex-col p-[7%] text-[clamp(7px,0.72vw,10px)]">
          <div className="absolute left-[9.5%] top-[7.5%] max-w-[42%] truncate text-[0.7em] text-slate-400">
            {returnAddress}
          </div>

          {template.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={template.logoUrl}
              alt="Dokumentenlogo Vorschau"
              className="absolute right-[9.5%] top-[7%] h-[7.5%] w-[12%] object-contain"
            />
          ) : (
            <div className="absolute right-[9.5%] top-[7%] flex h-[7.5%] w-[12%] items-center justify-center rounded border border-dashed border-slate-300 text-[0.6em] text-slate-400">
              Logo
            </div>
          )}

          <div className="absolute left-[9.5%] top-[15.5%] w-[42%] leading-relaxed">
            <p>Max Muster</p>
            <p>Musterstrasse 12</p>
            <p>8000 Zuerich</p>
            <p>Schweiz</p>
          </div>

          <div className="absolute right-[9.5%] top-[15.5%] text-right">
            <p className="text-[0.7em] uppercase tracking-widest text-slate-400">Datum</p>
            <p className="font-semibold">{formattedDate}</p>
          </div>

          <div className="mt-[36%]">
            <div className="mb-3 h-px bg-slate-200" />
            <div className="mb-3 h-0.5 w-12 bg-orange-500" />
            <h3 className="text-[1.35em] font-bold">{headerLine}</h3>
            {referenceLine ? (
              <p className="mt-1 text-[0.95em] text-slate-600">{referenceLine}</p>
            ) : null}
            {introText ? (
              <p className="mt-3 max-w-[82%] text-[0.9em] leading-relaxed text-slate-500">
                {introText}
              </p>
            ) : null}
          </div>

          <div className="mt-5 overflow-hidden rounded border border-slate-200">
            <div className="grid grid-cols-[1.15fr_1.65fr_0.45fr_0.8fr_0.8fr] bg-slate-800 px-3 py-2 text-[0.72em] font-bold uppercase tracking-wider text-white">
              <span>Produkt</span>
              <span>Details</span>
              <span className="text-center">Menge</span>
              <span className="text-right">Einzelpreis</span>
              <span className="text-right">Total</span>
            </div>
            {PREVIEW_ITEMS.map((item, index) => (
              <div
                key={item.name}
                className={cn(
                  "grid grid-cols-[1.15fr_1.65fr_0.45fr_0.8fr_0.8fr] border-t border-slate-200 px-3 py-2",
                  index % 2 === 1 && "bg-slate-50"
                )}
              >
                <span className="font-semibold">{item.name}</span>
                <span className="text-slate-500">{item.details}</span>
                <span className="text-center text-slate-600">{item.quantity}</span>
                <span className="text-right text-slate-600">{item.unit}</span>
                <span className="text-right font-semibold">{item.total}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-[42%] rounded border border-slate-200 bg-white px-3 py-2">
              <div className="flex justify-between text-slate-500">
                <span>Zwischensumme</span>
                <span>CHF 119.00</span>
              </div>
              <div className="mt-1 flex justify-between text-slate-500">
                <span>Versand (A-Post)</span>
                <span>CHF 9.00</span>
              </div>
              <div className="mt-2 flex justify-between border-t-2 border-orange-500 pt-2 font-bold">
                <span>Gesamtbetrag</span>
                <span>CHF 128.00</span>
              </div>
              <p className="mt-2 text-right text-[0.72em] italic text-slate-400">
                MwSt.-befreit (Kleinunternehmer gem. Art. 10 MWSTG)
              </p>
            </div>
          </div>

          {footerNote ? (
            <p className="mt-3 max-w-[82%] text-[0.85em] text-slate-500">{footerNote}</p>
          ) : null}

          <div className="mt-auto">
            {documentText.showPaymentBlock ? (
              <div className="grid h-[22%] grid-cols-[1fr_32%] border-t border-slate-900 bg-orange-50 px-3 py-3">
                <div className="border-r border-orange-100 pr-3">
                  <p className="mb-2 text-[0.72em] font-bold uppercase tracking-widest text-orange-500">
                    Zahlungsinformationen
                  </p>
                  <p className="font-bold">Kontoinhaber</p>
                  <p className="whitespace-pre-line text-slate-600">
                    {template.firmenname}
                    {template.inhaber ? `\n${template.inhaber}` : ""}
                  </p>
                  {template.iban ? (
                    <>
                      <p className="mt-2 font-bold">IBAN</p>
                      <p className="text-slate-600">{template.iban}</p>
                    </>
                  ) : null}
                  {template.bankname ? (
                    <p className="text-slate-600">{template.bankname}</p>
                  ) : null}
                  <p className="mt-2 font-bold">Referenz / Zahlungszweck</p>
                  <p className="text-slate-600">{documentNumber}</p>
                  {paymentBlockText ? (
                    <p className="mt-2 line-clamp-2 text-[0.8em] text-slate-500">
                      {paymentBlockText}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-center justify-center pl-3">
                  <div className="grid aspect-square w-[72%] grid-cols-4 grid-rows-4 gap-1 bg-white p-2 shadow-sm">
                    {Array.from({ length: 16 }).map((_, index) => (
                      <span
                        key={index}
                        className={cn(
                          "block",
                          [0, 1, 4, 5, 10, 11, 14].includes(index)
                            ? "bg-slate-900"
                            : "bg-slate-200"
                        )}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-center text-[0.7em] text-slate-500">
                    Swiss QR-Zahlteil
                  </p>
                </div>
              </div>
            ) : null}
            {centerFooterText ? (
              <p className="mt-2 truncate text-center text-[0.72em] text-slate-400">
                {centerFooterText}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export function AdminInvoiceTemplateTab() {
  const [template, setTemplate] = useState<DocumentTemplateSettings | null>(null)
  const [selectedType, setSelectedType] = useState<DocumentTemplateType>("invoice")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
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
    <div className="mx-auto max-w-7xl space-y-6">
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

      <div className="grid gap-6 lg:grid-cols-[minmax(340px,40%)_minmax(0,60%)] lg:items-start">
        <div className="space-y-5 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto lg:pr-2">
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

          <div className={cn("sticky bottom-0 rounded-xl border p-4 shadow-lg backdrop-blur", adminUi.section)}>
            <Button type="button" onClick={() => void saveTemplate()} disabled={saving} className="w-full">
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Vorlage speichern
            </Button>
          </div>
        </div>

        <div className="lg:sticky lg:top-6">
          <DocumentLivePreview template={template} documentType={selectedType} />
        </div>
      </div>
    </div>
  )
}
