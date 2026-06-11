"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import type { Object3D, Vector3 } from "three"
import * as THREE from "three"
import {
  CheckCircle2,
  Minus,
  Plus,
  ShoppingCart,
  Upload,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  ColorInstructionsPanel,
  readImageFileAsDataUrl,
} from "@/components/dripforge/shared/color-instructions-panel"
import {
  FilamentMultiColorPicker,
  assignColorsToMeshParts,
  getPrimaryColorHex,
  type FilamentMultiColorSelection,
} from "@/components/dripforge/shared/filament-multi-color-picker"
import type { ColoredMeshPart } from "@/components/dripforge/shared/model-3d-preview"
import { IndividualProcessBar } from "@/components/dripforge/shared/individual-process-bar"
import {
  disposeLoadedModel,
  loadModelFromFileAsync,
  type LoadedIndividualModel,
  type ModelMeshPart,
} from "@/lib/dripforge/load-3d-geometry"
import { calculate3DPrintPrice } from "@/lib/dripforge/calculate-3d-print-price"
import {
  getLongestAxisAtScale,
  getRealDimensionsMm,
  NORMALIZED_LONGEST_AXIS_MM,
  scalePercentFromLongestAxis,
} from "@/lib/dripforge/model-scale"
import { exceedsMaxPrintVolume } from "@/lib/dripforge/print-limits"
import {
  DEFAULT_PRICING_CONFIG,
  type PricingConfig,
} from "@/lib/dripforge/pricing-config"
import { PrintVolumeWarning } from "@/components/dripforge/shared/print-volume-warning"
import { useFilamentMaterials } from "@/hooks/use-filament-materials"
import { capture3dPreviewLeitbild } from "@/lib/dripforge/capture-leitbild"
import type { CartItem } from "@/lib/dripforge/types"

const SCALE_MIN = 10
const SCALE_MAX = 200

function clampScalePercent(value: number): number {
  if (Number.isNaN(value)) return 100
  return Math.round(Math.max(SCALE_MIN, Math.min(SCALE_MAX, value)))
}

const Model3DPreview = dynamic(
  () =>
    import("@/components/dripforge/shared/model-3d-preview").then(
      (m) => m.Model3DPreview
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-border/50 bg-secondary/40 text-sm text-muted-foreground">
        3D-Viewer wird geladen…
      </div>
    ),
  }
)

export function PageIndividual3D({
  setCurrentView,
  addToCart,
}: {
  setCurrentView: (view: string) => void
  addToCart: (item: CartItem) => void
}) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [meshParts, setMeshParts] = useState<ModelMeshPart[]>([])
  const [nativeScene, setNativeScene] = useState<Object3D | null>(null)
  const [hasEmbeddedColors, setHasEmbeddedColors] = useState(false)
  const [sourceSizeMm, setSourceSizeMm] = useState<Vector3 | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [filamentTab, setFilamentTab] = useState("pla")
  const [multiColorSelection, setMultiColorSelection] =
    useState<FilamentMultiColorSelection | null>(null)
  const [colorWishes, setColorWishes] = useState("")
  const [colorReferenceImageFile, setColorReferenceImageFile] =
    useState<File | null>(null)
  const [colorReferenceImagePreview, setColorReferenceImagePreview] = useState<
    string | null
  >(null)
  const [colorReferenceImageName, setColorReferenceImageName] = useState<
    string | null
  >(null)
  const [quantity, setQuantity] = useState(1)
  const [scale, setScale] = useState(100)
  /** Spaeter: per fetch aus Admin-Portal / Datenbank befuellen */
  const [pricingConfig] = useState<PricingConfig>(DEFAULT_PRICING_CONFIG)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const filamentMaterials = useFilamentMaterials()

  const scaleFactor = scale / 100
  const hasModel = meshParts.length > 0 || Boolean(nativeScene)

  const longestAxisMm = sourceSizeMm
    ? getLongestAxisAtScale(sourceSizeMm, scale)
    : 0
  const longestAxisMmMin = sourceSizeMm
    ? getLongestAxisAtScale(sourceSizeMm, SCALE_MIN)
    : 0
  const longestAxisMmMax = sourceSizeMm
    ? getLongestAxisAtScale(sourceSizeMm, SCALE_MAX)
    : 0

  const setScalePercent = (value: number) => setScale(clampScalePercent(value))

  const dimensions = useMemo(() => {
    if (!sourceSizeMm) return null
    return getRealDimensionsMm(sourceSizeMm, scale)
  }, [sourceSizeMm, scale])

  const isOversized = dimensions ? exceedsMaxPrintVolume(dimensions) : false

  const colorCount = multiColorSelection?.colors.length ?? 0

  const allColorsInStock =
    multiColorSelection?.colors.every((c) => c.inStock) ?? false

  const priceBreakdown = useMemo(() => {
    if (!dimensions) return null
    return calculate3DPrintPrice(
      dimensions.volume,
      quantity,
      pricingConfig,
      colorCount
    )
  }, [dimensions, quantity, pricingConfig, colorCount])

  const previewMeshParts = useMemo((): ColoredMeshPart[] | null => {
    if (meshParts.length === 0) return null
    if (hasEmbeddedColors && nativeScene) return null

    const preserveFlags = meshParts.map((p) =>
      Boolean(p.preserveOriginalAppearance)
    )
    const colors = assignColorsToMeshParts(
      meshParts.length,
      multiColorSelection,
      hasEmbeddedColors,
      preserveFlags
    )

    return meshParts.map((part, index) => ({
      geometry: part.geometry,
      color: colors[index] ?? getPrimaryColorHex(multiColorSelection),
      material: part.material,
      hasVertexColors: part.hasVertexColors,
      preserveOriginalAppearance: part.preserveOriginalAppearance,
    }))
  }, [meshParts, multiColorSelection, hasEmbeddedColors, nativeScene])

  const applyLoadedModel = useCallback((loaded: LoadedIndividualModel) => {
    setMeshParts(loaded.parts)
    setNativeScene(loaded.nativeScene ?? null)
    setHasEmbeddedColors(loaded.hasEmbeddedColors)
    setSourceSizeMm(loaded.sourceSizeMm.clone())
    setScale(100)
    setColorWishes("")
    setColorReferenceImageFile(null)
    setColorReferenceImagePreview(null)
    setColorReferenceImageName(null)
  }, [])

  const resetModelState = useCallback(() => {
    setMeshParts([])
    setNativeScene(null)
    setHasEmbeddedColors(false)
    setSourceSizeMm(null)
  }, [])

  const disposeCurrentModel = useCallback(
    (parts: ModelMeshPart[], scene: Object3D | null) => {
      if (parts.length === 0 && !scene) return
      disposeLoadedModel({
        parts,
        nativeScene: scene,
        hasEmbeddedColors: false,
        sourceSizeMm: new THREE.Vector3(),
        longestAxisMm: 0,
      })
    },
    []
  )

  const handleReferenceImageChange = useCallback((file: File | null) => {
    setColorReferenceImagePreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev)
      return null
    })
    setColorReferenceImageFile(file)
    if (!file) {
      setColorReferenceImageName(null)
      return
    }
    setColorReferenceImageName(file.name)
    setColorReferenceImagePreview(URL.createObjectURL(file))
  }, [])

  const parseUploadedFile = useCallback(
    async (file: File) => {
      const extension = file.name.split(".").pop()?.toLowerCase()
      const previewExtensions = ["stl", "obj", "glb", "gltf"]

      if (!extension || !previewExtensions.includes(extension)) {
        setLoadError(
          "Fuer die Live-Vorschau bitte STL, OBJ, GLB oder GLTF verwenden (.3MF nur als Auftrag)."
        )
        setUploadedFile(file)
        resetModelState()
        return
      }

      setIsParsing(true)
      setLoadError(null)

      try {
        const buffer = await file.arrayBuffer()
        const loaded = await loadModelFromFileAsync(file.name, buffer)
        disposeCurrentModel(meshParts, nativeScene)
        applyLoadedModel(loaded)
        setUploadedFile(file)
      } catch (err) {
        disposeCurrentModel(meshParts, nativeScene)
        resetModelState()
        setUploadedFile(file)
        setLoadError(
          err instanceof Error ? err.message : "Datei konnte nicht gelesen werden."
        )
      } finally {
        setIsParsing(false)
      }
    },
    [
      applyLoadedModel,
      disposeCurrentModel,
      meshParts,
      nativeScene,
      resetModelState,
    ]
  )

  useEffect(() => {
    return () => {
      disposeCurrentModel(meshParts, nativeScene)
      if (colorReferenceImagePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(colorReferenceImagePreview)
      }
    }
  }, [meshParts, nativeScene, disposeCurrentModel, colorReferenceImagePreview])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void parseUploadedFile(file)
    e.target.value = ""
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) void parseUploadedFile(file)
  }

  const handleAddToCart = async () => {
    if (
      !uploadedFile ||
      !dimensions ||
      !priceBreakdown ||
      !multiColorSelection ||
      !allColorsInStock ||
      colorCount < 1 ||
      isOversized
    )
      return

    const colorSummary = multiColorSelection.colors
      .sort((a, b) => a.slot - b.slot)
      .map((c) => `Farbe ${c.slot}: ${c.colorName}`)
      .join(", ")

    let colorReferenceImageDataUrl: string | null = null
    if (colorReferenceImageFile) {
      try {
        colorReferenceImageDataUrl = await readImageFileAsDataUrl(
          colorReferenceImageFile
        )
      } catch {
        colorReferenceImageDataUrl = colorReferenceImagePreview
      }
    }

    let leitbild: string | undefined
    try {
      const leitbildUrl = await capture3dPreviewLeitbild(previewCanvasRef.current)
      leitbild = leitbildUrl ?? undefined
    } catch {
      console.warn("Leitbild: 3D-Snapshot konnte nicht erstellt werden.")
    }

    addToCart({
      id: `custom-3d-${Date.now()}`,
      name: `Individueller 3D-Druck: ${uploadedFile.name}`,
      price: priceBreakdown.unitPrice,
      quantity,
      type: "3d",
      leitbild,
      customDetails: {
        fileName: uploadedFile.name,
        filament: multiColorSelection.materialName,
        color: colorSummary,
        dimensions: `${dimensions.x.toFixed(1)} x ${dimensions.y.toFixed(1)} x ${dimensions.z.toFixed(1)} mm`,
        scale: `${scale}% (laengste Achse ${longestAxisMm.toFixed(1)} mm bei ${NORMALIZED_LONGEST_AXIS_MM} mm = 100 %)`,
        colorWishes: colorWishes.trim() || undefined,
        colorReferenceImage: colorReferenceImageDataUrl,
        colorReferenceImageName: colorReferenceImageName ?? undefined,
        hasEmbeddedModelColors: hasEmbeddedColors,
      },
    })

    setCurrentView("shop")
  }

  const activeStep = uploadedFile
    ? allColorsInStock && colorCount > 0
      ? 3
      : 2
    : 0

  return (
    <div className="space-y-8 py-8">
      <div className="mx-auto max-w-6xl px-4 text-center">
        <Badge variant="secondary" className="mb-4">
          Individueller Auftrag
        </Badge>
        <h1 className="text-4xl font-bold">
          <span className="text-foreground">Dein </span>
          <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
            3D-Druck
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Lade deine Datei hoch, waehle AMS-Farben und passe die Groesse an — die
          Vorschau zeigt exakte Masse (320 mm = 100 %).
        </p>
      </div>

      <div className="mx-auto max-w-3xl px-4">
        <IndividualProcessBar
          steps={["Datei hochladen", "Material waehlen", "Farbe & Groesse", "Warenkorb"]}
          activeStep={activeStep}
        />
      </div>

      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-6">
                <h3 className="mb-4 font-bold">1. Datei hochladen</h3>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className={`relative flex h-44 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
                    uploadedFile
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <input
                    type="file"
                    accept=".stl,.obj,.glb,.gltf,.3mf"
                    onChange={handleFileUpload}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                  {uploadedFile ? (
                    <>
                      <CheckCircle2 className="mb-2 h-10 w-10 text-primary" />
                      <p className="max-w-[90%] truncate font-medium">
                        {uploadedFile.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="mb-2 h-10 w-10 text-muted-foreground" />
                      <p className="font-medium">Datei hierher ziehen</p>
                      <p className="text-sm text-muted-foreground">
                        oder klicken zum Auswaehlen
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        STL, OBJ, GLB, GLTF (Live-Vorschau) · 3MF (max. 50 MB)
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-6">
                <h3 className="mb-4 font-bold">Live-Vorschau</h3>
                {isOversized && <PrintVolumeWarning />}
                <Model3DPreview
                  ref={previewCanvasRef}
                  meshParts={previewMeshParts}
                  nativeScene={nativeScene}
                  preserveEmbeddedColors={hasEmbeddedColors}
                  color={getPrimaryColorHex(multiColorSelection)}
                  scaleFactor={scaleFactor}
                  dimensionsMm={
                    dimensions
                      ? { x: dimensions.x, y: dimensions.y, z: dimensions.z }
                      : null
                  }
                  isOversized={isOversized}
                  isLoading={isParsing}
                  error={loadError}
                />
                {hasEmbeddedColors && hasModel && (
                  <p className="mt-2 text-center text-xs text-cyan-700 dark:text-cyan-400">
                    Originalfarben und Texturen aus der Datei werden in der
                    Vorschau beibehalten.
                  </p>
                )}
                {hasModel && sourceSizeMm && (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Normierung: laengste Achse der Datei = {NORMALIZED_LONGEST_AXIS_MM}{" "}
                    mm bei 100 %
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-6">
                <h3 className="mb-2 font-bold">2. Filament & Farbe (Mehrfarben)</h3>
                <FilamentMultiColorPicker
                  materials={filamentMaterials}
                  activeTab={filamentTab}
                  onTabChange={setFilamentTab}
                  onSelectionChange={setMultiColorSelection}
                />

                {hasModel && !hasEmbeddedColors && (
                  <ColorInstructionsPanel
                    className="mt-4"
                    colorWishes={colorWishes}
                    onColorWishesChange={setColorWishes}
                    referenceImagePreview={colorReferenceImagePreview}
                    referenceImageName={colorReferenceImageName}
                    onReferenceImageChange={handleReferenceImageChange}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-6">
                <h3 className="mb-4 font-bold">3. Groesse & Menge</h3>
                <div className="space-y-5">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium">Groesse (Skalierung)</span>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={SCALE_MIN}
                          max={SCALE_MAX}
                          step={1}
                          value={scale}
                          disabled={!hasModel}
                          onChange={(e) =>
                            setScalePercent(Number(e.target.value))
                          }
                          className={cn(
                            "h-9 w-[4.5rem] rounded-lg border-border/60 bg-background/60 px-2 text-center text-sm font-semibold tabular-nums",
                            "focus-visible:border-primary/50 focus-visible:ring-primary/20"
                          )}
                          aria-label="Skalierung in Prozent"
                        />
                        <span className="text-sm font-medium text-muted-foreground">
                          %
                        </span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={SCALE_MIN}
                      max={SCALE_MAX}
                      step={1}
                      value={scale}
                      onChange={(e) =>
                        setScalePercent(Number(e.target.value))
                      }
                      className="h-2 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!hasModel}
                      aria-label="Skalierungsschieberegler"
                    />
                    <p className="text-xs text-muted-foreground">
                      100 % = {NORMALIZED_LONGEST_AXIS_MM} mm laengste Achse (max.
                      Bauraum)
                    </p>
                  </div>

                  {sourceSizeMm && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">
                        Laengste Achse (mm)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={longestAxisMmMin}
                          max={longestAxisMmMax}
                          step={0.1}
                          value={Number(longestAxisMm.toFixed(1))}
                          disabled={!hasModel}
                          onChange={(e) => {
                            const mm = Number(e.target.value)
                            if (!sourceSizeMm || Number.isNaN(mm)) return
                            setScalePercent(scalePercentFromLongestAxis(mm))
                          }}
                          className={cn(
                            "h-9 w-[5.5rem] rounded-lg border-border/60 bg-background/60 px-2 text-center text-sm font-semibold tabular-nums",
                            "focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/20"
                          )}
                          aria-label="Laengste Achse in Millimetern"
                        />
                        <span className="text-sm font-medium text-muted-foreground">
                          mm
                        </span>
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="mb-2 block text-sm">Anzahl</span>
                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-12 text-center font-bold">{quantity}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setQuantity(quantity + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {dimensions && priceBreakdown && (
              <Card className="border-primary/30 bg-gradient-to-b from-primary/10 to-transparent">
                <CardContent className="p-6">
                  <h3 className="mb-4 font-bold">Preisberechnung</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Abmessungen</span>
                      <span>
                        {dimensions.x.toFixed(1)} x {dimensions.y.toFixed(1)} x{" "}
                        {dimensions.z.toFixed(1)} mm
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Volumen (ca.)</span>
                      <span>{priceBreakdown.volumeCm3.toFixed(1)} cm³</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gewicht (ca.)</span>
                      <span>{priceBreakdown.calculatedWeightG.toFixed(1)} g</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Material ({multiColorSelection?.materialName ?? "PLA"})
                      </span>
                      <span>CHF {priceBreakdown.materialCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Farben ({priceBreakdown.colorCount})
                      </span>
                      <span className="max-w-[55%] text-right text-xs">
                        {multiColorSelection?.colors
                          .sort((a, b) => a.slot - b.slot)
                          .map((c) => c.colorName)
                          .join(", ") ?? "—"}
                      </span>
                    </div>
                    {priceBreakdown.multiColorSurcharge > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Mehrfarben-Aufschlag (
                          {pricingConfig.multiColorSurchargePercentPerExtra}% pro
                          Extra-Farbe)
                        </span>
                        <span>
                          CHF {priceBreakdown.multiColorSurcharge.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Setup-Gebuehr</span>
                      <span>CHF {priceBreakdown.setupFee.toFixed(2)}</span>
                    </div>
                    {quantity > 1 && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Stueckpreis</span>
                          <span>CHF {priceBreakdown.unitPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Anzahl</span>
                          <span>x{quantity}</span>
                        </div>
                      </>
                    )}
                    <div className="my-3 border-t border-border" />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Gesamtpreis</span>
                      <span className="text-primary">
                        CHF {priceBreakdown.totalPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={handleAddToCart}
                    disabled={
                      !allColorsInStock ||
                      colorCount < 1 ||
                      !!loadError ||
                      !hasModel ||
                      isOversized
                    }
                    className="mt-6 w-full bg-primary hover:bg-primary/90"
                    size="lg"
                  >
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    In den Warenkorb
                  </Button>
                  {isOversized && (
                    <p className="mt-3 text-center text-sm font-medium text-red-500">
                      Warenkorb gesperrt: Modell ueberschreitet den maximalen
                      Druckbereich.
                    </p>
                  )}
                  {multiColorSelection && !allColorsInStock && (
                    <p className="mt-3 text-center text-sm text-red-400">
                      Mindestens eine gewaehlte Farbe ist nicht auf Lager.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
