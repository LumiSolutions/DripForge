"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import {
  mergeSiteTexts,
  SITE_TEXT_SECTIONS,
  type SiteTextKey,
  type SiteTexts,
} from "@/lib/admin/site-texts"
import { cn } from "@/lib/utils"

export function AdminSiteTextsTab() {
  const [texts, setTexts] = useState<SiteTexts>(mergeSiteTexts(null))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadTexts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/site-texts", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      setTexts(mergeSiteTexts(data.texts))
    } catch (err) {
      console.warn("Admin: Site-Texts konnten nicht geladen werden.", err)
      setError(
        err instanceof Error ? err.message : "Texte konnten nicht geladen werden."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTexts()
  }, [loadTexts])

  const updateField = (key: SiteTextKey, value: string) => {
    setTexts((prev) => ({ ...prev, [key]: value }))
  }

  const saveTexts = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/site-texts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ texts }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")
      setTexts(mergeSiteTexts(data.texts))
      setSuccess("Texte gespeichert — Aenderungen sind beim naechsten Seitenaufruf live.")
    } catch (err) {
      console.warn("Admin: Site-Texts konnten nicht gespeichert werden.", err)
      setError(
        err instanceof Error ? err.message : "Texte konnten nicht gespeichert werden."
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 py-16", adminUi.muted)}>
        <Loader2 className="h-5 w-5 animate-spin" />
        Texte werden geladen…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className={cn("text-2xl font-bold", adminUi.heading)}>Texte &amp; Inhalte</h1>
        <p className={cn("mt-2 text-sm", adminUi.muted)}>
          Bearbeite statische Texte fuer Landingpage, Shop, Konto-Portal und Footer.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          {success}
        </div>
      )}

      <Tabs defaultValue="landingpage" className="space-y-6">
        <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/60 p-1">
          {SITE_TEXT_SECTIONS.map((section) => (
            <TabsTrigger key={section.id} value={section.id} className="text-xs sm:text-sm">
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {SITE_TEXT_SECTIONS.map((section) => (
          <TabsContent key={section.id} value={section.id}>
            <Card className={adminUi.card}>
              <CardContent className="space-y-5 p-6">
                {section.fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key}>{field.label}</Label>
                    {field.multiline ? (
                      <Textarea
                        id={field.key}
                        rows={3}
                        value={texts[field.key]}
                        onChange={(e) => updateField(field.key, e.target.value)}
                      />
                    ) : (
                      <Input
                        id={field.key}
                        value={texts[field.key]}
                        onChange={(e) => updateField(field.key, e.target.value)}
                      />
                    )}
                    <p className={cn("text-[11px]", adminUi.muted)}>Schluessel: {field.key}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <div className="sticky bottom-4 flex justify-end">
        <Button
          type="button"
          onClick={() => void saveTexts()}
          disabled={saving}
          className="shadow-lg"
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Aenderungen speichern
        </Button>
      </div>
    </div>
  )
}
