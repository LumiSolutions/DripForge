"use client"

import { useEffect, useState } from "react"
import { Loader2, Palette, Sparkles } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { KontoShell } from "@/components/konto/konto-shell"
import type { SavedCustomerDesign } from "@/lib/konto/account-types"

export function KontoDesignsPage() {
  const [designs, setDesigns] = useState<SavedCustomerDesign[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetch("/api/konto/designs", { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json()) as { designs?: SavedCustomerDesign[] }
        if (res.ok) setDesigns(data.designs ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <KontoShell>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Palette className="h-6 w-6 text-primary" />
            Meine Designs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gespeicherte Logos und Konfigurationen für schnelle Nachbestellungen — demnächst
            direkt aus dem Shop speicherbar.
          </p>
        </div>

        <Card className="rounded-2xl border-primary/20 bg-primary/5">
          <CardContent className="flex gap-4 p-6">
            <Sparkles className="h-6 w-6 shrink-0 text-primary" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">In Vorbereitung</p>
              <p className="mt-1">
                Nach Abschluss einer Laser- oder 3D-Bestellung kannst du dein Design hier
                ablegen und beim nächsten Einkauf mit einem Klick wiederverwenden.
              </p>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          </div>
        ) : designs.length === 0 ? (
          <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
            Noch keine Designs gespeichert.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {designs.map((design) => (
              <Card key={design.id} className="rounded-xl border-border/50">
                <CardContent className="p-5">
                  <p className="font-semibold">{design.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {design.designType} ·{" "}
                    {new Intl.DateTimeFormat("de-CH", { dateStyle: "medium" }).format(
                      new Date(design.updatedAt)
                    )}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </KontoShell>
  )
}
