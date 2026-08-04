"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ProductDescriptionEditor } from "@/components/admin/product-description-editor"
import { useSiteTexts } from "@/components/dripforge/site-texts-provider"
import { useCompanySettings } from "@/components/dripforge/company-settings-provider"
import { legalToDisplayHtml } from "@/lib/dripforge/legal-html"
import { cn } from "@/lib/utils"
import type { SiteTextKey } from "@/lib/admin/site-texts"

/**
 * Durchgängiges Rich-Text-Feld für Rechtstexte (Datenschutz/AGB/Impressum).
 * Ersetzt die frühere Einzelblock-Eingabe: ein WYSIWYG-Editor für den ganzen
 * Inhalt mit H1/H2, Fett/Kursiv, Listen und Hervorhebung.
 */
export function LegalRichText({
  k,
  className,
}: {
  k: SiteTextKey
  className?: string
}) {
  const { t, canInlineEdit, saveText } = useSiteTexts()
  const { withCompany } = useCompanySettings()
  const raw = t(k)

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayHtml = legalToDisplayHtml(withCompany(raw))
  const dirty = draft !== raw

  const content = (
    <div
      className={cn(
        "legal-rich-text text-[0.9375rem] leading-[1.4] text-muted-foreground md:text-base",
        "[&_h1]:mb-3 [&_h1]:mt-0 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-foreground md:[&_h1]:text-2xl",
        "[&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-foreground md:[&_h2]:text-xl",
        "[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground",
        "[&_p]:mb-1 [&_p]:mt-0",
        "[&_ul]:mb-2 [&_ul]:mt-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:mt-0 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:mb-0.5 [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline",
        "[&_br]:leading-[1.25] [&_p:empty]:m-0 [&_p:empty]:h-0",
        "[&_strong]:text-foreground",
        className
      )}
      dangerouslySetInnerHTML={{ __html: displayHtml }}
    />
  )

  if (!canInlineEdit) return content

  const handleOpen = () => {
    setDraft(raw)
    setError(null)
    setOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveText(k, draft)
      setOpen(false)
    } catch {
      setError("Speichern fehlgeschlagen.")
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setDraft(raw)
    setError(null)
    setOpen(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next && dirty) {
      const shouldSave = window.confirm(
        "Ungespeicherte Änderungen. OK = Speichern & Schliessen, Abbrechen = weiter bearbeiten"
      )
      if (shouldSave) {
        void handleSave()
      }
      return
    }
    setOpen(next)
  }

  return (
    <div className="group/legal relative rounded-sm outline-offset-2 hover:outline hover:outline-1 hover:outline-amber-500/50">
      {content}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="absolute -right-1 -top-3 z-20 gap-1.5 bg-background shadow-sm"
        onClick={handleOpen}
      >
        <Pencil className="h-3.5 w-3.5" />
        Inhalt bearbeiten
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="z-[350] max-h-[90vh] overflow-y-auto sm:max-w-3xl"
          onInteractOutside={(event) => {
            if (dirty) event.preventDefault()
          }}
          onEscapeKeyDown={(event) => {
            if (dirty) {
              event.preventDefault()
              const shouldSave = window.confirm(
                "Ungespeicherte Änderungen. OK = Speichern & Schliessen, Abbrechen = weiter bearbeiten"
              )
              if (shouldSave) void handleSave()
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Inhalt bearbeiten</DialogTitle>
          </DialogHeader>
          <ProductDescriptionEditor
            value={draft}
            onChange={setDraft}
            enableBlockFormats
            ariaLabel="Rechtstext"
            editorClassName="min-h-[320px] max-h-[60vh]"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={handleDiscard}
              disabled={saving}
            >
              Verwerfen
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={saving}
              >
                Abbrechen
              </Button>
              <Button type="button" onClick={() => void handleSave()} disabled={saving}>
                {saving ? "Speichern …" : "Speichern"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
