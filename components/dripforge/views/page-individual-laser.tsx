"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react"
import { ImagePlus, Loader2, Mail, Minus, Package, Plus, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { isCustomerShippingOptionEnabled } from "@/lib/dripforge/customer-shipping-visibility"
import {
  DEFAULT_LASER_MAX_WORK_AREA_MM,
  formatLaserMaxWorkAreaLabel,
  type LaserMaxWorkAreaMm,
} from "@/lib/admin/laser-configurator-types"
import {
  createDefaultLaserCategories,
  DEFAULT_PRICING_FOOTNOTE,
  formatFromPriceChf,
  type IndividualPricingCategory,
} from "@/lib/admin/individual-pricing-types"
import { PricingCategoryPicker } from "@/components/dripforge/shared/pricing-category-picker"
import { PricingFootnote } from "@/components/dripforge/shared/pricing-footnote"
import {
  CUSTOMER_INBOUND_MATERIAL_ID,
  CUSTOMER_INBOUND_MATERIAL_LABEL,
  isCustomerInboundMaterial,
  isOtherMaterial,
  OTHER_MATERIAL_ID,
  OTHER_MATERIAL_LABEL,
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
import { DEFAULT_WORK_AREA_MM } from "@/lib/dripforge/laser-work-area"
import {
  LaserDesignerStudio,
  type LaserDesignerState,
  type LaserEngravingMetrics,
} from "@/components/dripforge/shared/laser-designer-studio"
import { SaveDesignButton } from "@/components/konto/save-design-button"
import { IndividualProcessBar } from "@/components/dripforge/shared/individual-process-bar"
import {
  buildLaserCartCustomDetails,
  laserDesignHasContent,
} from "@/lib/dripforge/build-laser-cart-details"
import { buildLaserCombinedMockup } from "@/lib/dripforge/ensure-laser-mockup"
import { ensureLaserLayers } from "@/lib/dripforge/laser-layers"
import { captureProductionLayerPng } from "@/lib/dripforge/capture-production-layer"
import { useLaserMaterialsCatalog } from "@/hooks/use-laser-materials-catalog"
import type { CartItem } from "@/lib/dripforge/types"

const PRICE_ON_REQUEST_LABEL = "Auf Anfrage / gemäss Offerte"

export function PageIndividualLaser({
  setCurrentView,
  addToCart: _addToCart,
}: {
  setCurrentView: (view: string) => void
  addToCart: (item: CartItem) => void
}) {
  void _addToCart
  void setCurrentView
  const { materials: laserMaterials } = useLaserMaterialsCatalog()
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
  const [customMaterialNote, setCustomMaterialNote] = useState("")
  const [productBackgroundUrl, setProductBackgroundUrl] = useState<
    string | null
  >(null)
  const [quantity, setQuantity] = useState(1)
  const [engravingMetrics, setEngravingMetrics] =
    useState<LaserEngravingMetrics | null>(null)
  const [allowCustomerShipping, setAllowCustomerShipping] = useState(false)
  const [customerShippingInstructions, setCustomerShippingInstructions] =
    useState("")
  const [maxWorkAreaMm, setMaxWorkAreaMm] = useState<LaserMaxWorkAreaMm>({
    ...DEFAULT_LASER_MAX_WORK_AREA_MM,
  })
  const [pricingCategories, setPricingCategories] = useState<
    IndividualPricingCategory[]
  >(createDefaultLaserCategories)
  const [pricingFootnote, setPricingFootnote] = useState(DEFAULT_PRICING_FOOTNOTE)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  )
  const [productLengthMm, setProductLengthMm] = useState("")
  const [productWidthMm, setProductWidthMm] = useState("")
  const [productHeightMm, setProductHeightMm] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerMessage, setCustomerMessage] = useState("")
  const [inquirySending, setInquirySending] = useState(false)
  const [inquiryError, setInquiryError] = useState<string | null>(null)
  const [inquirySuccess, setInquirySuccess] = useState<string | null>(null)
  const laserPreviewRef = useRef<HTMLDivElement>(null)
  const productFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void fetch("/api/settings/laser-configurator", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (data: {
          allowCustomerShipping?: boolean
          customerShippingInstructions?: string
          maxWorkAreaMm?: LaserMaxWorkAreaMm
        } | null) => {
          if (!data) return
          setAllowCustomerShipping(Boolean(data.allowCustomerShipping))
          setCustomerShippingInstructions(
            String(data.customerShippingInstructions ?? "")
          )
          if (data.maxWorkAreaMm) {
            setMaxWorkAreaMm({
              lengthMm: Number(data.maxWorkAreaMm.lengthMm) || DEFAULT_LASER_MAX_WORK_AREA_MM.lengthMm,
              widthMm: Number(data.maxWorkAreaMm.widthMm) || DEFAULT_LASER_MAX_WORK_AREA_MM.widthMm,
              heightMm: Number(data.maxWorkAreaMm.heightMm) || DEFAULT_LASER_MAX_WORK_AREA_MM.heightMm,
            })
          }
        }
      )
      .catch(() => {
        /* Defaults: Einsendung deaktiviert */
      })

    void fetch("/api/settings/individual-pricing", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.laser) return
        if (Array.isArray(data.laser.categories) && data.laser.categories.length > 0) {
          setPricingCategories(data.laser.categories)
          setSelectedCategoryId((prev) => prev ?? data.laser.categories[0]?.id ?? null)
        }
        if (typeof data.laser.footnote === "string" && data.laser.footnote.trim()) {
          setPricingFootnote(data.laser.footnote)
        }
      })
      .catch(() => {
        /* Defaults */
      })
  }, [])

  useEffect(() => {
    if (!selectedCategoryId && pricingCategories[0]) {
      setSelectedCategoryId(pricingCategories[0].id)
    }
  }, [pricingCategories, selectedCategoryId])

  // Katalog kann asynchron laden — Default-Material nachziehen, wenn noch keines gewählt
  useEffect(() => {
    if (
      laserMaterials.length > 0 &&
      !isCustomerInboundMaterial(selectedMaterialId) &&
      !isOtherMaterial(selectedMaterialId) &&
      !laserMaterials.some((m) => m.id === selectedMaterialId)
    ) {
      setSelectedMaterialId(laserMaterials[0].id)
    }
  }, [laserMaterials, selectedMaterialId])

  const showCustomerShippingOption =
    isCustomerShippingOptionEnabled(allowCustomerShipping)
  const isCustomerInbound = isCustomerInboundMaterial(selectedMaterialId)
  const isOther = isOtherMaterial(selectedMaterialId)
  const isPriceOnRequest = isCustomerInbound || isOther

  const material =
    laserMaterials.find((m) => m.id === selectedMaterialId) ?? defaultMaterial
  const previewMaterial =
    isCustomerInbound || isOther ? defaultMaterial : material
  const workAreaMm = DEFAULT_WORK_AREA_MM

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

  const handleProductBackgroundUpload = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ""
      if (!file || !file.type.startsWith("image/")) return
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setProductBackgroundUrl(reader.result)
        }
      }
      reader.readAsDataURL(file)
    },
    []
  )

  const selectedCategory =
    pricingCategories.find((c) => c.id === selectedCategoryId) ??
    pricingCategories[0] ??
    null

  const hasDesign = laserDesignHasContent(laserDesign)

  const materialLabel = isCustomerInbound
    ? CUSTOMER_INBOUND_MATERIAL_LABEL
    : isOther
      ? customMaterialNote.trim() || OTHER_MATERIAL_LABEL
      : material.name

  const handleSendInquiry = async () => {
    if (!hasDesign || inquirySending) return
    setInquiryError(null)
    setInquirySuccess(null)

    const length = Number(productLengthMm)
    const width = Number(productWidthMm)
    const height = Number(productHeightMm)
    if (![length, width, height].every((n) => Number.isFinite(n) && n > 0)) {
      setInquiryError("Bitte Produktmasse (Länge, Breite, Höhe) in mm angeben.")
      return
    }
    if (!customerName.trim() || !customerEmail.trim()) {
      setInquiryError("Bitte Name und E-Mail angeben.")
      return
    }

    const designSnapshot: LaserDesignerState = {
      ...laserDesign,
      layers: laserDesign.layers.map((l) => ({ ...l })),
      textLayout: { ...laserDesign.textLayout },
      imageLayout: { ...laserDesign.imageLayout },
    }

    setInquirySending(true)
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
          backgroundUrl: productBackgroundUrl,
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

      const details = buildLaserCartCustomDetails(designSnapshot, {
        material: materialLabel,
        productBackgroundUrl,
        materialVariant: designSnapshot.selectedVariant,
        isCustomerInbound,
        dimensions: `${length} x ${width} x ${height} mm`,
      })

      const res = await fetch("/api/laser-anfragen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim() || undefined,
          message: customerMessage.trim() || undefined,
          material: materialLabel,
          categoryLabel: selectedCategory
            ? `${selectedCategory.label} (${selectedCategory.sizeHint})`
            : undefined,
          categoryFromPriceChf: isPriceOnRequest
            ? undefined
            : selectedCategory?.fromPriceChf,
          productLengthMm: length,
          productWidthMm: width,
          productHeightMm: height,
          quantity,
          engravingText: designSnapshot.engravingText,
          mockupDataUrl: previewMockup,
          productionLayerDataUrl: productionLayer,
          productBackgroundDataUrl: productBackgroundUrl,
          uploadedImageDataUrls: details.uploadedImages ?? [],
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error ?? "Anfrage konnte nicht gesendet werden.")
      }
      setInquirySuccess(
        data.message ??
          "Unverbindliche Anfrage wurde gesendet. Wir melden uns bei Ihnen."
      )
    } catch (err) {
      setInquiryError(
        err instanceof Error ? err.message : "Anfrage fehlgeschlagen."
      )
    } finally {
      setInquirySending(false)
    }
  }

  const activeStep = !hasDesign
    ? 0
    : selectedMaterialId
      ? 2
      : 1

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
          steps={["Design", "Produkt & Material", "Anfrage"]}
          activeStep={activeStep}
        />
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4">
        <Card className="rounded-2xl border-cyan-500/30 bg-cyan-500/5 shadow-sm">
          <CardContent className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">
              {formatLaserMaxWorkAreaLabel(maxWorkAreaMm)}
            </p>
            <p className="text-xs text-muted-foreground">
              Bitte Produktmasse Ihres Gegenstands unten angeben.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 xl:grid-cols-3 xl:gap-8">
          {/* Spalte 1: Produkt hochladen + Live-Vorschau / Werkzeuge */}
          <div className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={productFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProductBackgroundUpload}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => productFileInputRef.current?.click()}
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                Produkt hochladen
              </Button>
              {productBackgroundUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setProductBackgroundUrl(null)}
                >
                  <X className="mr-1 h-4 w-4" />
                  Produktbild entfernen
                </Button>
              )}
            </div>

            <LaserDesignerStudio
              column="preview"
              material={previewMaterial}
              productName="Personalisierte Laserkreation"
              state={laserDesign}
              previewSurfaceRef={laserPreviewRef}
              onStateChange={handleDesignChange}
              workAreaMm={workAreaMm}
              onEngravingMetricsChange={setEngravingMetrics}
              customizationBackgroundUrl={productBackgroundUrl ?? undefined}
            />
          </div>

          {/* Spalte 2: Text-Layer, Masse, Material */}
          <div className="flex min-w-0 flex-col gap-6">
            <LaserDesignerStudio
              column="settings"
              material={previewMaterial}
              productName="Personalisierte Laserkreation"
              state={laserDesign}
              onStateChange={handleDesignChange}
              showMaterialCard={false}
              showVariantPicker={false}
              customizationBackgroundUrl={productBackgroundUrl ?? undefined}
            />

            <Card className="rounded-2xl border-border/50 bg-card/50 shadow-sm">
              <CardContent className="space-y-4 p-6">
                <div>
                  <h3 className="mb-3 font-bold">Produktmasse (mm)</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="product-length">Länge</Label>
                      <Input
                        id="product-length"
                        type="number"
                        min={0.1}
                        step="0.1"
                        value={productLengthMm}
                        onChange={(e) => setProductLengthMm(e.target.value)}
                        placeholder="mm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="product-width">Breite</Label>
                      <Input
                        id="product-width"
                        type="number"
                        min={0.1}
                        step="0.1"
                        value={productWidthMm}
                        onChange={(e) => setProductWidthMm(e.target.value)}
                        placeholder="mm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="product-height">Höhe</Label>
                      <Input
                        id="product-height"
                        type="number"
                        min={0.1}
                        step="0.1"
                        value={productHeightMm}
                        onChange={(e) => setProductHeightMm(e.target.value)}
                        placeholder="mm"
                      />
                    </div>
                  </div>
                </div>

                <h3 className="font-bold">Material wählen</h3>
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
                        {selectedCategory
                          ? formatFromPriceChf(selectedCategory.fromPriceChf)
                          : "ab CHF 9.99"}
                      </p>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedMaterialId(OTHER_MATERIAL_ID)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-colors",
                      isOther
                        ? "border-cyan-500 bg-cyan-500/10"
                        : "border-border/60 hover:border-cyan-500/40"
                    )}
                  >
                    <span className="text-2xl">✨</span>
                    <p className="mt-2 font-bold">{OTHER_MATERIAL_LABEL}</p>
                    <p className="text-xs text-muted-foreground">
                      {PRICE_ON_REQUEST_LABEL}
                    </p>
                  </button>
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
                          <p className="font-bold">
                            {CUSTOMER_INBOUND_MATERIAL_LABEL}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {PRICE_ON_REQUEST_LABEL}
                          </p>
                        </div>
                      </div>
                    </button>
                  )}
                </div>

                {isOther && (
                  <div className="mt-4 space-y-2">
                    <label
                      htmlFor="custom-material-note"
                      className="text-sm font-medium"
                    >
                      Materialbeschreibung
                    </label>
                    <Input
                      id="custom-material-note"
                      value={customMaterialNote}
                      onChange={(e) => setCustomMaterialNote(e.target.value)}
                      placeholder="z. B. Bambus, Glas, Keramik …"
                    />
                  </div>
                )}

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
          </div>

          {/* Spalte 3: Menge, Preiskategorie, Kontakt, Anfrage */}
          <div className="flex min-w-0 flex-col gap-6 lg:col-span-2 xl:col-span-1">
            <Card className="rounded-2xl border border-sky-200/80 bg-sky-50 shadow-sm dark:border-cyan-500/25 dark:bg-gradient-to-b dark:from-cyan-500/10 dark:via-sky-950/20">
              <CardContent className="flex flex-col gap-4 p-6">
                <div>
                  <h3 className="mb-3 font-bold">Anzahl</h3>
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
                </div>

                <PricingCategoryPicker
                  categories={pricingCategories}
                  selectedId={selectedCategoryId}
                  onSelect={setSelectedCategoryId}
                  accentClassName="border-cyan-500 bg-cyan-500/10"
                />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Material</span>
                    <span className="text-right font-medium">{materialLabel}</span>
                  </div>
                  {engravingMetrics && engravingMetrics.maxAreaMm2 > 0 && (
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Gravurfläche (ca.)</span>
                      <span className="font-medium">
                        {engravingMetrics.maxAreaMm2.toFixed(0)} mm²
                      </span>
                    </div>
                  )}
                  {isPriceOnRequest ? (
                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                      {PRICE_ON_REQUEST_LABEL}
                    </p>
                  ) : (
                    <div className="flex justify-between gap-3 text-lg font-bold">
                      <span>Richtpreis</span>
                      <span className="text-cyan-600 dark:text-cyan-400">
                        {selectedCategory
                          ? formatFromPriceChf(selectedCategory.fromPriceChf)
                          : "—"}
                      </span>
                    </div>
                  )}
                </div>
                <PricingFootnote text={pricingFootnote} />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-border/60 dark:bg-card">
              <CardContent className="flex flex-col justify-between gap-4 p-6">
                <div className="space-y-3">
                  <h3 className="font-bold">Kontaktdaten für Anfrage</h3>
                  <div className="space-y-1">
                    <Label htmlFor="laser-customer-name">Name *</Label>
                    <Input
                      id="laser-customer-name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Vor- und Nachname"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="laser-customer-email">E-Mail *</Label>
                    <Input
                      id="laser-customer-email"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="name@example.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="laser-customer-phone">Telefon</Label>
                    <Input
                      id="laser-customer-phone"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+41 …"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="laser-customer-message">Nachricht</Label>
                    <Textarea
                      id="laser-customer-message"
                      value={customerMessage}
                      onChange={(e) => setCustomerMessage(e.target.value)}
                      rows={3}
                      placeholder="Optionale Hinweise zur Gravur…"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  {inquiryError && (
                    <p className="text-sm text-red-500">{inquiryError}</p>
                  )}
                  {inquirySuccess && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">
                      {inquirySuccess}
                    </p>
                  )}
                  <Button
                    onClick={() => void handleSendInquiry()}
                    disabled={!hasDesign || inquirySending}
                    className="w-full bg-cyan-500 hover:bg-cyan-600"
                    size="lg"
                  >
                    {inquirySending ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <Mail className="mr-2 h-5 w-5" />
                    )}
                    {inquirySending
                      ? "Anfrage wird gesendet…"
                      : "Unverbindliche Anfrage senden"}
                  </Button>
                  <SaveDesignButton
                    designType="laser"
                    defaultLabel={`Laser-Design ${new Date().toLocaleDateString("de-CH")}`}
                    previewUrl={laserDesign.imageLayout?.src || null}
                    config={{
                      materialId: selectedMaterialId,
                      engravingText: laserDesign.engravingText,
                      selectedFont: laserDesign.selectedFont,
                      selectedVariant: laserDesign.selectedVariant,
                      layers: laserDesign.layers,
                      textLayout: laserDesign.textLayout,
                      imageLayout: laserDesign.imageLayout,
                    }}
                    className="w-full"
                  />
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
    </div>
  )
}
