"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Mail, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import {
  KONTAKT_INQUIRY_LABELS,
  KONTAKT_STATUS_LABELS,
  KONTAKT_STATUS_VALUES,
  type Kontaktanfrage,
  type KontaktStatus,
} from "@/lib/admin/kontaktanfrage-types"
import { cn } from "@/lib/utils"

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("de-CH", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function statusBadgeClass(status: KontaktStatus) {
  switch (status) {
    case "beantwortet":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    case "archiviert":
      return "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300"
    default:
      return "bg-orange-500/15 text-orange-700 dark:text-orange-300"
  }
}

export function AdminKontaktanfragenTab() {
  const [items, setItems] = useState<Kontaktanfrage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/kontaktanfragen", { cache: "no-store" })
      const data = (await res.json()) as {
        items?: Kontaktanfrage[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      setItems(data.items ?? [])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Kontaktanfragen konnten nicht geladen werden."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const updateStatus = async (id: string, status: KontaktStatus) => {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/admin/kontaktanfragen/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = (await res.json()) as Kontaktanfrage & { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Update fehlgeschlagen")
      setItems((prev) => prev.map((item) => (item.id === id ? data : item)))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Status konnte nicht geändert werden."
      )
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className={cn("text-xl font-bold", adminUi.heading)}>
            Kontaktanfragen
          </h2>
          <p className={cn("text-sm", adminUi.muted)}>
            Eingegangene Mitteilungen aus dem Kontaktformular
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void load()}
          disabled={loading}
          className={adminUi.outlineBtn}
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Aktualisieren
        </Button>
      </div>

      {error && <p className={adminUi.errorLg}>{error}</p>}

      <Card className={adminUi.card}>
        <CardHeader className="pb-2">
          <CardTitle className={cn("flex items-center gap-2 text-base", adminUi.heading)}>
            <Mail className="h-4 w-4 text-orange-500" />
            Nachrichten ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && items.length === 0 ? (
            <p className={cn("flex items-center py-8 text-sm", adminUi.muted)}>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Kontaktanfragen werden geladen…
            </p>
          ) : items.length === 0 ? (
            <p className={cn("py-8 text-sm", adminUi.muted)}>
              Noch keine Kontaktanfragen vorhanden.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>E-Mail</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Nachricht</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(item.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        <a
                          href={`mailto:${item.email}`}
                          className="text-sm text-orange-600 underline-offset-2 hover:underline dark:text-orange-400"
                        >
                          {item.email}
                        </a>
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.phone || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {KONTAKT_INQUIRY_LABELS[item.inquiryType] ?? item.inquiryType}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-xs font-medium text-foreground/80">
                          {item.subject}
                        </p>
                        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
                          {item.message}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-[9rem] flex-col gap-2">
                          <Badge
                            className={cn(
                              "w-fit border-0",
                              statusBadgeClass(item.status)
                            )}
                          >
                            {KONTAKT_STATUS_LABELS[item.status]}
                          </Badge>
                          <Select
                            value={item.status}
                            disabled={updatingId === item.id}
                            onValueChange={(value) =>
                              void updateStatus(item.id, value as KontaktStatus)
                            }
                          >
                            <SelectTrigger className={cn("h-8", adminUi.input)}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {KONTAKT_STATUS_VALUES.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {KONTAKT_STATUS_LABELS[status]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
