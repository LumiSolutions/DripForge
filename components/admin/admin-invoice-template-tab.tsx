"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Download, Loader2, Save, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import {
  DOCUMENT_BASE_FONT_SIZES,
  DOCUMENT_FONT_CSS,
  DOCUMENT_FONT_FAMILIES,
  DOCUMENT_FONT_LABELS,
  DOCUMENT_HEADER_HEIGHT_MM,
  DOCUMENT_TEMPLATE_TYPES,
  LOGO_ALIGNMENTS,
  MAX_LOGO_WIDTH_PERCENT,
  MIN_LOGO_WIDTH_PERCENT,
  MWST_EXEMPT_LEGAL_NOTE,
  applyDocumentTemplatePlaceholders,
  buildDocumentPlaceholderValues,
  formatDocumentDueDate,
  getPaymentPageCompanyLines,
  resolveDocumentFooterLines,
  type DocumentFontFamily,
  type DocumentLogoAlignment,
  type DocumentTemplateSettings,
  type DocumentTemplateType,
  type DocumentTypeTextSettings,
} from "@/lib/documents/document-template-types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import "@/components/admin/document-preview-print.css"

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

const LOGO_ALIGNMENT_LABELS: Record<DocumentLogoAlignment, string> = {
  left: "Links",
  center: "Mitte",
  right: "Rechts",
}

const PREVIEW_ITEMS = [
  {
    name: "3D-Druck Prototyp",
    details: "PLA Schwarz, 80 x 60 x 25 mm, gehaeuse.stl",
    quantity: 2,
    unit: "CHF 45.50",
    total: "CHF 91.00",
    vat: "0%",
  },
  {
    name: "Lasergravur Holz",
    details: "Birke, Gravurtext: DripForge 2026",
    quantity: 1,
    unit: "CHF 28.00",
    total: "CHF 28.00",
    vat: "0%",
  },
]

function formatPreviewDate(date: Date): string {
  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

function renderTemplateText(text: string, values: Record<string, string>): string {
  return applyDocumentTemplatePlaceholders(text, values)
}

function previewNumberLabel(documentType: DocumentTemplateType): string {
  if (documentType === "quote") return "Angebotsnummer"
  if (documentType === "deliveryNote") return "Lieferscheinnummer"
  return "Rechnungsnummer"
}

function previewDateLabel(documentType: DocumentTemplateType): string {
  if (documentType === "quote") return "Angebotsdatum"
  if (documentType === "deliveryNote") return "Lieferscheindatum"
  return "Rechnungsdatum"
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
  const previewIso = new Date().toISOString()
  const formattedDate = formatPreviewDate(new Date())
  const dueDate = formatDocumentDueDate(previewIso, template.paymentTermsDays)
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
  const headerLine = renderTemplateText(documentText.headerLine, placeholderValues)
  const referenceLine = renderTemplateText(documentText.referenceLine, placeholderValues)
  const introText = renderTemplateText(documentText.introText, placeholderValues)
  const footerNote = renderTemplateText(documentText.footerNote, placeholderValues)
  const paymentBlockText = renderTemplateText(
    documentText.paymentBlockText,
    placeholderValues
  )
  const customFooter = renderTemplateText(documentText.centerFooterText, placeholderValues)
  const footerLines = resolveDocumentFooterLines(template, customFooter)
  const paymentCompanyLines = getPaymentPageCompanyLines(template)
  const logoAlignClass =
    template.logoAlignment === "left"
      ? "justify-start"
      : template.logoAlignment === "center"
        ? "justify-center"
        : "justify-end"

  return (
    <div className="rounded-2xl border border-border bg-slate-100 p-4 shadow-inner dark:bg-slate-950/60">
      <div className="document-preview-chrome mb-3 flex items-center justify-between gap-3">
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

      <div className="document-preview-pages mx-auto flex w-full max-w-[620px] flex-col gap-6">
        <div className="document-preview-page aspect-[210/297] overflow-hidden rounded-sm text-slate-900 shadow-2xl">
          <div
            className="document-preview-page-inner"
            style={{
              fontFamily: DOCUMENT_FONT_CSS[template.fontFamily],
              fontSize: `${template.baseFontSize}px`,
            }}
          >
          <div
            className={cn("flex shrink-0 items-center", logoAlignClass)}
            style={{ height: `${DOCUMENT_HEADER_HEIGHT_MM}mm` }}
          >
            {template.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={template.logoUrl}
                alt="Dokumentenlogo Vorschau"
                className="h-auto object-contain"
                style={{
                  width: `${template.logoWidthPercent}%`,
                  maxHeight: `${DOCUMENT_HEADER_HEIGHT_MM - 4}mm`,
                }}
              />
            ) : (
              <div
                className="flex items-center justify-center rounded border border-dashed border-slate-300 text-[0.7em] text-slate-400"
                style={{
                  width: `${template.logoWidthPercent}%`,
                  maxHeight: `${DOCUMENT_HEADER_HEIGHT_MM - 4}mm`,
                  minHeight: "24mm",
                }}
              >
                Logo
              </div>
            )}
          </div>

          <div className="mb-3 max-w-[52%] leading-relaxed">
            <p>Max Muster</p>
            <p>Musterstrasse 12</p>
            <p>8000 Zuerich</p>
            <p>Schweiz</p>
          </div>

          <div className="mb-4 grid grid-cols-5 gap-2 rounded bg-slate-100 px-3 py-2">
            <div>
              <p className="text-[0.65em] uppercase tracking-wide text-slate-400">
                {previewNumberLabel(documentType)}
              </p>
              <p className="font-semibold">{documentNumber}</p>
            </div>
            <div>
              <p className="text-[0.65em] uppercase tracking-wide text-slate-400">
                {previewDateLabel(documentType)}
              </p>
              <p className="font-semibold">{formattedDate}</p>
            </div>
            <div>
              <p className="text-[0.65em] uppercase tracking-wide text-slate-400">
                Zahlungsfrist
              </p>
              <p className="font-semibold">{template.paymentTermsDays} Tage</p>
            </div>
            <div>
              <p className="text-[0.65em] uppercase tracking-wide text-slate-400">
                Faelligkeitsdatum
              </p>
              <p className="font-semibold">{dueDate}</p>
            </div>
            <div>
              <p className="text-[0.65em] uppercase tracking-wide text-slate-400">Versandart</p>
              <p className="font-semibold">A-Post</p>
            </div>
          </div>

          <div className="mb-3 h-px bg-slate-200" />
          <div className="mb-3 h-0.5 w-12 bg-orange-500" />
          <h3 className="text-[1.35em] font-bold">{headerLine}</h3>
          {referenceLine ? (
            <p className="mt-1 text-[0.95em] text-slate-600">{referenceLine}</p>
          ) : null}
          {introText ? (
            <p className="mt-3 max-w-[90%] text-[0.9em] leading-relaxed text-slate-500">
              {introText}
            </p>
          ) : null}

          <div className="mt-4 overflow-hidden rounded border border-slate-200">
            <div className="grid grid-cols-[1fr_1.4fr_0.45fr_0.75fr_0.75fr_0.55fr] bg-slate-800 px-2 py-2 text-[0.65em] font-bold uppercase tracking-wider text-white">
              <span>Produkt</span>
              <span>Details</span>
              <span className="text-center">Menge</span>
              <span className="text-right">Einzelpreis</span>
              <span className="text-right">Total</span>
              <span className="text-right">MWST</span>
            </div>
            {PREVIEW_ITEMS.map((item, index) => (
              <div
                key={item.name}
                className={cn(
                  "grid grid-cols-[1fr_1.4fr_0.45fr_0.75fr_0.75fr_0.55fr] border-t border-slate-200 px-2 py-2",
                  index % 2 === 1 && "bg-slate-50"
                )}
              >
                <span className="font-semibold">{item.name}</span>
                <span className="text-slate-500">{item.details}</span>
                <span className="text-center text-slate-600">{item.quantity}</span>
                <span className="text-right text-slate-600">{item.unit}</span>
                <span className="text-right font-semibold">{item.total}</span>
                <span className="text-right text-slate-600">{item.vat}</span>
              </div>
            ))}
          </div>

          <p className="mt-2 text-[0.72em] text-slate-500">{MWST_EXEMPT_LEGAL_NOTE}</p>

          <div className="mt-3 flex justify-end">
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
            </div>
          </div>

          {footerNote ? (
            <p className="mt-3 max-w-[90%] text-[0.85em] text-slate-500">{footerNote}</p>
          ) : null}

          <div className="invoice-footer">
            {footerLines.line1 ? (
              <p className="text-[0.78em] font-bold text-slate-500">{footerLines.line1}</p>
            ) : null}
            {footerLines.line2 ? (
              <p className="text-[0.72em]">{footerLines.line2}</p>
            ) : null}
            {footerLines.line3 ? (
              <p className="text-[0.72em]">{footerLines.line3}</p>
            ) : null}
          </div>
          </div>
        </div>

        {documentText.showPaymentBlock ? (
          <div
            className="document-preview-page payment-page overflow-hidden rounded-sm text-slate-900 shadow-2xl"
            style={{
              fontFamily: DOCUMENT_FONT_CSS[template.fontFamily],
              fontSize: `${template.baseFontSize}px`,
            }}
          >
            <div
              className={cn("flex shrink-0 items-center px-[20mm]", logoAlignClass)}
              style={{ height: `${DOCUMENT_HEADER_HEIGHT_MM}mm` }}
            >
              {template.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={template.logoUrl}
                  alt="Dokumentenlogo Seite 2"
                  className="h-auto object-contain"
                  style={{
                    width: `${template.logoWidthPercent}%`,
                    maxHeight: `${DOCUMENT_HEADER_HEIGHT_MM - 4}mm`,
                  }}
                />
              ) : (
                <div
                  className="flex items-center justify-center rounded border border-dashed border-slate-300 text-[0.7em] text-slate-400"
                  style={{
                    width: `${template.logoWidthPercent}%`,
                    maxHeight: `${DOCUMENT_HEADER_HEIGHT_MM - 4}mm`,
                    minHeight: "24mm",
                  }}
                >
                  Logo
                </div>
              )}
            </div>

            <div className="payment-bottom-container">
              <div className="mb-3 space-y-0.5 text-center text-[0.95em]">
                {paymentCompanyLines.map((line, index) => (
                  <p
                    key={`${line}-${index}`}
                    className={index === 0 ? "font-bold" : "text-slate-600"}
                  >
                    {line}
                  </p>
                ))}
              </div>
              <div className="mb-4 border-t border-dashed border-slate-400" />
              <div className="payment-section">
                <div>
                  <p className="mb-2 text-[0.72em] font-bold uppercase tracking-widest text-orange-500">
                    Zahlungsverbindung
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
                </div>
                <div className="payment-right-column">
                  {template.qrPaymentImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={template.qrPaymentImageUrl}
                      alt="QR-Zahlteil"
                      className="payment-qr"
                    />
                  ) : null}
                  <p className="payment-amount">CHF 128.00</p>
                  {paymentBlockText ? (
                    <p className="payment-note">{paymentBlockText}</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
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
  const [uploadingQrPayment, setUploadingQrPayment] = useState(false)
  const [downloadingPreview, setDownloadingPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qrFileInputRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    const id = "document-preview-fonts"
    if (document.getElementById(id)) return
    const link = document.createElement("link")
    link.id = id
    link.rel = "stylesheet"
    link.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Roboto:wght@400;700&display=swap"
    document.head.appendChild(link)
  }, [])

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

const MAX_LOGO_BYTES = 5 * 1024 * 1024

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true)
    setError(null)
    setSuccess(null)
    try {
      if (file.size > MAX_LOGO_BYTES) {
        const message = "Das Logo darf maximal 5 MB gross sein."
        setError(message)
        window.alert(message)
        return
      }
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

  const handleQrPaymentUpload = async (file: File) => {
    setUploadingQrPayment(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/admin/document-template/qr-payment", {
        method: "POST",
        credentials: "include",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Upload fehlgeschlagen")
      setTemplate(data.template as DocumentTemplateSettings)
      setSuccess("QR-Zahlteil hochgeladen.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "QR-Zahlteil-Upload fehlgeschlagen")
    } finally {
      setUploadingQrPayment(false)
    }
  }

  const downloadPreviewPdf = async () => {
    if (!template) return
    setDownloadingPreview(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/document-template/preview", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: selectedType,
          download: true,
          template,
          orderId: "preview",
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? "PDF-Vorschau konnte nicht erstellt werden.")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      const label = template.documentTypes[selectedType].label
      const number = PREVIEW_NUMBERS[selectedType]
      anchor.href = url
      anchor.download = `${label}-Vorschau-${number}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setSuccess("Vorschau-PDF heruntergeladen.")
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "PDF-Vorschau konnte nicht erstellt werden."
      )
    } finally {
      setDownloadingPreview(false)
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
                  <Label htmlFor="website">Website (Footer)</Label>
                  <Input
                    id="website"
                    value={template.website}
                    onChange={(e) => updateField("website", e.target.value)}
                    placeholder="www.dripforge.ch"
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
              <p className="text-xs text-muted-foreground">
                PNG, JPEG, WebP oder SVG — das Logo darf maximal 5 MB gross sein.
              </p>
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
              <div className="space-y-2">
                <Label>Logo-Ausrichtung in der Kopfzeile</Label>
                <div className="flex flex-wrap gap-2">
                  {LOGO_ALIGNMENTS.map((alignment) => (
                    <button
                      key={alignment}
                      type="button"
                      onClick={() => updateField("logoAlignment", alignment)}
                      className={cn(
                        "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                        template.logoAlignment === alignment
                          ? adminUi.navActive
                          : adminUi.navInactive
                      )}
                    >
                      {LOGO_ALIGNMENT_LABELS[alignment]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="logoWidthPercent">
                  Logo-Breite ({template.logoWidthPercent}% der Inhaltsbreite)
                </Label>
                <input
                  id="logoWidthPercent"
                  type="range"
                  min={MIN_LOGO_WIDTH_PERCENT}
                  max={MAX_LOGO_WIDTH_PERCENT}
                  value={template.logoWidthPercent}
                  onChange={(e) =>
                    updateField("logoWidthPercent", Number(e.target.value))
                  }
                  className="w-full accent-orange-500"
                />
                <p className="text-xs text-muted-foreground">
                  Kopfzeile fix {DOCUMENT_HEADER_HEIGHT_MM} mm hoch (Fensterbrief C5). Die
                  Empfaengeradresse beginnt direkt darunter.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className={adminUi.section}>
            <CardContent className="space-y-4 p-6">
              <h2 className="font-semibold">Schrift &amp; Textformatierung</h2>
              <p className="text-sm text-muted-foreground">
                Gilt global fuer Live-Vorschau und PDF-Export aller Dokumenten-Vorlagen.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fontFamily">Schriftart</Label>
                  <Select
                    value={template.fontFamily}
                    onValueChange={(value) =>
                      updateField("fontFamily", value as DocumentFontFamily)
                    }
                  >
                    <SelectTrigger id="fontFamily" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_FONT_FAMILIES.map((family) => (
                        <SelectItem key={family} value={family}>
                          {DOCUMENT_FONT_LABELS[family]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="baseFontSize">Basis-Schriftgroesse</Label>
                  <Select
                    value={String(template.baseFontSize)}
                    onValueChange={(value) =>
                      updateField("baseFontSize", Number(value) as typeof template.baseFontSize)
                    }
                  >
                    <SelectTrigger id="baseFontSize" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_BASE_FONT_SIZES.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size} pt
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={adminUi.section}>
            <CardContent className="space-y-4 p-6">
              <h2 className="font-semibold">QR-Code Zahlteil (Bild hochladen)</h2>
              <p className="text-sm text-muted-foreground">
                Fuer normale IBAN-Zahlungen: QR-Zahlteil als Bild hochladen. Wird neben den
                Zahlungsdaten in der Vorschau und im PDF angezeigt.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                {template.qrPaymentImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={template.qrPaymentImageUrl}
                    alt="QR-Zahlteil"
                    className="h-20 w-20 rounded-lg border border-border object-contain bg-white p-1"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                    Kein QR
                  </div>
                )}
                <input
                  ref={qrFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleQrPaymentUpload(file)
                    e.target.value = ""
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingQrPayment}
                  onClick={() => qrFileInputRef.current?.click()}
                >
                  {uploadingQrPayment ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  QR-Zahlteil hochladen
                </Button>
                {template.qrPaymentImageUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => updateField("qrPaymentImageUrl", null)}
                  >
                    QR entfernen
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
              <p className="text-xs text-muted-foreground">
                Footer-Kontaktdaten erscheinen nur auf der ersten Seite (Rechnung) als
                dezenter Block ganz unten — nicht auf der Zahlungsverbindungs-Seite.
              </p>
            </CardContent>
          </Card>

          <div
            className={cn(
              "sticky bottom-0 space-y-2 rounded-xl border p-4 shadow-lg backdrop-blur",
              adminUi.section
            )}
          >
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={downloadingPreview || !template}
              onClick={() => void downloadPreviewPdf()}
            >
              {downloadingPreview ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Vorschau-PDF herunterladen
            </Button>
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
          <div className="mb-3 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={downloadingPreview || !template}
              onClick={() => void downloadPreviewPdf()}
            >
              {downloadingPreview ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Vorschau-PDF herunterladen
            </Button>
          </div>
          <DocumentLivePreview template={template} documentType={selectedType} />
        </div>
      </div>
    </div>
  )
}
