"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import {
  Printer,
  Zap,
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Tag,
  Minus,
  Plus,
  ShoppingCart,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  FilamentColorPicker,
  type FilamentSelection,
} from "@/components/dripforge/shared/filament-color-picker"
import {
  createDefaultLaserDesignerState,
  LaserDesignerStudio,
  type LaserDesignerState,
} from "@/components/dripforge/shared/laser-designer-studio"
import { materials3D, products as staticProducts } from "@/lib/dripforge/data"
import { getLaserMaterialForProduct } from "@/lib/dripforge/laser"
import { resolveProductVarianten } from "@/lib/dripforge/product-varianten"
import { resolveProductModelUrl } from "@/lib/dripforge/product-model-defaults"
import { resolveProductImages } from "@/lib/dripforge/product-images-defaults"
import {
  formatProductDimensionsText,
  formatProductVolume,
  formatProductWeight,
  productDimensionsToViewerMm,
} from "@/lib/dripforge/product-dimensions"
import { ProductImageGallery } from "@/components/dripforge/shared/product-image-gallery"
import { ProductShopPrice } from "@/components/dripforge/shared/product-shop-price"
import type { CartItem, Product, ProductDimensionsMm } from "@/lib/dripforge/types"
import type { ServiceVisibilitySettings } from "@/lib/admin/types"
import { getSaleBadgePercent } from "@/lib/dripforge/product-sale"
import { normalizeShopProduct } from "@/lib/dripforge/normalize-shop-product"
import { ProductDetailErrorBoundary } from "@/components/dripforge/product-detail-error-boundary"
import {
  capture3dPreviewLeitbild,
  captureLaserPreviewLeitbild,
} from "@/lib/dripforge/capture-leitbild"

const Product3DPreview = dynamic(
  () =>
    import("@/components/dripforge/shared/product-3d-preview").then(
      (m) => m.Product3DPreview
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-border/50 bg-secondary/40 text-sm text-muted-foreground">
        3D-Vorschau wird geladen…
      </div>
    ),
  }
)

type PageShopProps = {
  shopFilter: string
  setShopFilter: (f: string) => void
  setCurrentView: (view: string) => void
  selectedProduct: Product | null
  setSelectedProduct: (product: Product | null) => void
  addToCart: (item: CartItem) => void
  services: ServiceVisibilitySettings
}

export function PageShop({
  shopFilter,
  setShopFilter,
  setCurrentView,
  selectedProduct,
  setSelectedProduct,
  addToCart,
  services,
}: PageShopProps) {
  const showCustom3d = services.druck3d
  const showCustomLaser = services.lasergravur
  const [filamentTab, setFilamentTab] = useState("pla")
  const [filamentSelection, setFilamentSelection] = useState<FilamentSelection | null>(null)
  const [laserDesign, setLaserDesign] = useState<LaserDesignerState | null>(null)
  const [quantity, setQuantity] = useState(1)
  const product3dCanvasRef = useRef<HTMLCanvasElement>(null)
  const laserPreviewRef = useRef<HTMLDivElement>(null)
  const [shopProducts, setShopProducts] = useState<Product[]>(staticProducts)

  useEffect(() => {
    void fetch("/api/products", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.products)) {
          setShopProducts(data.products.map((p: Product) => normalizeShopProduct(p)))
        }
      })
      .catch(() => {
        console.warn("Shop: Produkte aus Admin konnten nicht geladen werden.")
      })
  }, [])

  const filteredProducts =
    shopFilter === "all"
      ? shopProducts
      : shopFilter === "sale"
        ? shopProducts.filter((p) => p.sale)
        : shopFilter === "custom"
          ? []
          : shopProducts.filter((p) => p.type === shopFilter)

  const applySelectedProduct = (product: Product) => {
    const normalized = normalizeShopProduct(product)
    setSelectedProduct(normalized)
    setQuantity(1)
    setFilamentTab("pla")
    setFilamentSelection(null)
    if (normalized.type === "laser") {
      const mat = getLaserMaterialForProduct(normalized)
      setLaserDesign(
        createDefaultLaserDesignerState(mat, resolveProductVarianten(normalized))
      )
    } else {
      setLaserDesign(null)
    }
  }

  const openProduct = (product: Product) => {
    applySelectedProduct(product)
    void fetch(`/api/products/${encodeURIComponent(product.id)}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.product) applySelectedProduct(data.product as Product)
      })
      .catch(() => {
        console.warn("Shop: Einzelprodukt konnte nicht nachgeladen werden.")
      })
  }

  const handleAddToCart = async () => {
    if (!selectedProduct) return

    if (selectedProduct.type === "3d") {
      if (!filamentSelection?.inStock) return

      let leitbild: string | undefined
      try {
        const leitbildUrl = await capture3dPreviewLeitbild(product3dCanvasRef.current)
        leitbild = leitbildUrl ?? undefined
      } catch {
        console.warn("Leitbild: Shop-3D-Snapshot konnte nicht erstellt werden.")
      }

      addToCart({
        id: `${selectedProduct.id}-${Date.now()}`,
        name: selectedProduct.name,
        price: selectedProduct.price,
        quantity,
        type: "3d",
        leitbild,
        customDetails: {
          filament: filamentSelection.materialName,
          color: filamentSelection.colorName,
          dimensions: selectedProduct.dimensionsMm
            ? formatProductDimensionsText(selectedProduct.dimensionsMm)
            : undefined,
        },
      })
    } else {
      if (!laserDesign) return
      const { selectedVariant, selectedFont, engravingText, textLayout, imageLayout } =
        laserDesign
      const productVarianten = resolveProductVarianten(selectedProduct)
      const needsVariant = productVarianten.length > 0
      const hasContent =
        engravingText.trim().length > 0 || Boolean(imageLayout.src)
      if (!hasContent || (needsVariant && !selectedVariant)) return

      let leitbild: string | undefined
      try {
        const leitbildUrl = await captureLaserPreviewLeitbild(laserPreviewRef.current)
        leitbild = leitbildUrl ?? undefined
      } catch {
        console.warn("Leitbild: Shop-Laser-Snapshot konnte nicht erstellt werden.")
      }

      const newItem: CartItem = {
        id: `${selectedProduct.id}-${Date.now()}`,
        name: selectedProduct.name,
        price: selectedProduct.price,
        quantity,
        type: "laser",
        leitbild,
        customDetails: {
          material: selectedProduct.name,
          variant: selectedVariant,
          userText: engravingText.trim(),
          userFont: selectedFont,
          uploadedImage: imageLayout.src,
          layoutCoordinates: {
            textPosition: {
              x: textLayout.x,
              y: textLayout.y,
              scale: textLayout.scale,
              rotation: textLayout.rotation,
            },
            imagePosition: {
              x: imageLayout.x,
              y: imageLayout.y,
              scale: imageLayout.scale,
              rotation: imageLayout.rotation,
            },
          },
          hasText: engravingText.trim().length > 0,
          hasImage: Boolean(imageLayout.src),
        },
      }

      console.log("Warenkorb-Item hinzugefuegt:", newItem)
      addToCart(newItem)
    }

    setSelectedProduct(null)
    setLaserDesign(null)
  }

  const selectedProductVarianten =
    selectedProduct?.type === "laser"
      ? resolveProductVarianten(selectedProduct)
      : []

  const canAddToCart =
    selectedProduct?.type === "3d"
      ? Boolean(filamentSelection?.inStock)
      : Boolean(
          laserDesign &&
            (selectedProductVarianten.length === 0 ||
              laserDesign.selectedVariant) &&
            (laserDesign.engravingText.trim() || laserDesign.imageLayout.src)
        )

  if (selectedProduct) {
    const detailProduct = normalizeShopProduct(selectedProduct)
    const unitPrice = Number.isFinite(detailProduct.price) ? detailProduct.price : 0
    const shopLaserMaterial =
      detailProduct.type === "laser"
        ? getLaserMaterialForProduct(detailProduct)
        : null
    const productDimensions: ProductDimensionsMm = {
      length: Number(detailProduct.dimensionsMm?.length) || 100,
      width: Number(detailProduct.dimensionsMm?.width) || 100,
      height: Number(detailProduct.dimensionsMm?.height) || 100,
    }
    const galleryImages = resolveProductImages(
      detailProduct.id,
      detailProduct.images,
      detailProduct.galerieBilder
    )

    const productModelUrl = resolveProductModelUrl(
      detailProduct.id,
      detailProduct.modelUrl,
      detailProduct.modellDateiUrl
    )

    const customizationBackgroundUrl =
      detailProduct.individualisierungsBild?.trim() || undefined

    const shopProductVarianten = resolveProductVarianten(detailProduct)

    return (
      <ProductDetailErrorBoundary onReset={() => setSelectedProduct(null)}>
      <div className="space-y-10 pb-24">
        <div className="mx-auto max-w-7xl px-4 pt-8">
          <Button
            variant="outline"
            onClick={() => setSelectedProduct(null)}
            className="mb-8"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurueck zum Shop
          </Button>

          {detailProduct.type === "laser" && shopLaserMaterial && laserDesign ? (
            <div className="space-y-6">
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 lg:gap-8">
              <div className="flex min-w-0 flex-col gap-6">
                <Card className="rounded-2xl border-border/50 bg-card/50 shadow-sm">
                  <CardContent className="p-6 sm:p-8">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">Lasergravur</Badge>
                      {detailProduct.sale && (
                        <Badge className="bg-red-500 text-white hover:bg-red-500">
                          Rabatt
                        </Badge>
                      )}
                    </div>
                    <h1 className="text-2xl font-bold sm:text-3xl">{detailProduct.name}</h1>
                    <p className="mt-3 text-muted-foreground">{detailProduct.description}</p>
                    <div className="mt-5">
                      <ProductShopPrice product={detailProduct} size="lg" />
                    </div>
                  </CardContent>
                </Card>

                <LaserDesignerStudio
                  column="settings"
                  material={shopLaserMaterial}
                  productName={detailProduct.name}
                  state={laserDesign}
                  varianten={shopProductVarianten}
                  onStateChange={(patch) =>
                    setLaserDesign((prev) => (prev ? { ...prev, ...patch } : prev))
                  }
                />
              </div>

              <div className="flex min-w-0 flex-col gap-6">
                <LaserDesignerStudio
                  column="preview"
                  material={shopLaserMaterial}
                  productName={detailProduct.name}
                  state={laserDesign}
                  customizationBackgroundUrl={customizationBackgroundUrl}
                  previewSurfaceRef={laserPreviewRef}
                  onStateChange={(patch) =>
                    setLaserDesign((prev) => (prev ? { ...prev, ...patch } : prev))
                  }
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
                        <span className="text-muted-foreground">Produkt</span>
                        <span className="max-w-[55%] text-right font-medium">
                          {detailProduct.name}
                        </span>
                      </div>
                      {laserDesign.selectedVariant && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Variante</span>
                          <span className="font-medium">{laserDesign.selectedVariant}</span>
                        </div>
                      )}
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">Stueckpreis</span>
                        <span className="font-medium">
                          CHF {unitPrice.toFixed(2)}
                        </span>
                      </div>
                      {quantity > 1 && (
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Anzahl</span>
                          <span className="font-medium">x{quantity}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="mb-3 border-t border-sky-200/80 dark:border-cyan-500/20" />
                      <div className="flex justify-between gap-3 text-lg font-bold">
                        <span>Gesamtpreis</span>
                        <span className="text-cyan-600 dark:text-cyan-400">
                          CHF {(unitPrice * quantity).toFixed(2)}
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
                        aria-label="Anzahl erhoehen"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">
                      Stueckpreis: CHF {unitPrice.toFixed(2)}
                    </p>
                  </div>

                  <div className="mt-6">
                    <Button
                      onClick={handleAddToCart}
                      disabled={!canAddToCart}
                      className="w-full bg-primary hover:bg-primary/90"
                      size="lg"
                    >
                      <ShoppingCart className="mr-2 h-5 w-5" />
                      In den Warenkorb
                    </Button>
                    {!laserDesign.engravingText.trim() &&
                      !laserDesign.imageLayout.src && (
                        <p className="mt-3 text-center text-sm text-muted-foreground">
                          Bitte Gravur-Text eingeben oder ein Logo hochladen.
                        </p>
                      )}
                  </div>
                </CardContent>
              </Card>
            </div>
            </div>
          ) : (
                <>
                  <header className="mx-auto mb-8 max-w-2xl text-center">
                    <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
                      <Badge className="border border-cyan-600/30 bg-cyan-600/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-800 shadow-sm dark:text-cyan-200">
                        3D-Druck
                      </Badge>
                      {detailProduct.sale && (
                        <Badge className="bg-red-500 text-white hover:bg-red-500">
                          Rabatt
                        </Badge>
                      )}
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 lg:text-3xl dark:text-slate-50">
                      {detailProduct.name}
                    </h1>
                    <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                      {detailProduct.description}
                    </p>
                  </header>

                  <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-2">
                    <div className="flex min-w-0 flex-col gap-6">
                      <ProductImageGallery
                        images={galleryImages}
                        alt={detailProduct.name}
                      />

                      <Product3DPreview
                        ref={product3dCanvasRef}
                        key={`${detailProduct.id}-${productModelUrl}`}
                        modelUrl={productModelUrl}
                        color={filamentSelection?.colorHex ?? "#1a1a1a"}
                        fixedDimensionsMm={productDimensionsToViewerMm(
                          productDimensions
                        )}
                      />
                    </div>

                    <div className="flex min-w-0 flex-col gap-6 lg:min-h-[640px]">
                      <FilamentColorPicker
                        materials={materials3D}
                        activeTab={filamentTab}
                        onTabChange={setFilamentTab}
                        onSelectionChange={setFilamentSelection}
                        className="mt-0 border-0 pt-0"
                      />

                      <Card className="rounded-xl border-border/50 bg-card/50 shadow-sm">
                        <CardContent className="p-6">
                          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            Feste Masse
                          </h3>
                          <dl className="divide-y divide-border/60 rounded-lg border border-border/50 bg-muted/30">
                            <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                              <dt className="text-muted-foreground">Laenge</dt>
                              <dd className="font-mono font-semibold tabular-nums">
                                {productDimensions.length.toFixed(1)} mm
                              </dd>
                            </div>
                            <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                              <dt className="text-muted-foreground">Breite</dt>
                              <dd className="font-mono font-semibold tabular-nums">
                                {productDimensions.width.toFixed(1)} mm
                              </dd>
                            </div>
                            <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                              <dt className="text-muted-foreground">Hoehe</dt>
                              <dd className="font-mono font-semibold tabular-nums">
                                {productDimensions.height.toFixed(1)} mm
                              </dd>
                            </div>
                            <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                              <dt className="text-muted-foreground">Volumen</dt>
                              <dd className="font-mono font-semibold tabular-nums">
                                {detailProduct.volumen != null
                                  ? formatProductVolume(
                                      detailProduct.volumen,
                                      detailProduct.volumenEinheit
                                    )
                                  : "—"}
                              </dd>
                            </div>
                            <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                              <dt className="text-muted-foreground">Gewicht</dt>
                              <dd className="font-mono font-semibold tabular-nums">
                                {detailProduct.gewicht != null
                                  ? formatProductWeight(detailProduct.gewicht)
                                  : "—"}
                              </dd>
                            </div>
                            <div className="flex items-center justify-between gap-4 bg-background/60 px-4 py-3 text-sm">
                              <dt className="font-medium">Gesamt</dt>
                              <dd className="font-mono text-base font-bold tabular-nums text-primary">
                                {formatProductDimensionsText(productDimensions)}
                              </dd>
                            </div>
                          </dl>
                        </CardContent>
                      </Card>

                      <p className="rounded-xl border border-border/40 bg-muted/20 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                        Falls du eine andere Groesse fuer dieses Produkt wuenschst,
                        fertigen wir dies gerne fuer dich an. Melde dich einfach kurz
                        ueber unser{" "}
                        <Link
                          href="/kontakt"
                          className="font-medium text-primary underline-offset-2 hover:underline"
                        >
                          Kontaktformular
                        </Link>{" "}
                        bei uns.
                      </p>

                      <div className="mt-auto pt-2">
                        <Card className="rounded-xl border-red-500/35 bg-gradient-to-b from-red-500/10 via-red-500/5 to-transparent shadow-sm">
                          <CardContent className="space-y-5 p-6">
                            <h3 className="font-bold">Preisberechnung</h3>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between gap-3">
                                <span className="text-muted-foreground">
                                  Stueckpreis
                                </span>
                                <span className="font-medium">
                                  CHF {unitPrice.toFixed(2)}
                                </span>
                              </div>
                              {detailProduct.sale &&
                                detailProduct.originalPrice != null && (
                                  <div className="flex justify-between gap-3">
                                    <span className="text-muted-foreground">UVP</span>
                                    <span className="text-muted-foreground line-through">
                                      CHF {detailProduct.originalPrice.toFixed(2)}
                                    </span>
                                  </div>
                                )}
                              <div className="flex justify-between gap-3">
                                <span className="text-muted-foreground">
                                  Material (
                                  {filamentSelection?.materialName ?? "PLA"})
                                </span>
                                <span className="font-medium">
                                  {filamentSelection?.colorName ?? "—"}
                                </span>
                              </div>
                              <div className="flex justify-between gap-3">
                                <span className="text-muted-foreground">Masse</span>
                                <span className="max-w-[55%] text-right font-mono text-xs font-medium leading-snug">
                                  {formatProductDimensionsText(productDimensions)}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-3 border-t border-red-500/20 pt-4">
                              <span className="text-sm font-medium">Anzahl</span>
                              <div className="flex items-center gap-3">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setQuantity(Math.max(1, quantity - 1))
                                  }
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
                                  aria-label="Anzahl erhoehen"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="border-t border-red-500/20 pt-3">
                              <div className="flex justify-between gap-3 text-lg font-bold">
                                <span>Gesamtpreis</span>
                                <span className="text-red-500 dark:text-red-400">
                                  CHF {(unitPrice * quantity).toFixed(2)}
                                </span>
                              </div>
                            </div>

                            <Button
                              onClick={handleAddToCart}
                              disabled={!canAddToCart}
                              className="w-full bg-primary hover:bg-primary/90"
                              size="lg"
                            >
                              <ShoppingCart className="mr-2 h-5 w-5" />
                              In den Warenkorb
                            </Button>
                            {filamentSelection && !filamentSelection.inStock && (
                              <p className="text-center text-sm text-red-500">
                                Gewaehlte Farbe ist derzeit nicht auf Lager.
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                </>
          )}
        </div>
      </div>
      </ProductDetailErrorBoundary>
    )
  }

  return (
    <div className="space-y-16 pb-24">
      <section className="py-16 text-center">
        <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/10 text-primary">
          <ShoppingBag className="mr-1 h-3 w-3" />
          Shop
        </Badge>
        <h1 className="text-4xl font-bold md:text-5xl">
          <span className="text-foreground">Der </span>
          <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
            DripForge
          </span>
          <span className="text-foreground"> Shop</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Durchstoebern Sie unsere Kollektion von Premium 3D-gedruckten und lasergravierten Produkten,
          oder erstellen Sie Ihr eigenes individuelles Stueck.
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-4">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold">
            <span className="text-foreground">Erschaffen Sie etwas </span>
            <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
              Einzigartiges
            </span>
          </h2>
          <p className="mt-2 text-muted-foreground">
            Laden Sie Ihr eigenes Design hoch und verwirklichen Sie Ihre Vision
          </p>
        </div>

        <div
          className={cn(
            "grid gap-6",
            showCustom3d && showCustomLaser ? "md:grid-cols-2" : "mx-auto max-w-md md:grid-cols-1"
          )}
        >
          {showCustom3d && (
          <Card className="border-border/50 bg-card/50 transition-colors hover:border-primary/50">
            <CardContent className="p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
                <Printer className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-bold">Ihr Individueller 3D-Druck</h3>
              <p className="mb-6 text-sm text-muted-foreground">
                Laden Sie Ihre STL/OBJ-Datei hoch und erhalten Sie eine sofortige Offerte.
              </p>
              <Button
                variant="link"
                onClick={() => setCurrentView("individual-3d")}
                className="h-auto p-0 text-foreground hover:text-primary"
              >
                Jetzt Erstellen
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
          )}

          {showCustomLaser && (
          <Card className="border-border/50 bg-card/50 transition-colors hover:border-cyan-500/50">
            <CardContent className="p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/20">
                <Zap className="h-6 w-6 text-cyan-400" />
              </div>
              <h3 className="mb-2 text-lg font-bold">Individuelle Laserkreation</h3>
              <p className="mb-6 text-sm text-muted-foreground">
                Laden Sie Ihr Bild oder Text hoch und wir gravieren es auf dem Material Ihrer Wahl.
              </p>
              <Button
                variant="link"
                onClick={() => setCurrentView("individual-laser")}
                className="h-auto p-0 text-foreground hover:text-primary"
              >
                Jetzt Erstellen
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4">
        <div className="mb-8 flex justify-center">
          <div className="inline-flex flex-wrap gap-2">
            {[
              { id: "all", label: "Alle Produkte" },
              { id: "sale", label: "Rabatt", icon: Tag },
              ...(showCustom3d || showCustomLaser
                ? [{ id: "custom", label: "Individuell", icon: Sparkles }]
                : []),
              ...(showCustom3d ? [{ id: "3d", label: "3D-Druck", icon: Printer }] : []),
              ...(showCustomLaser ? [{ id: "laser", label: "Laser", icon: Zap }] : []),
            ].map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setShopFilter(filter.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  shopFilter === filter.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {filter.icon && <filter.icon className="h-4 w-4" />}
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <Card className="border-border/50 bg-card/50">
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground">Keine Produkte in dieser Kategorie.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {filteredProducts.map((product) => (
              <Card
                key={product.id}
                role="button"
                tabIndex={0}
                onClick={() => openProduct(product)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    openProduct(product)
                  }
                }}
                className={cn(
                  "cursor-pointer overflow-hidden border-border/50 bg-card/50 transition-colors hover:border-primary/50 hover:shadow-md",
                  product.sale && "border-red-500/30 hover:border-red-500/60"
                )}
              >
                <div className="relative flex h-48 items-center justify-center bg-secondary/50">
                  {product.sale && getSaleBadgePercent(product) != null && (
                    <span className="absolute left-3 top-3 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                      -{getSaleBadgePercent(product)}%
                    </span>
                  )}
                  {product.type === "3d" ? (
                    <Printer className="h-16 w-16 text-primary/50" />
                  ) : (
                    <Zap className="h-16 w-16 text-cyan-400/50" />
                  )}
                </div>
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                    {product.type === "3d" ? (
                      <>
                        <Printer className="h-3 w-3" />
                        3D-Druck
                      </>
                    ) : (
                      <>
                        <Zap className="h-3 w-3" />
                        Laser
                      </>
                    )}
                  </div>
                  <h3 className="mb-1 font-bold">{product.name}</h3>
                  <p className="mb-4 line-clamp-2 text-xs text-muted-foreground">
                    {product.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <ProductShopPrice product={product} />
                    <span className="inline-flex items-center text-sm font-medium text-primary">
                      Ansehen
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
