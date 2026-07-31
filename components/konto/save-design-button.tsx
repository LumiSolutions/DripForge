"use client"

import { useState } from "react"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type SaveDesignButtonProps = {
  designType: "laser" | "3d" | "other"
  defaultLabel: string
  previewUrl?: string | null
  config: Record<string, unknown>
  className?: string
}

export function SaveDesignButton({
  designType,
  defaultLabel,
  previewUrl,
  config,
  className,
}: SaveDesignButtonProps) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState(defaultLabel)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const me = await fetch("/api/konto/me", { cache: "no-store" })
      if (!me.ok) {
        window.location.href = `/konto/login?next=${encodeURIComponent(
          window.location.pathname
        )}`
        return
      }
      const res = await fetch("/api/konto/designs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || defaultLabel,
          designType,
          previewUrl: previewUrl ?? null,
          config,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")
      setMessage("Design gespeichert unter «Meine Designs».")
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={className}>
          <Save className="mr-1 h-3.5 w-3.5" />
          Design in «Meine Designs» speichern
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Design in «Meine Designs» speichern</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Bezeichnung"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          {message && <p className="text-xs text-emerald-600">{message}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button type="button" disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
