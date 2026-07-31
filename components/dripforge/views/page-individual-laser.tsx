"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Minus, Package, Plus, ShoppingCart, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { laserMaterials } from "@/lib/dripforge/data"
import { calculateLaserPrice } from "@/lib/dripforge/calculate-laser-price"
import { isCustomerShippingOptionEnabled } from "@/lib/dripforge/customer-shipping-visibility"
import { getIndividualLaserBasePrice } from "@/lib/dripforge/laser-individual-config"
import {
  CUSTOMER_INBOUND_MATERIAL_ID,
  CUSTOMER_INBOUND_MATERIAL_LABEL,
  isCustomerInboundMaterial,
  type IndividualLaserMaterialSelection,
} from "@/lib/dripforge/laser-customer-inbound"
import {
  DEFAULT_IMAGE_LAYOUT,
  DEFAULT_LASER_FONT_ID,
  DEFAULT_TEXT_LAYOUT,
  type ElementLayout,
  type ImageLayout,
  type LaserFontId,
} from "@/lib/dripforge/laser-design"
import type { LaserDesignLayer } from "@/lib/dripforge/laser-layers"
import {
  DEFAULT_LASER_PRICING_CONFIG,
  type LaserPricingConfig,
} from "@/lib/dripforge/laser-pricing-config"
import {
  getWorkAreaForSizeId,
  INDIVIDUAL_LASER_SIZES,
} from "@/lib/dripforge/laser-work-area"
import {
  LaserDesignerStudio,
  type LaserDesignerState,
  type LaserEngravingMetrics,
} from "@/components/dripforge/shared/laser-designer-studio"
import { IndividualProcessBar } from "@/components/dripforge/shared/individual-process-bar"
import {
  buildLaserCartCustomDetails,
  laserDesignHasContent,
} from "@/lib/dripforge/build-laser-cart-details"
import { buildLaserCombinedMockup } from "@/lib/dripforge/ensure-laser-mockup"
import { ensureLaserLayers } from "@/lib/dripforge/laser-layers"
import { captureProductionLayerPng } from "@/lib/dripforge/capture-production-layer"
import type { CartItem } from "@/lib/dripforge/types"

export function PageIndividualLaser({
  setCurrentView,
  addToCart,
}: {
  setCurrentView: (view: string) => void
  addToCart: (item: CartItem) => void
}) {
  const defaultMaterial = laserMaterials[0]

  /** Material-unabhaengig — bleibt beim Wechsel von Holz/Acryl/etc. erhalten */
  const [gravurText, setGravurText] = useState("")
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string | null>(null)
  const [selectedFont, setSelectedFont] =
    useState<LaserFontId>(DEFAULT_LASER_FONT_ID)
  const [textLayout, setTextLayout] = useState<ElementLayout>({
    ...DEFAULT_TEXT_LAYOUT,
  })
  const [imageLayout, setImageLayout] = useState<ImageLayout>({
    ...DEFAULT_IMAGE_LAYOUT,
  })
  const [layers, setLayers] = useState<LaserDesignLayer[]>([])
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null)

  const [selectedMaterialId, setSelectedMaterialId] =
    useState<IndividualLaserMaterialSelection>(defaultMaterial.id)
  const [selectedSizeId, setSelectedSizeId] = useState("medium")
  const [quantity, setQuantity] = useState(1)
  const [engravingMetrics, setEngravingMetrics] =
    useState<LaserEngravingMetrics | null>(null)
  const [pricingConfig] = useState<LaserPricingConfig>(
    DEFAULT_LASER_PRICING_CONFIG
  )
  const [allowCustomerShipping, setAllowCustomerShipping] = useState(false)
  const [customerShippingInstructions, setCustomerShippingInstructions] =
    useState("")
  const [cartCapturing, setCartCapturing] = useState(false)
  const laserPreviewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void fetch("/api/settings/laser-configurator", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (data: {
          allowCustomerShipping?: boolean
          customerShippingInstructions?: string
        } | null) => {
          if (!data) return
          setAllowCustomerShipping(Boolean(data.allowCustomerShipping))
          setCustomerShippingInstructions(
            String(data.customerShippingInstructions ?? "")
          )
        }
      )
      .catch(() => {
        /* Defaults: Einsendung deaktiviert */
      })
  }, [])

  const showCustomerShippingOption =
    isCustomerShippingOptionEnabled(allowCustomerShipping)
  const isCustomerInbound = isCustomerInboundMaterial(selectedMaterialId)

  const material =
    laserMaterials.find((m) => m.id === selectedMaterialId) ?? defaultMaterial
  const previewMaterial = isCustomerInbound ? defaultMaterial : material
  const sizePreset =
    INDIVIDUAL_LASER_SIZES.find((s) => s.id === selectedSizeId) ??
    INDIVIDUAL_LASER_SIZES[1]
  const workAreaMm = useMemo(
    () => getWorkAreaForSizeId(selectedSizeId),
    [selectedSizeId]
  )

  const laserDesign: LaserDesignerState = useMemo(
    () => ({
      selectedVariant: previewMaterial.types[0] ?? "",
      selectedFont,
      engravingText: gravurText,
      textLayout,
      imageLayout: {
        ...imageLayout,
        src: uploadedImageSrc ?? imageLayout.src,
      },
      layers,
      activeLayerId,
    }),
    [
      previewMaterial.types,
      selectedFont,
      gravurText,
      textLayout,
      imageLayout,
      uploadedImageSrc,
      layers,
      activeLayerId,
    ]
  )

  const handleDesignChange = useCallback((patch: Partial<LaserDesignerState>) => {
    if (patch.engravingText !== undefined) setGravurText(patch.engravingText)
    if (patch.selectedFont !== undefined) setSelectedFont(patch.selectedFont)
    if (patch.textLayout !== undefined) setTextLayout(patch.textLayout)
    if (patch.imageLayout !== undefined) {
      setImageLayout(patch.imageLayout)
      if (patch.imageLayout.src !== undefined) {
        setUploadedImageSrc(patch.imageLayout.src)
      }
    }
    if (patch.layers !== undefined) setLayers(patch.layers)
    if (patch.activeLayerId !== undefined) setActiveLayerId(patch.activeLayerId)
  }, [])

  const materialBase = isCustomerInbound
    ? 0
    : getIndividualLaserBasePrice(selectedMaterialId)
  const basePrice = materialBase * sizePreset.priceMultiplier

  const priceBreakdown = useMemo(() => {
    const area = engravingMetrics?.maxAreaMm2 ?? 0
    return calculateLaserPrice(basePrice, area, quantity, pricingConfig)
  }, [basePrice, engravingMetrics, quantity, pricingConfig])

  const hasDesign = laserDesignHasContent(laserDesign)

  const handleAddToCart = async () => {
    if (!hasDesign || cartCapturing) return

    const designSnapshot: LaserDesignerState = {
      ...laserDesign,
      layers: laserDesign.layers.map((l) => ({ ...l })),
      textLayout: { ...laserDesign.textLayout },
      imageLayout: { ...laserDesign.imageLayout },
    }

    setCartCapturing(true)
    setActiveLayerId(null)

    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )

      const layers = ensureLaserLayers(designSnapshot)
      let previewMockup: string | undefined
      let productionLayer: string | undefined
      try {
        previewMockup = await buildLaserCombinedMockup({
          layers,
          backgroundUrl: null,
          previewRoot: laserPreviewRef.current,
        })
      } catch {
        console.warn("Mockup: Laser-Snapshot konnte nicht erstellt werden.")
      }
      try {
        const layer = await captureProductionLayerPng({
          layers,
          textLayout: designSnapshot.textLayout,
          imageLayout: designSnapshot.imageLayout,
          engravingText: designSnapshot.engravingText,
          fontId: designSnapshot.selectedFont,
        })
        productionLayer = layer ?? undefined
      } catch {
        console.warn("Produktions-Layer: Laser-Export fehlgeschlagen.")
      }

      const gravurSize = engravingMetrics?.active
      addToCart({
        id: `custom-laser-${Date.now()}`,
        name: isCustomerInbound
          ? "Personalisierte Laserkreation (Kunden-Einsendung)"
          : "Personalisierte Laserkreation",
        price: priceBreakdown.unitPrice,
        quantity,
        type: "laser",
        leitbild: previewMockup,
        previewMockup,
        productionLayer,
        customDetails: buildLaserCartCustomDetails(designSnapshot, {
          material: isCustomerInbound
            ? CUSTOMER_INBOUND_MATERIAL_LABEL
            : material.name,
          productBackgroundUrl: null,
          materialVariant: designSnapshot.selectedVariant,
          size: sizePreset.dimensionsLabel,
          isCustomerInbound,
          dimensions: gravurSize
            ? `${gravurSize.widthMm.toFixed(1)} x ${gravurSize.heightMm.toFixed(1)} mm`
            : sizePreset.dimensionsLabel,
        }),
      })

      setCurrentView("shop")
    } finally {
      setCartCapturing(false)
    }
  }

  const activeStep = hasDesign
    ? selectedMaterialId
      ? 3
      : 2
    : 0

  return (
    <div className="space-y-8 py-8">
      <div className="mx-auto max-w-6xl px-4 text-center">
        <Badge variant="secondary" className="mb-4">
          Personalisierte Kreation
        </Badge>
        <h1 className="text-4xl font-bold">
          <span className="text-foreground">Personalisierte </span>
          <span className="bg-gradient-to-r from-cyan-400 to-primary bg-clip-text text-transparent">
            Laserkreation
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Text oder Logo hochladen, Schrift wählen und live auf dem Material
          positionieren.
        </p>
      </div>

      <div className="mx-auto max-w-3xl px-4">
        <IndividualProcessBar
          steps={[
            "Bild / Text",
            "Material wählen",
            "Grösse & Menge",
            "Warenkorb",
          ]}
          activeStep={activeStep}
        />
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-4">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 lg:gap-8">
          <div className="flex min-w-0 flex-col gap-6">
            <LaserDesignerStudio
              column="settings"
              material={previewMaterial}
              productName="Personalisierte Laserkreation"
              state={laserDesign}
              onStateChange={handleDesignChange}
              showMaterialCard={false}
              showVariantPicker={false}
            />

            <Card className="rounded-2xl border-border/50 bg-card/50 shadow-sm">
              <CardContent className="p-6">
                <h3 className="mb-4 font-bold">Material wählen</h3>
                <div className="grid grid-cols-2 gap-3">
                  {laserMaterials.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMaterialId(m.id)}
                      className={cn(
                        "rounded-xl border p-4 text-left transition-colors",
                        selectedMaterialId === m.id
                          ? "border-cyan-500 bg-cyan-500/10"
                          : "border-border/60 hover:border-cyan-500/40"
                      )}
                    >
                      <span className="text-2xl">{m.icon}</span>
                      <p className="mt-2 font-bold">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ab CHF{" "}
                        {getIndividualLaserBasePrice(m.id).toFixed(2)}
                      </p>
                    </button>
                  ))}
                  {showCustomerShippingOption && (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedMaterialId(CUSTOMER_INBOUND_MATERIAL_ID)
                      }
                      className={cn(
                        "col-span-2 rounded-xl border p-4 text-left transition-colors",
                        isCustomerInbound
                          ? "border-amber-500 bg-amber-500/10"
                          : "border-dashed border-border/60 hover:border-amber-500/40"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Package className="mt-0.5 h-6 w-6 shrink-0 text-amber-500" />
                        <div>
                          <p className="font-bold">{CUSTOMER_INBOUND_MATERIAL_LABEL}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Materialpreis CHF 0.00 — nur Gravur & Arbeitszeit
                          </p>
                        </div>
                      </div>
                    </button>
                  )}
                </div>

                {isCustomerInbound && (
                  <div className="mt-4 space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                      Einsende-Instruktionen & Lieferadresse
                    </p>
                    {customerShippingInstructions.trim() ? (
                      <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {customerShippingInstructions}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Versandanleitung folgt per E-Mail nach der Bestellung.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/50 bg-card/50 shadow-sm">
              <CardContent className="p-6">
                <h3 className="mb-4 font-bold">Grösse wählen</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  {INDIVIDUAL_LASER_SIZES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSizeId(s.id)}
                      className={cn(
                        "rounded-xl border p-4 text-center transition-colors",
                        selectedSizeId === s.id
                          ? "border-cyan-500 bg-cyan-500/10"
                          : "border-border/60 hover:border-cyan-500/40"
                      )}
                    >
                      <p className="font-bold">{s.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {s.dimensionsLabel}
                      </p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <LaserDesignerStudio
              column="preview"
              material={previewMaterial}
              productName="Personalisierte Laserkreation"
              state={laserDesign}
              previewSurfaceRef={laserPreviewRef}
              onStateChange={handleDesignChange}
              workAreaMm={workAreaMm}
              onEngravingMetricsChange={setEngravingMetrics}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
          <Card className="flex min-h-[280px] flex-col rounded-2xl border border-sky-200/80 bg-sky-50 shadow-sm dark:border-cyan-500/25 dark:bg-gradient-to-b dark:from-cyan-500/10 dark:via-sky-950/20">
            <CardContent className="flex h-full flex-col p-6">
              <h3 className="mb-4 font-bold">Preisberechnung</h3>
              <div className="flex flex-1 flex-col justify-between gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Material</span>
                    <span className="text-right font-medium">
                      {isCustomerInbound
                        ? CUSTOMER_INBOUND_MATERIAL_LABEL
                        : material.name}
                    </span>
                  </div>
                  {isCustomerInbound && (
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Materialpreis</span>
                      <span className="font-medium">CHF 0.00</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Grösse</span>
                    <span className="text-right font-medium">
                      {sizePreset.dimensionsLabel}
                    </span>
                  </div>
                  {engravingMetrics && engravingMetrics.maxAreaMm2 > 0 && (
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        Gravurfläche (ca.)
                      </span>
                      <span className="font-medium">
                        {engravingMetrics.maxAreaMm2.toFixed(0)} mm²
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Basispreis</span>
                    <span className="font-medium">
                      CHF {priceBreakdown.basePrice.toFixed(2)}
                    </span>
                  </div>
                  {priceBreakdown.areaSurcharge > 0 && (
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        Aufschlag Grossfläche
                      </span>
                      <span className="font-medium">
                        CHF {priceBreakdown.areaSurcharge.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {quantity > 1 && (
                    <>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Stueckpreis</span>
                        <span className="font-medium">
                          CHF {priceBreakdown.unitPrice.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Anzahl</span>
                        <span className="font-medium">x{quantity}</span>
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <div className="mb-3 border-t border-sky-200/80 dark:border-cyan-500/20" />
                  <div className="flex justify-between gap-3 text-lg font-bold">
                    <span>Gesamtpreis</span>
                    <span className="text-cyan-600 dark:text-cyan-400">
                      CHF {priceBreakdown.totalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="flex min-h-[280px] flex-col rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-border/60 dark:bg-card">
            <CardContent className="flex h-full flex-col justify-between p-6">
              <div>
                <h3 className="mb-4 font-bold">Anzahl</h3>
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    aria-label="Anzahl verringern"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center text-lg font-bold tabular-nums">
                    {quantity}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setQuantity(quantity + 1)}
                    aria-label="Anzahl erhöhen"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Stueckpreis: CHF {priceBreakdown.unitPrice.toFixed(2)}
                </p>
              </div>

              <div className="mt-6">
                <Button
                  onClick={() => void handleAddToCart()}
                  disabled={!hasDesign || cartCapturing}
                  className="w-full bg-cyan-500 hover:bg-cyan-600"
                  size="lg"
                >
                  {cartCapturing ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <ShoppingCart className="mr-2 h-5 w-5" />
                  )}
                  {cartCapturing
                    ? "Design wird gespeichert…"
                    : "In den Warenkorb"}
                </Button>
                {!hasDesign && (
                  <p className="mt-3 text-center text-sm text-muted-foreground">
                    Bitte Gravur-Text eingeben oder ein Logo hochladen.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
