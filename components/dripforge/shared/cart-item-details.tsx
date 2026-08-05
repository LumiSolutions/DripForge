import { Printer, Zap } from "lucide-react"
import { LASER_FONT_OPTIONS } from "@/lib/dripforge/laser-design"
import type { CartItem } from "@/lib/dripforge/types"
import { cn } from "@/lib/utils"
import { SafeProductImage } from "@/components/dripforge/shared/safe-product-image"
import { resolveCartPreviewSrc } from "@/lib/dripforge/cart-preview-persist"

type CartItemDetailsProps = {
  item: CartItem
  compact?: boolean
  className?: string
  showLeitbild?: boolean
}

export function CartItemDetails({
  item,
  compact = false,
  className,
  showLeitbild = false,
}: CartItemDetailsProps) {
  const d = item.customDetails
  const textClass = compact ? "text-xs" : "text-sm"
  const previewSrc = resolveCartPreviewSrc(item)

  return (
    <div className={cn("space-y-2", className)}>
      {showLeitbild && previewSrc ? (
        <div className="overflow-hidden rounded-lg border border-border/50 bg-muted/30">
          <div className="relative aspect-video">
            <SafeProductImage
              src={previewSrc}
              alt="Kunden-Wunsch-Ansicht (Leitbild)"
              fill
              sizes="(max-width: 640px) 90vw, 320px"
              className="object-contain bg-white/80 dark:bg-black/20"
            />
          </div>
          <p className="px-2 py-1 text-[10px] text-muted-foreground">
            Leitbild — Live-Vorschau beim Hinzufuegen
          </p>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        {item.type === "3d" ? (
          <>
            <Printer className="h-3.5 w-3.5 text-primary" />
            <span className={cn(textClass, "font-medium text-primary")}>
              3D-Druck
            </span>
          </>
        ) : (
          <>
            <Zap className="h-3.5 w-3.5 text-cyan-500" />
            <span className={cn(textClass, "font-medium text-cyan-600 dark:text-cyan-400")}>
              Lasergravur
            </span>
          </>
        )}
        {item.quantity > 1 && (
          <span className={cn(textClass, "text-muted-foreground")}>
            × {item.quantity}
          </span>
        )}
      </div>

      {!d ? null : item.type === "3d" ? (
        <ul className={cn(textClass, "space-y-1 text-muted-foreground")}>
          {d.fileName && <li>Datei: {d.fileName}</li>}
          {d.filament && <li>Material: {d.filament}</li>}
          {d.color && <li>Farben: {d.color}</li>}
          {d.dimensions && <li>Masse: {d.dimensions}</li>}
          {d.scale && <li>Skalierung: {d.scale}</li>}
          {d.colorWishes && <li>Farbwünsche: {d.colorWishes}</li>}
          {d.colorReferenceImageName && (
            <li>Vorlagebild: {d.colorReferenceImageName}</li>
          )}
          {d.hasEmbeddedModelColors && (
            <li>Modell mit Originalfarben</li>
          )}
        </ul>
      ) : (
        <ul className={cn(textClass, "space-y-1 text-muted-foreground")}>
          {d.material && <li>Material: {d.material}</li>}
          {(d.variant || d.materialVariant) && (
            <li>Variante: {d.variant ?? d.materialVariant}</li>
          )}
          {d.size && <li>Grösse: {d.size}</li>}
          {d.userFont && (
            <li>
              Schrift:{" "}
              {LASER_FONT_OPTIONS.find((f) => f.id === d.userFont)?.label ??
                d.userFont}
            </li>
          )}
          {(d.userText || d.engravingText) && (
            <li>
              Gravur: {d.userText ?? d.engravingText}
            </li>
          )}
          <li>
            Logo: {d.uploadedImage || d.hasImage ? "hochgeladen" : "keines"}
          </li>
          {d.layoutCoordinates?.textPosition && (d.userText || d.engravingText) && (
            <li className="opacity-80">
              Text-Position:{" "}
              {Math.round(d.layoutCoordinates.textPosition.x)}% /{" "}
              {Math.round(d.layoutCoordinates.textPosition.y)}%
            </li>
          )}
          {d.layoutCoordinates?.imagePosition && (d.uploadedImage || d.hasImage) && (
            <li className="opacity-80">
              Logo-Position:{" "}
              {Math.round(d.layoutCoordinates.imagePosition.x)}% /{" "}
              {Math.round(d.layoutCoordinates.imagePosition.y)}%
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
