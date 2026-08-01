"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  Monitor,
  RotateCcw,
  Smartphone,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import {
  DEFAULT_ORDER_EMAIL_TEMPLATES,
  ORDER_EMAIL_PLACEHOLDER_HINT,
  type OrderEmailTemplates,
} from "@/lib/email/order-email-templates"
import {
  DEFAULT_ORDER_EMAIL_LAYOUT,
  DEFAULT_ORDER_EMAIL_META_FIELDS,
  ORDER_EMAIL_META_FIELD_LABELS,
  ORDER_EMAIL_SECTION_LABELS,
  type OrderEmailLayout,
  type OrderEmailLogoPosition,
  type OrderEmailMetaFields,
  type OrderEmailSectionId,
} from "@/lib/email/order-email-layout"
import { renderOrderEmailPreviewHtml } from "@/lib/email/order-email-preview"
import { cn } from "@/lib/utils"

type AdminEmailTemplateBuilderProps = {
  templates: OrderEmailTemplates
  layout: OrderEmailLayout
  onTemplatesChange: (next: OrderEmailTemplates) => void
  onLayoutChange: (next: OrderEmailLayout) => void
  /** Logo aus Dokumenten-/Belege-Einstellungen (Fallback: Standard-Logo). */
  documentLogoUrl?: string | null
}

function moveSection(
  order: OrderEmailSectionId[],
  index: number,
  direction: -1 | 1
): OrderEmailSectionId[] {
  const target = index + direction
  if (target < 0 || target >= order.length) return order
  const next = [...order]
  const tmp = next[index]!
  next[index] = next[target]!
  next[target] = tmp
  return next
}

type PreviewMode = "desktop" | "mobile"

export function AdminEmailTemplateBuilder({
  templates,
  layout,
  onTemplatesChange,
  onLayoutChange,
  documentLogoUrl,
}: AdminEmailTemplateBuilderProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop")
  const [logoOverride, setLogoOverride] = useState(layout.logoUrl ?? "")
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null)
  const logoFileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setLogoOverride(layout.logoUrl ?? "")
  }, [layout.logoUrl])

  const uploadEmailLogo = useCallback(
    async (file: File) => {
      setLogoUploading(true)
      setLogoUploadError(null)
      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("productId", "email-logo")
        formData.append("category", "email-logo")
        const res = await fetch("/api/admin/upload", {
          method: "POST",
          credentials: "include",
          body: formData,
        })
        const data = (await res.json()) as { url?: string; error?: string }
        if (!res.ok || !data.url) {
          throw new Error(data.error ?? "Logo-Upload fehlgeschlagen")
        }
        setLogoOverride(data.url)
        onLayoutChange({ ...layout, logoUrl: data.url })
      } catch (err) {
        setLogoUploadError(
          err instanceof Error ? err.message : "Logo-Upload fehlgeschlagen"
        )
      } finally {
        setLogoUploading(false)
      }
    },
    [layout, onLayoutChange]
  )

  const effectiveLogoUrl =
    (layout.logoUrl && layout.logoUrl.trim()) ||
    (documentLogoUrl && documentLogoUrl.trim()) ||
    null

  const previewHtml = useMemo(
    () =>
      renderOrderEmailPreviewHtml({
        templates,
        layout,
        logoUrl: effectiveLogoUrl,
      }),
    [templates, layout, effectiveLogoUrl]
  )

  const resetDefaults = () => {
    onTemplatesChange({ ...DEFAULT_ORDER_EMAIL_TEMPLATES })
    onLayoutChange({
      ...DEFAULT_ORDER_EMAIL_LAYOUT,
      sectionOrder: [...DEFAULT_ORDER_EMAIL_LAYOUT.sectionOrder],
      logoUrl: "",
      metaFields: { ...DEFAULT_ORDER_EMAIL_META_FIELDS },
    })
  }

  const onDropAt = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null)
      return
    }
    const next = [...layout.sectionOrder]
    const [removed] = next.splice(dragIndex, 1)
    if (!removed) {
      setDragIndex(null)
      return
    }
    next.splice(targetIndex, 0, removed)
    onLayoutChange({ ...layout, sectionOrder: next })
    setDragIndex(null)
  }

  const frameWidth = previewMode === "mobile" ? 390 : 680

  return (
    <div className="space-y-4">
      <div>
        <h3 className={cn("text-base font-semibold", adminUi.accentTitle)}>
          E-Mail-Layout Builder
        </h3>
        <p className={cn("mt-1 text-sm", adminUi.muted)}>
          Abschnitte anordnen, Texte bearbeiten und die Kunden-Bestätigungsmail
          live Vorschau prüfen. {ORDER_EMAIL_PLACEHOLDER_HINT}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          <div className={cn("space-y-3 rounded-xl border p-4", adminUi.section)}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={cn("text-sm font-semibold", adminUi.heading)}>
                  Logo anzeigen
                </p>
                <p className={cn("text-xs", adminUi.muted)}>
                  Standard: Logo aus Dokumentenvorlage / Belege-Einstellungen
                </p>
              </div>
              <Switch
                checked={layout.showLogo}
                onCheckedChange={(checked) =>
                  onLayoutChange({ ...layout, showLogo: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label className={cn("text-sm font-semibold", adminUi.heading)}>
                Logo-Ausrichtung
              </Label>
              <Select
                value={layout.logoPosition}
                onValueChange={(value) =>
                  onLayoutChange({
                    ...layout,
                    logoPosition: value as OrderEmailLogoPosition,
                  })
                }
                disabled={!layout.showLogo}
              >
                <SelectTrigger className={adminUi.select}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Links</SelectItem>
                  <SelectItem value="center">Mitte</SelectItem>
                  <SelectItem value="right">Rechts</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="orderEmailLogoUrl"
                className={cn("text-sm font-semibold", adminUi.heading)}
              >
                E-Mail-Logo (Azure Upload)
              </Label>
              {documentLogoUrl?.trim() ? (
                <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={documentLogoUrl}
                    alt="Dokumenten-Logo"
                    className="h-10 w-auto max-w-[120px] object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-xs font-medium", adminUi.heading)}>
                      Aktives Dokumenten-Logo
                    </p>
                    <p className={cn("truncate text-[11px]", adminUi.muted)}>
                      Aus Belege / Dokumenten-Vorlagen
                    </p>
                  </div>
                  {(layout.logoUrl?.trim() ?? "") ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn("h-8 shrink-0 text-xs", adminUi.outlineBtn)}
                      disabled={!layout.showLogo}
                      onClick={() => {
                        setLogoOverride("")
                        onLayoutChange({ ...layout, logoUrl: "" })
                      }}
                    >
                      Dokumenten-Logo nutzen
                    </Button>
                  ) : null}
                </div>
              ) : (
                <p className={cn("text-xs", adminUi.muted)}>
                  Noch kein Dokumenten-Logo hinterlegt — Upload unten oder unter
                  «Belege / Dokumenten-Vorlagen».
                </p>
              )}
              {(layout.logoUrl?.trim() || logoOverride.trim()) && (
                <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={(layout.logoUrl || logoOverride).trim()}
                    alt="E-Mail-Logo Override"
                    className="h-10 w-auto max-w-[120px] object-contain"
                  />
                  <p className={cn("text-xs", adminUi.muted)}>Override aktiv</p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={adminUi.outlineBtn}
                  disabled={!layout.showLogo || logoUploading}
                  onClick={() => logoFileInputRef.current?.click()}
                >
                  {logoUploading ? "Upload…" : "↑ Logo hochladen"}
                </Button>
                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ""
                    if (file) void uploadEmailLogo(file)
                  }}
                />
                {(layout.logoUrl?.trim() ?? "") ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={!layout.showLogo}
                    onClick={() => {
                      setLogoOverride("")
                      onLayoutChange({ ...layout, logoUrl: "" })
                    }}
                  >
                    Override entfernen
                  </Button>
                ) : null}
              </div>
              {logoUploadError && (
                <p className={cn("text-xs", adminUi.error)}>{logoUploadError}</p>
              )}
              <Input
                id="orderEmailLogoUrl"
                value={logoOverride}
                disabled={!layout.showLogo}
                onChange={(event) => {
                  const value = event.target.value
                  setLogoOverride(value)
                  onLayoutChange({ ...layout, logoUrl: value })
                }}
                className={adminUi.input}
                placeholder="Optional: URL manuell (sonst Upload)"
              />
              <p className={cn("text-xs", adminUi.muted)}>
                Upload speichert nach Azure Blob; die URL wird automatisch
                übernommen. Leer = Dokumenten-Logo / Standard.
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="orderEmailHeaderTitle"
                className={cn("text-sm font-semibold", adminUi.heading)}
              >
                Titel in der Kopfzeile
              </Label>
              <Input
                id="orderEmailHeaderTitle"
                value={layout.headerTitle ?? ""}
                onChange={(event) =>
                  onLayoutChange({
                    ...layout,
                    headerTitle: event.target.value,
                  })
                }
                className={adminUi.input}
                placeholder="Bestellbestätigung"
              />
              <p className={cn("text-xs", adminUi.muted)}>
                Leer = Standardtitel («Bestellbestätigung» / «Bestelleingang»)
              </p>
            </div>
          </div>

          <div className={cn("space-y-3 rounded-xl border p-4", adminUi.section)}>
            <div>
              <p className={cn("text-sm font-semibold", adminUi.heading)}>
                Abschnitte
              </p>
              <p className={cn("text-xs", adminUi.muted)}>
                Reihenfolge per Pfeile oder Drag-and-Drop ändern
              </p>
            </div>
            <ul className="space-y-2">
              {layout.sectionOrder.map((sectionId, index) => (
                <li
                  key={sectionId}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => onDropAt(index)}
                  onDragEnd={() => setDragIndex(null)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2",
                    adminUi.listItem,
                    dragIndex === index && "opacity-60"
                  )}
                >
                  <span
                    className={cn(
                      "min-w-0 flex-1 cursor-grab text-sm font-medium active:cursor-grabbing",
                      adminUi.bodyText
                    )}
                  >
                    {ORDER_EMAIL_SECTION_LABELS[sectionId]}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={cn("h-8 w-8 shrink-0", adminUi.outlineBtn)}
                    disabled={index === 0}
                    onClick={() =>
                      onLayoutChange({
                        ...layout,
                        sectionOrder: moveSection(
                          layout.sectionOrder,
                          index,
                          -1
                        ),
                      })
                    }
                    aria-label="Nach oben"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={cn("h-8 w-8 shrink-0", adminUi.outlineBtn)}
                    disabled={index === layout.sectionOrder.length - 1}
                    onClick={() =>
                      onLayoutChange({
                        ...layout,
                        sectionOrder: moveSection(
                          layout.sectionOrder,
                          index,
                          1
                        ),
                      })
                    }
                    aria-label="Nach unten"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          <div className={cn("space-y-3 rounded-xl border p-4", adminUi.section)}>
            <div>
              <p className={cn("text-sm font-semibold", adminUi.heading)}>
                Datenfelder im Bestellblock
              </p>
              <p className={cn("text-xs", adminUi.muted)}>
                Welche Werte in der Bestätigungs-E-Mail bei der Artikelliste
                erscheinen (Rechnungsnummer, Datum, Versandart usw.)
              </p>
            </div>
            <ul className="space-y-2">
              {(
                Object.keys(
                  ORDER_EMAIL_META_FIELD_LABELS
                ) as Array<keyof OrderEmailMetaFields>
              ).map((fieldKey) => {
                const meta =
                  layout.metaFields ?? DEFAULT_ORDER_EMAIL_META_FIELDS
                return (
                  <li
                    key={fieldKey}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                  >
                    <span className={cn("text-sm", adminUi.bodyText)}>
                      {ORDER_EMAIL_META_FIELD_LABELS[fieldKey]}
                    </span>
                    <Switch
                      checked={meta[fieldKey] !== false}
                      onCheckedChange={(checked) =>
                        onLayoutChange({
                          ...layout,
                          metaFields: {
                            ...DEFAULT_ORDER_EMAIL_META_FIELDS,
                            ...meta,
                            [fieldKey]: checked,
                          },
                        })
                      }
                    />
                  </li>
                )
              })}
            </ul>
          </div>

          <div className={cn("space-y-2 rounded-xl border p-4", adminUi.section)}>
            <Label
              htmlFor="orderEmailIntro"
              className={cn("text-sm font-semibold", adminUi.heading)}
            >
              Einleitung
            </Label>
            <Textarea
              id="orderEmailIntro"
              value={templates.receivedIntro}
              onChange={(event) =>
                onTemplatesChange({
                  ...templates,
                  receivedIntro: event.target.value,
                })
              }
              rows={6}
              className={cn("font-mono text-sm", adminUi.input)}
              placeholder={DEFAULT_ORDER_EMAIL_TEMPLATES.receivedIntro}
            />
          </div>

          <div className={cn("space-y-2 rounded-xl border p-4", adminUi.section)}>
            <Label
              htmlFor="orderEmailFooter"
              className={cn("text-sm font-semibold", adminUi.heading)}
            >
              Fusstext / Abschluss
            </Label>
            <Textarea
              id="orderEmailFooter"
              value={templates.receivedFooter}
              onChange={(event) =>
                onTemplatesChange({
                  ...templates,
                  receivedFooter: event.target.value,
                })
              }
              rows={4}
              className={cn("font-mono text-sm", adminUi.input)}
              placeholder={DEFAULT_ORDER_EMAIL_TEMPLATES.receivedFooter}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className={adminUi.outlineBtn}
            onClick={resetDefaults}
          >
            <RotateCcw className="mr-2 h-3.5 w-3.5" />
            Standard wiederherstellen
          </Button>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className={cn("text-sm font-semibold", adminUi.heading)}>
                Live-Vorschau
              </p>
              <p className={cn("text-xs", adminUi.muted)}>
                Beispielbestellung mit Platzhalterwerten — volle Höhe ohne inneren Scroll
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-border/60 p-0.5">
              <Button
                type="button"
                size="sm"
                variant={previewMode === "desktop" ? "default" : "ghost"}
                className="h-8 gap-1.5"
                onClick={() => setPreviewMode("desktop")}
              >
                <Monitor className="h-3.5 w-3.5" />
                Desktop
              </Button>
              <Button
                type="button"
                size="sm"
                variant={previewMode === "mobile" ? "default" : "ghost"}
                className="h-8 gap-1.5"
                onClick={() => setPreviewMode("mobile")}
              >
                <Smartphone className="h-3.5 w-3.5" />
                Mobile
              </Button>
            </div>
          </div>
          <div
            className={cn(
              "overflow-hidden rounded-2xl border shadow-sm",
              adminUi.card
            )}
          >
            <div
              className={cn(
                "border-b px-4 py-2 text-center text-xs font-medium",
                adminUi.tableHead,
                adminUi.sidebarBorder
              )}
            >
              Kunden-Bestellbestätigung ·{" "}
              {previewMode === "mobile" ? "Mobile" : "Desktop"}
            </div>
            <div className="bg-slate-100 p-4 dark:bg-zinc-950">
              <div
                className="mx-auto overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-[max-width] duration-200"
                style={{ maxWidth: frameWidth }}
              >
                <iframe
                  title="E-Mail-Vorschau"
                  srcDoc={previewHtml}
                  className="w-full border-0 bg-white"
                  style={{ height: previewMode === "mobile" ? 920 : 1100 }}
                  sandbox=""
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
