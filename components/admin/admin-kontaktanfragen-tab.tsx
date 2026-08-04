"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Mail, RefreshCw, Reply, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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

  const [replyTarget, setReplyTarget] = useState<Kontaktanfrage | null>(null)
  const [replySubject, setReplySubject] = useState("")
  const [replyMessage, setReplyMessage] = useState("")
  const [replySending, setReplySending] = useState(false)
  const [replyError, setReplyError] = useState<string | null>(null)
  const [replyNotice, setReplyNotice] = useState<string | null>(null)

  const openReply = (item: Kontaktanfrage) => {
    setReplyTarget(item)
    setReplySubject(`Re: ${item.subject || "Deine Anfrage"} (#${item.id})`)
    setReplyMessage(`Guten Tag ${item.name},\n\n`)
    setReplyError(null)
    setReplyNotice(null)
  }

  const sendReply = async () => {
    if (!replyTarget) return
    setReplySending(true)
    setReplyError(null)
    setReplyNotice(null)
    try {
      const res = await fetch(
        `/api/admin/kontaktanfragen/${encodeURIComponent(replyTarget.id)}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: replySubject,
            message: replyMessage,
          }),
        }
      )
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean
        anfrage?: Kontaktanfrage
        error?: string
      } | null
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? "E-Mail konnte nicht gesendet werden.")
      }
      if (data.anfrage) {
        setItems((prev) =>
          prev.map((item) => (item.id === data.anfrage!.id ? data.anfrage! : item))
        )
      }
      setReplyNotice("Antwort gesendet — Anfrage als «beantwortet» markiert.")
      setReplyTarget(null)
    } catch (err) {
      setReplyError(
        err instanceof Error ? err.message : "E-Mail konnte nicht gesendet werden."
      )
    } finally {
      setReplySending(false)
    }
  }

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
      {replyNotice && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          {replyNotice}
        </p>
      )}

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
                    <TableHead>Aktionen</TableHead>
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
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {item.id}
                        </p>
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
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 gap-1.5 whitespace-nowrap"
                          onClick={() => openReply(item)}
                        >
                          <Reply className="h-3.5 w-3.5" />
                          Antworten
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={replyTarget !== null}
        onOpenChange={(open) => {
          if (!open) setReplyTarget(null)
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Per E-Mail antworten</DialogTitle>
            <DialogDescription>
              {replyTarget
                ? `An ${replyTarget.name} <${replyTarget.email}>`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {replyTarget && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
                <p className="text-xs font-semibold text-foreground/70">
                  Ursprüngliche Nachricht ({replyTarget.subject})
                </p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                  {replyTarget.message}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className={adminUi.label}>Betreff</Label>
                <Input
                  value={replySubject}
                  onChange={(e) => setReplySubject(e.target.value)}
                  className={adminUi.input}
                />
              </div>
              <div className="space-y-1.5">
                <Label className={adminUi.label}>Antwort</Label>
                <Textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  rows={8}
                  placeholder="Deine Antwort an den Kunden…"
                  className={adminUi.input}
                />
              </div>
              {replyError && <p className="text-sm text-red-600">{replyError}</p>}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReplyTarget(null)}
                  disabled={replySending}
                >
                  Abbrechen
                </Button>
                <Button
                  type="button"
                  onClick={() => void sendReply()}
                  disabled={replySending || !replyMessage.trim()}
                  className="gap-1.5"
                >
                  {replySending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  E-Mail senden
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
