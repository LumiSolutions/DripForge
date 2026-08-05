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
import { cn } from "@/lib/utils"

const PRINTABLE_ITEMS = [
  "Volumenechte, geschlossene 3D-Körper (Solid Mesh / watertight)",
  "Gehäuse, Ersatzteile, Halterungen, Abdeckungen & funktionale Bauteile",
  "Ausreichende Wandstärken (mindestens 1,5 mm – 2,0 mm)",
  "Flache Grundflächen für eine stabile Druckbett-Haftung",
] as const

const LIMITED_ITEMS = [
  "Extrem dünne, papierähnliche Flächen oder frei schwebende Linien (< 1 mm)",
  "Offene oder fehlerhafte 3D-Gitter/Meshes (Löcher im Modell)",
  "Sehr komplexe, filigrane Figuren mit ungestützten Überhängen",
  "Ineinander verschachtelte Bauteile ohne ausreichendes Spiel (< 0,4 mm Clearance)",
] as const

/**
 * Aufklappbarer Design-Guide direkt beim STL-Upload im 3D-Konfigurator.
 */
export function PrintabilityDesignGuide({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)

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
        <div className="mt-3 space-y-4 rounded-xl border border-border/60 bg-background/50 p-4 text-sm">
          <div>
            <p className="mb-2 flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              Gut druckbar
            </p>
            <ul className="space-y-1.5 pl-0.5 text-muted-foreground">
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

          <div className="border-t border-border/50 pt-4">
            <p className="mb-2 flex items-center gap-2 font-semibold text-red-700 dark:text-red-400">
              <XCircle className="h-4 w-4 shrink-0" aria-hidden />
              Nicht oder nur eingeschränkt druckbar
            </p>
            <ul className="space-y-1.5 pl-0.5 text-muted-foreground">
              {LIMITED_ITEMS.map((item) => (
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
      </CollapsibleContent>
    </Collapsible>
  )
}
