import { Card, CardContent } from "@/components/ui/card"
import {
  formatProductDimensionsText,
  formatProductVolume,
  formatProductWeight,
} from "@/lib/dripforge/product-dimensions"
import type { ProductDimensionsMm } from "@/lib/dripforge/types"

export type FesteMasseCardProps = {
  dimensions: ProductDimensionsMm
  volumeCm3?: number | null
  weightG?: number | null
  /** Optional: Druckzeit-Anzeige (nur wenn Shop-Switch aktiv) */
  printTimeLabel?: string | null
  title?: string
  className?: string
}

/**
 * Einheitliche «Feste Masse»-Infobox für Shop-3D, Laser und Eigenupload-Konfigurator.
 */
export function FesteMasseCard({
  dimensions,
  volumeCm3 = null,
  weightG = null,
  printTimeLabel = null,
  title = "Feste Masse",
  className,
}: FesteMasseCardProps) {
  return (
    <Card className={className ?? "rounded-xl border-border/50 bg-card/50 shadow-sm"}>
      <CardContent className="p-5 sm:p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        <dl className="divide-y divide-border/60 rounded-lg border border-border/50 bg-muted/30">
          <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <dt className="text-muted-foreground">Länge</dt>
            <dd className="font-mono font-semibold tabular-nums">
              {Number(dimensions.length).toFixed(1)} mm
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <dt className="text-muted-foreground">Breite</dt>
            <dd className="font-mono font-semibold tabular-nums">
              {Number(dimensions.width).toFixed(1)} mm
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <dt className="text-muted-foreground">Höhe</dt>
            <dd className="font-mono font-semibold tabular-nums">
              {Number(dimensions.height).toFixed(1)} mm
            </dd>
          </div>
          {volumeCm3 != null && Number.isFinite(Number(volumeCm3)) && (
            <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <dt className="text-muted-foreground">Volumen</dt>
              <dd className="font-mono font-semibold tabular-nums">
                {formatProductVolume(volumeCm3, "cm3")}
              </dd>
            </div>
          )}
          {weightG != null && Number.isFinite(Number(weightG)) && (
            <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <dt className="text-muted-foreground">Gewicht</dt>
              <dd className="font-mono font-semibold tabular-nums">
                {formatProductWeight(weightG)}
              </dd>
            </div>
          )}
          {printTimeLabel ? (
            <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <dt className="text-muted-foreground">Druckzeit</dt>
              <dd className="font-mono font-semibold tabular-nums">
                {printTimeLabel}
              </dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-4 bg-background/60 px-4 py-3 text-sm">
            <dt className="font-medium">Gesamt</dt>
            <dd className="font-mono text-base font-bold tabular-nums text-primary">
              {formatProductDimensionsText(dimensions)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
