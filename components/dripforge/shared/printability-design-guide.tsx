"use client"

import { useState } from "react"
import {
  CheckCircle2,
  ChevronDown,
  Info,
  XCircle,
} from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { SiteImage } from "@/components/dripforge/editable-site-image"
import { cn } from "@/lib/utils"

export const PRINTABLE_ITEMS = [
  "Volumenechte, geschlossene 3D-Körper (Solid Mesh / watertight)",
  "Gehäuse, Ersatzteile, Halterungen, Abdeckungen & funktionale Bauteile",
  "Ausreichende Wandstärken (mindestens 1,5 mm – 2,0 mm)",
  "Flache Grundflächen für eine stabile Druckbett-Haftung",
] as const

export const LIMITED_PRINT_ITEMS = [
  "Extrem dünne, papierähnliche Flächen oder frei schwebende Linien (< 1 mm)",
  "Offene oder fehlerhafte 3D-Gitter/Meshes (Löcher im Modell)",
  "Sehr komplexe, filigrane Figuren mit ungestützten Überhängen",
  "Ineinander verschachtelte Bauteile ohne ausreichendes Spiel (< 0,4 mm Clearance)",
] as const

function PrintabilityColumns({ showImages }: { showImages: boolean }) {
  return (
    <div
      className={cn(
        "grid gap-6",
        showImages ? "md:grid-cols-2" : "gap-4"
      )}
    >
      <div className="space-y-3">
        {showImages && (
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-emerald-500/20 bg-emerald-500/5">
            <SiteImage
              imageKey="printability_good_example_image"
              fill
              sizes="(max-width: 768px) 100vw, 400px"
              imageClassName="object-cover"
            />
          </div>
        )}
        <p className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          Gut druckbar
        </p>
        <ul className="space-y-1.5 pl-0.5 text-sm text-muted-foreground">
          {PRINTABLE_ITEMS.map((item) => (
            <li key={item} className="flex gap-2">
              <CheckCircle2
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        {showImages && (
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-red-500/20 bg-red-500/5">
            <SiteImage
              imageKey="printability_bad_example_image"
              fill
              sizes="(max-width: 768px) 100vw, 400px"
              imageClassName="object-cover"
            />
          </div>
        )}
        <p className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-400">
          <XCircle className="h-4 w-4 shrink-0" aria-hidden />
          Nicht oder nur eingeschränkt druckbar
        </p>
        <ul className="space-y-1.5 pl-0.5 text-sm text-muted-foreground">
          {LIMITED_PRINT_ITEMS.map((item) => (
            <li key={item} className="flex gap-2">
              <XCircle
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500/90"
                aria-hidden
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/**
 * Design-Guide: collapsible (Konfigurator) oder offene Sektion (Infoseite).
 * Beispielbilder sind CMS-editierbar (SiteImage / Incontext-Editor).
 */
export function PrintabilityDesignGuide({
  className,
  variant = "collapsible",
}: {
  className?: string
  variant?: "collapsible" | "section"
}) {
  const [open, setOpen] = useState(variant === "section")

  if (variant === "section") {
    return (
      <div
        className={cn(
          "rounded-2xl border border-border/60 bg-card/40 p-6 md:p-8",
          className
        )}
      >
        <div className="mb-6 flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div>
            <h3 className="text-xl font-bold">Was kann gedruckt werden?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Design-Richtlinien für STL-/3D-Uploads — Wandstärken, geschlossene
              Geometrien und typische Problemfälle.
            </p>
          </div>
        </div>
        <PrintabilityColumns showImages />
      </div>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn(className)}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/5 px-3.5 py-3 text-left text-sm font-medium text-foreground transition-colors",
            "hover:border-primary/40 hover:bg-primary/10",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          )}
          aria-expanded={open}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="leading-snug">
              Was kann gedruckt werden?{" "}
              <span className="font-normal text-muted-foreground">
                (Design-Richtlinien)
              </span>
            </span>
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )}
            aria-hidden
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-none">
        <div className="mt-3 space-y-4 rounded-xl border border-border/60 bg-background/50 p-4">
          <PrintabilityColumns showImages />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
