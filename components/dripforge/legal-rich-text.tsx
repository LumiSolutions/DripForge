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

  const content = (
    <div
      className={cn(
        "legal-rich-text space-y-4 text-[0.9375rem] leading-relaxed text-muted-foreground md:text-base",
        "[&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-foreground md:[&_h1]:text-2xl",
        "[&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-foreground md:[&_h2]:text-xl",
        "[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground",
        "[&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:mb-1 [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline",
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="z-[350] max-h-[90vh] overflow-y-auto sm:max-w-3xl">
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
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Abbrechen
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Speichern …" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
