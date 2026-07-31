"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Download,
  FileText,
  Loader2,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { KontoShell } from "@/components/konto/konto-shell"
import type { CustomerDocumentRow } from "@/lib/konto/customer-documents"

const TYPE_LABELS: Record<CustomerDocumentRow["type"], string> = {
  rechnung: "Rechnung",
  offerte: "Offerte",
  auftragsbestaetigung: "Auftragsbestätigung",
  lieferschein: "Lieferschein",
  gutschrift: "Gutschrift",
}

type SortKey = "date-desc" | "date-asc" | "type" | "order"

export function KontoDocumentsPage() {
  const [documents, setDocuments] = useState<CustomerDocumentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [sortKey, setSortKey] = useState<SortKey>("date-desc")

  useEffect(() => {
    void fetch("/api/konto/documents", {
      cache: "no-store",
      credentials: "include",
    })
      .then(async (res) => {
        if (res.status === 401) {
          window.location.href = "/konto/login?next=/konto/belege"
          return
        }
        const data = (await res.json()) as { documents?: CustomerDocumentRow[] }
        setDocuments(data.documents ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = documents.filter((doc) => {
      if (typeFilter !== "all" && doc.type !== typeFilter) return false
      if (!q) return true
      return (
        doc.label.toLowerCase().includes(q) ||
        doc.orderId.toLowerCase().includes(q) ||
        TYPE_LABELS[doc.type].toLowerCase().includes(q)
      )
    })
    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case "date-asc":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case "type":
          return TYPE_LABELS[a.type].localeCompare(TYPE_LABELS[b.type], "de")
        case "order":
          return a.orderId.localeCompare(b.orderId, "de")
        case "date-desc":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })
    return list
  }, [documents, query, typeFilter, sortKey])

  return (
    <KontoShell>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <FileText className="h-6 w-6 text-primary" />
            Belege
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Offerten, Auftragsbestätigungen, Lieferscheine, Rechnungen und Gutschriften
            als PDF.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suche Beleg, Bestellnr…"
              className="pl-9"
            />
          </div>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">Alle Typen</option>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="date-desc">Datum (neueste)</option>
            <option value="date-asc">Datum (älteste)</option>
            <option value="type">Typ</option>
            <option value="order">Bestellnummer</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
            Keine Belege gefunden.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((doc) => (
              <Card key={doc.id} className="rounded-xl border-border/50">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium">{doc.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {TYPE_LABELS[doc.type]} · Auftrag {doc.orderId} ·{" "}
                      {new Intl.DateTimeFormat("de-CH", {
                        dateStyle: "medium",
                      }).format(new Date(doc.createdAt))}
                    </p>
                  </div>
                  {doc.available && doc.downloadUrl ? (
                    <Button type="button" size="sm" asChild>
                      <a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="mr-1 h-3.5 w-3.5" />
                        PDF
                      </a>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Noch nicht verfügbar
                    </span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </KontoShell>
  )
}
