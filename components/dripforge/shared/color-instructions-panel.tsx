"use client"

import Image from "next/image"
import { ImagePlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type ColorInstructionsPanelProps = {
  colorWishes: string
  onColorWishesChange: (value: string) => void
  referenceImagePreview: string | null
  referenceImageName: string | null
  onReferenceImageChange: (file: File | null) => void
  className?: string
}

export function ColorInstructionsPanel({
  colorWishes,
  onColorWishesChange,
  referenceImagePreview,
  referenceImageName,
  onReferenceImageChange,
  className,
}: ColorInstructionsPanelProps) {
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    onReferenceImageChange(file)
    e.target.value = ""
  }

  return (
    <div
      className={cn(
        "space-y-4 rounded-xl border border-border/50 bg-muted/20 p-4",
        className
      )}
    >
      <div>
        <h4 className="text-sm font-semibold">Farbanweisungen</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Dein Modell enthaelt keine eingebetteten Farben — beschreibe oder
          skizziere die gewünschte Farbverteilung.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="color-wishes">
          Spezifische Farbwünsche &amp; Details
        </Label>
        <Textarea
          id="color-wishes"
          value={colorWishes}
          onChange={(e) => onColorWishesChange(e.target.value)}
          placeholder="Beschreibe uns hier bitte kurz, welche Teile deines Modells in welcher Farbe gedruckt werden sollen."
          rows={4}
          className="resize-y bg-background/80"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="color-reference-image">
          Vorlagebild / Skizze hochladen (Optional)
        </Label>
        <div className="flex flex-wrap items-start gap-4">
          <div className="relative">
            <input
              id="color-reference-image"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="pointer-events-none gap-2"
              tabIndex={-1}
            >
              <ImagePlus className="h-4 w-4" />
              Bild wählen
            </Button>
          </div>

          {referenceImagePreview && (
            <div className="flex items-start gap-2">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border/60 shadow-sm">
                <Image
                  src={referenceImagePreview}
                  alt="Vorlagebild Farbverteilung"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="max-w-[180px] truncate text-xs font-medium">
                  {referenceImageName}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-7 px-2 text-xs text-muted-foreground hover:text-red-500"
                  onClick={() => onReferenceImageChange(null)}
                >
                  <X className="mr-1 h-3 w-3" />
                  Entfernen
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export async function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("Bild konnte nicht gelesen werden."))
    reader.readAsDataURL(file)
  })
}
