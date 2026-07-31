"use client"

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react"
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
  ORDER_EMAIL_SECTION_LABELS,
  type OrderEmailLayout,
  type OrderEmailLogoPosition,
  type OrderEmailSectionId,
} from "@/lib/email/order-email-layout"
import { renderOrderEmailPreviewHtml } from "@/lib/email/order-email-preview"
import { cn } from "@/lib/utils"

type AdminEmailTemplateBuilderProps = {
  templates: OrderEmailTemplates
  layout: OrderEmailLayout
  onTemplatesChange: (next: OrderEmailTemplates) => void
  onLayoutChange: (next: OrderEmailLayout) => void
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

export function AdminEmailTemplateBuilder({
  templates,
  layout,
  onTemplatesChange,
  onLayoutChange,
}: AdminEmailTemplateBuilderProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const previewHtml = useMemo(
    () =>
      renderOrderEmailPreviewHtml({
        templates,
        layout,
      }),
    [templates, layout]
  )

  const resetDefaults = () => {
    onTemplatesChange({ ...DEFAULT_ORDER_EMAIL_TEMPLATES })
    onLayoutChange({
      ...DEFAULT_ORDER_EMAIL_LAYOUT,
      sectionOrder: [...DEFAULT_ORDER_EMAIL_LAYOUT.sectionOrder],
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

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <div className={cn("space-y-3 rounded-xl border p-4", adminUi.section)}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={cn("text-sm font-semibold", adminUi.heading)}>
                  Logo anzeigen
                </p>
                <p className={cn("text-xs", adminUi.muted)}>
                  Logo aus der Dokumentenvorlage in der Kopfzeile
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
          <div>
            <p className={cn("text-sm font-semibold", adminUi.heading)}>
              Live-Vorschau
            </p>
            <p className={cn("text-xs", adminUi.muted)}>
              Beispielbestellung mit Platzhalterwerten
            </p>
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
              Kunden-Bestellbestätigung
            </div>
            <div className="max-h-[min(780px,70vh)] overflow-auto bg-slate-100 p-3 dark:bg-zinc-950">
              <div className="mx-auto max-w-[620px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <iframe
                  title="E-Mail-Vorschau"
                  srcDoc={previewHtml}
                  className="h-[640px] w-full border-0 bg-white"
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
