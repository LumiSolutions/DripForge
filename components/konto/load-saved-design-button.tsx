"use client"

import { useCallback, useEffect, useState } from "react"
import { FolderOpen, Loader2, Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { SafeProductImage } from "@/components/dripforge/shared/safe-product-image"
import type { SavedCustomerDesign } from "@/lib/konto/account-types"
import { cn } from "@/lib/utils"

type LoadSavedDesignButtonProps = {
  designType?: "laser" | "3d" | "other" | "all"
  onSelect: (design: SavedCustomerDesign) => void
  className?: string
  label?: string
  /** Ohne Trigger — nur Modal steuern */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}

export function LoadSavedDesignButton({
  designType = "laser",
  onSelect,
  className,
  label = "Gespeichertes Design laden",
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: LoadSavedDesignButtonProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const [designs, setDesigns] = useState<SavedCustomerDesign[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const me = await fetch("/api/konto/me", { cache: "no-store" })
      if (!me.ok) {
        window.location.href = `/konto/login?next=${encodeURIComponent(
          window.location.pathname
        )}`
        return
      }
      const res = await fetch("/api/konto/designs", { cache: "no-store" })
      const data = (await res.json()) as {
        designs?: SavedCustomerDesign[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? "Designs konnten nicht geladen werden.")
      const list = (data.designs ?? []).filter(
        (d) => designType === "all" || d.designType === designType
      )
      setDesigns(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden")
    } finally {
      setLoading(false)
    }
  }, [designType])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm" className={className}>
            <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
            {label}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Gespeichertes Design wählen
          </DialogTitle>
          <DialogDescription>
            Wähle ein Design aus «Meine Designs», um es zu laden oder erneut zu
            bestellen.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : designs.length === 0 ? (
          <p className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
            Noch keine passenden Designs gespeichert.
          </p>
        ) : (
          <ul className="space-y-2">
            {designs.map((design) => (
              <li key={design.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(design)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                  )}
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-secondary/50">
                    {design.previewUrl ? (
                      <SafeProductImage
                        src={design.previewUrl}
                        alt={design.label}
                        fill
                        sizes="56px"
                        className="object-contain p-1"
                      />
                    ) : (
                      <Palette className="m-auto h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{design.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {design.designType} ·{" "}
                      {new Intl.DateTimeFormat("de-CH", {
                        dateStyle: "medium",
                      }).format(new Date(design.updatedAt))}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
