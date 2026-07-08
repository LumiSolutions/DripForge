"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import type { Object3D, Vector3 } from "three"
import * as THREE from "three"
import {
  CheckCircle2,
  Mail,
  MessageCircle,
  Minus,
  Plus,
  Send,
  Upload,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  ColorInstructionsPanel,
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
import {
  calculate3DPrintPriceLegacy,
  type PrintPriceBreakdown,
} from "@/lib/dripforge/calculate-3d-print-price"
import {
  getLongestAxisAtScale,
  getRealDimensionsMm,
  NORMALIZED_LONGEST_AXIS_MM,
  scalePercentFromLongestAxis,
} from "@/lib/dripforge/model-scale"
import { exceedsMaxPrintVolume } from "@/lib/dripforge/print-limits"
import { PrintVolumeWarning } from "@/components/dripforge/shared/print-volume-warning"
import { useFilamentMaterials } from "@/hooks/use-filament-materials"
import { capture3dPreviewLeitbild } from "@/lib/dripforge/capture-leitbild"
import {
  isValidContactEmail,
  isValidContactPhone,
  type DruckanfrageContactMethod,
} from "@/lib/admin/druckanfrage-types"

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

export function PageIndividual3D() {
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
  const [priceBreakdown, setPriceBreakdown] = useState<PrintPriceBreakdown | null>(
    null
  )
  const [priceLoading, setPriceLoading] = useState(false)
  const [multiColorSurchargePercent, setMultiColorSurchargePercent] = useState(15)
  const [contactMethod, setContactMethod] = useState<DruckanfrageContactMethod | null>(
    null
  )
  const [customerEmail, setCustomerEmail] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)
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

  const priceBreakdownLegacy = useMemo(() => {
    if (!dimensions) return null
    return calculate3DPrintPriceLegacy(dimensions.volume, quantity, undefined, colorCount)
  }, [dimensions, quantity, colorCount])

  useEffect(() => {
    void fetch("/api/settings/print-pricing", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { multiColorSurchargePercentPerExtra?: number } | null) => {
        if (data?.multiColorSurchargePercentPerExtra != null) {
          setMultiColorSurchargePercent(data.multiColorSurchargePercentPerExtra)
        }
      })
      .catch(() => {
        /* Fallback bleibt 15 % */
      })
  }, [])

  useEffect(() => {
    if (!dimensions || dimensions.volume <= 0) {
      setPriceBreakdown(null)
      return
    }

    const controller = new AbortController()
    setPriceLoading(true)

    void fetch("/api/settings/print-pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        volumeCm3: dimensions.volume,
        quantity,
        colorCount,
      }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = (await res.json()) as {
          breakdown?: PrintPriceBreakdown
          error?: string
        }
        if (!res.ok || !data.breakdown) {
          setPriceBreakdown(priceBreakdownLegacy)
          return
        }
        setPriceBreakdown(data.breakdown)
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return
        setPriceBreakdown(priceBreakdownLegacy)
      })
      .finally(() => {
        if (!controller.signal.aborted) setPriceLoading(false)
      })

    return () => controller.abort()
  }, [dimensions, quantity, colorCount, priceBreakdownLegacy])

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

  const resolveInquiryValidationError = (): string | null => {
    if (!uploadedFile) {
      return "Bitte laden Sie eine 3D-Modell-Datei hoch (STL, OBJ, GLB, GLTF oder 3MF)."
    }
    if (loadError) return loadError
    if (!hasModel) {
      return "Das Modell konnte nicht geladen werden. Bitte versuchen Sie eine andere Datei."
    }
    if (!dimensions) {
      return "Modellabmessungen werden noch berechnet — bitte kurz warten."
    }
    if (isOversized) {
      return "Das Modell ueberschreitet den maximalen Druckbereich. Bitte verkleinern Sie die Skalierung."
    }
    if (priceLoading || !priceBreakdown) {
      return "Der Richtpreis wird noch berechnet — bitte kurz warten."
    }
    if (!multiColorSelection) {
      return "Bitte waehlen Sie Material und mindestens eine Farbe."
    }
    if (colorCount < 1) {
      return "Bitte waehlen Sie mindestens eine Farbe."
    }
    if (!allColorsInStock) {
      return "Mindestens eine gewaehlte Farbe ist nicht auf Lager."
    }
    if (!contactMethod) {
      return "Bitte waehlen Sie einen Kontaktkanal (E-Mail oder WhatsApp)."
    }
    return null
  }

  const handleSubmitInquiry = async () => {
    const validationError = resolveInquiryValidationError()
    if (validationError) {
      setSubmitError(validationError)
      setSubmitSuccess(null)
      return
    }

    const resolvedSelection = multiColorSelection
    const resolvedBreakdown = priceBreakdown
    const resolvedDimensions = dimensions
    if (!resolvedSelection || !resolvedBreakdown || !resolvedDimensions || !uploadedFile) {
      setSubmitError("Bitte vervollstaendigen Sie alle Angaben.")
      return
    }

    if (contactMethod === "email" && !isValidContactEmail(customerEmail)) {
      setSubmitError("Bitte geben Sie eine gueltige E-Mail-Adresse an.")
      return
    }

    if (contactMethod === "whatsapp" && !isValidContactPhone(customerPhone)) {
      setSubmitError("Bitte geben Sie eine gueltige Telefonnummer fuer WhatsApp an.")
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(null)

    try {
      const colorSummary = resolvedSelection.colors
        .sort((a, b) => a.slot - b.slot)
        .map((c) => `Farbe ${c.slot}: ${c.colorName}`)

      let leitbildFile: File | null = null
      try {
        const leitbildUrl = await capture3dPreviewLeitbild(previewCanvasRef.current)
        if (leitbildUrl) {
          const response = await fetch(leitbildUrl)
          const blob = await response.blob()
          leitbildFile = new File([blob], "leitbild.png", {
            type: blob.type || "image/png",
          })
        }
      } catch {
        console.warn("Leitbild: 3D-Snapshot konnte nicht erstellt werden.")
      }

      const formData = new FormData()
      formData.append("modelFile", uploadedFile)
      if (leitbildFile) formData.append("leitbild", leitbildFile)
      if (colorReferenceImageFile) {
        formData.append("colorReferenceImage", colorReferenceImageFile)
      }
      formData.append(
        "metadata",
        JSON.stringify({
          contactMethod,
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim(),
          quantity,
          scalePercent: scale,
          dimensionsMm: {
            x: resolvedDimensions.x,
            y: resolvedDimensions.y,
            z: resolvedDimensions.z,
          },
          volumeCm3: resolvedBreakdown.volumeCm3,
          filamentMaterial: resolvedSelection.materialName,
          filamentColors: colorSummary,
          colorWishes: colorWishes.trim() || undefined,
          hasEmbeddedModelColors: hasEmbeddedColors,
          priceBreakdown: resolvedBreakdown,
        })
      )

      const res = await fetch("/api/druckanfragen", {
        method: "POST",
        body: formData,
      })

      let data: { error?: string; message?: string } = {}
      try {
        data = (await res.json()) as { error?: string; message?: string }
      } catch {
        if (!res.ok) {
          throw new Error(
            res.status === 413
              ? "Upload zu gross (max. 50 MB)."
              : "Anfrage konnte nicht gesendet werden."
          )
        }
      }

      if (!res.ok) {
        throw new Error(data.error ?? "Anfrage konnte nicht gesendet werden.")
      }

      setSubmitSuccess(
        data.message ??
          "Ihre unverbindliche Anfrage wurde uebermittelt. Wir melden uns mit dem exakten Festpreis."
      )
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Anfrage konnte nicht gesendet werden."
      )
    } finally {
      setIsSubmitting(false)
    }
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
          steps={[
            "Datei hochladen",
            "Material waehlen",
            "Farbe & Groesse",
            "Anfrage senden",
          ]}
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
                  <h3 className="mb-4 font-bold">
                    Preisberechnung
                    {priceLoading && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        wird aktualisiert…
                      </span>
                    )}
                  </h3>
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
                      <span className="text-muted-foreground">
                        Gewicht (ca., {Math.round(priceBreakdown.infillFactor * 100)} % Infill)
                      </span>
                      <span>{Math.round(priceBreakdown.calculatedWeightG)} g</span>
                    </div>
                    {priceBreakdown.estimatedPrintTimeHours > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Druckzeit (ca.)</span>
                        <span>
                          {priceBreakdown.estimatedPrintTimeHours >= 1
                            ? `${priceBreakdown.estimatedPrintTimeHours.toFixed(1)} h`
                            : `${Math.round(priceBreakdown.estimatedPrintTimeHours * 60)} min`}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Material ({multiColorSelection?.materialName ?? "PLA"})
                      </span>
                      <span>CHF {priceBreakdown.materialCost.toFixed(2)}</span>
                    </div>
                    {priceBreakdown.machineCost > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Maschine & Strom
                        </span>
                        <span>CHF {priceBreakdown.machineCost.toFixed(2)}</span>
                      </div>
                    )}
                    {priceBreakdown.laborCost > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Vorbereitung</span>
                        <span>CHF {priceBreakdown.laborCost.toFixed(2)}</span>
                      </div>
                    )}
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
                          {multiColorSurchargePercent}% pro Extra-Farbe)
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
                    <div className="text-lg font-bold">
                      <span>
                        Voraussichtlicher Richtpreis: ab CHF{" "}
                        {priceBreakdown.totalPrice.toFixed(2)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      *Dies ist eine unverbindliche Schaetzung. Wir pruefen Ihre Datei nach
                      der Uebermittlung in unserem Slicing-System (Bambulab) und kontaktieren
                      Sie mit dem exakten Festpreis.
                    </p>
                  </div>

                  <div className="mt-6 space-y-4 rounded-xl border border-border/60 bg-background/40 p-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerEmail">
                        E-Mail{" "}
                        {contactMethod === "email" ? (
                          <span className="text-red-500">*</span>
                        ) : null}
                      </Label>
                      <Input
                        id="customerEmail"
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="ihre@email.com"
                        required={contactMethod === "email"}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="customerPhone">
                        Telefonnummer{" "}
                        {contactMethod === "whatsapp" ? (
                          <span className="text-red-500">*</span>
                        ) : null}
                      </Label>
                      <Input
                        id="customerPhone"
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="+41 79 000 00 00"
                        required={contactMethod === "whatsapp"}
                      />
                    </div>

                    <fieldset className="space-y-3">
                      <legend className="text-sm font-medium">
                        Wie moechten Sie kontaktiert werden?{" "}
                        <span className="text-red-500">*</span>
                      </legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
                          <input
                            type="radio"
                            name="contactMethod"
                            value="email"
                            checked={contactMethod === "email"}
                            onChange={() => setContactMethod("email")}
                            className="h-4 w-4 accent-primary"
                          />
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          Per E-Mail
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
                          <input
                            type="radio"
                            name="contactMethod"
                            value="whatsapp"
                            checked={contactMethod === "whatsapp"}
                            onChange={() => setContactMethod("whatsapp")}
                            className="h-4 w-4 accent-primary"
                          />
                          <MessageCircle className="h-4 w-4 text-muted-foreground" />
                          Per WhatsApp
                        </label>
                      </div>
                    </fieldset>
                  </div>

                  {submitError ? (
                    <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
                      {submitError}
                    </p>
                  ) : null}

                  {submitSuccess ? (
                    <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                      {submitSuccess}
                    </p>
                  ) : null}

                  <Button
                    onClick={() => void handleSubmitInquiry()}
                    disabled={isSubmitting || Boolean(submitSuccess)}
                    className="mt-6 w-full bg-primary hover:bg-primary/90"
                    size="lg"
                  >
                    {isSubmitting ? (
                      "Anfrage wird gesendet…"
                    ) : (
                      <>
                        <Send className="mr-2 h-5 w-5" />
                        Unverbindliche Anfrage senden
                      </>
                    )}
                  </Button>
                  {isOversized && (
                    <p className="mt-3 text-center text-sm font-medium text-red-500">
                      Anfrage gesperrt: Modell ueberschreitet den maximalen Druckbereich.
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
