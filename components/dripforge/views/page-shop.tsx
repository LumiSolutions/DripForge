"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import {
  Printer,
  Zap,
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Minus,
  Plus,
  ShoppingCart,
  ArrowUpDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { products as staticProducts } from "@/lib/dripforge/data"
import { useFilamentMaterials } from "@/hooks/use-filament-materials"
import { useAiPublicSettings } from "@/hooks/use-ai-public-settings"
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
import {
  buildShopFilterOptions,
  isShopFilterId,
  type ShopFilterId,
} from "@/lib/dripforge/shop-filters"
import { filterProductsByShopTags, getTagsForCategoryScope } from "@/lib/dripforge/shop-tag-filters"
import { ShopTagFilterPanel } from "@/components/dripforge/shared/shop-tag-filter-panel"
import { ShopMainFilterTabs } from "@/components/dripforge/shared/shop-main-filter-tabs"
import type { ProductTag } from "@/lib/admin/product-tags"
import { normalizeShopProduct } from "@/lib/dripforge/normalize-shop-product"
import { SHOP_ROUTES } from "@/lib/dripforge/shop-routes"
import { ProductDetailErrorBoundary } from "@/components/dripforge/product-detail-error-boundary"
import { useSiteTexts } from "@/components/dripforge/site-texts-provider"
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
  setCurrentView: (view: string) => void
  selectedProduct: Product | null
  setSelectedProduct: (product: Product | null) => void
  addToCart: (item: CartItem) => void
  services: ServiceVisibilitySettings
  /** false bis /api/settings/services geantwortet hat — Teaser-Karten optimistisch anzeigen */
  servicesLoaded?: boolean
}

type ShopSortMode = "price-asc" | "price-desc" | "newest" | "popular"

function sortShopProducts(products: Product[], sortMode: ShopSortMode): Product[] {
  const list = [...products]
  switch (sortMode) {
    case "price-asc":
      return list.sort((a, b) => a.price - b.price)
    case "price-desc":
      return list.sort((a, b) => b.price - a.price)
    case "newest":
      return list.sort((a, b) => {
        const aTime = a.createdAt ? Date.parse(a.createdAt) : 0
        const bTime = b.createdAt ? Date.parse(b.createdAt) : 0
        return bTime - aTime
      })
    case "popular":
      return list.sort((a, b) => {
        const saleDiff = Number(b.sale) - Number(a.sale)
        if (saleDiff !== 0) return saleDiff
        return a.name.localeCompare(b.name, "de")
      })
    default:
      return list
  }
}

export function PageShop({
  setCurrentView,
  selectedProduct,
  setSelectedProduct,
  addToCart,
  services,
  servicesLoaded = false,
}: PageShopProps) {
  const { t } = useSiteTexts()
  const filamentMaterials = useFilamentMaterials()

  useEffect(() => {
    if (filamentMaterials.length === 0) return
    setFilamentTab((prev) =>
      filamentMaterials.some((m) => m.id === prev) ? prev : filamentMaterials[0]!.id
    )
  }, [filamentMaterials])

  const aiPublic = useAiPublicSettings()
  const showCustom3d = servicesLoaded ? Boolean(services.druck3d) : true
  const showCustomLaser = servicesLoaded ? Boolean(services.lasergravur) : true
  const showAiKonfigurator = showCustom3d && Boolean(aiPublic?.enabled)
  const [filamentTab, setFilamentTab] = useState("pla")
  const [filamentSelection, setFilamentSelection] = useState<FilamentSelection | null>(null)
  const [laserDesign, setLaserDesign] = useState<LaserDesignerState | null>(null)
  const [quantity, setQuantity] = useState(1)
  const product3dCanvasRef = useRef<HTMLCanvasElement>(null)
  const laserPreviewRef = useRef<HTMLDivElement>(null)
  const [shopProducts, setShopProducts] = useState<Product[]>(staticProducts)
  const [productTags, setProductTags] = useState<ProductTag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [categoryFilter, setCategoryFilter] = useState<ShopFilterId>("all")
  const [sortMode, setSortMode] = useState<ShopSortMode>("newest")

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

  useEffect(() => {
    void fetch("/api/product-tags", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.tags)) {
          setProductTags(data.tags as ProductTag[])
        }
      })
      .catch(() => {
        console.warn("Shop: Produkt-Tags konnten nicht geladen werden.")
      })
  }, [])

  const mainFilterOptions = useMemo(
    () => buildShopFilterOptions(shopProducts ?? [], services),
    [shopProducts, services]
  )

  const visibleProductTags = useMemo(
    () =>
      getTagsForCategoryScope(shopProducts ?? [], productTags ?? [], categoryFilter),
    [shopProducts, productTags, categoryFilter]
  )

  useEffect(() => {
    if (isShopFilterId(categoryFilter, mainFilterOptions ?? [])) return
    setCategoryFilter("all")
    setSelectedTagIds([])
  }, [categoryFilter, mainFilterOptions])

  const displayedProducts = useMemo(() => {
    const filtered = filterProductsByShopTags(shopProducts ?? [], {
      categoryFilter,
      selectedTagIds: selectedTagIds ?? [],
    })
    return sortShopProducts(filtered, sortMode)
  }, [shopProducts, categoryFilter, selectedTagIds, sortMode])

  const handleCategoryChange = (next: ShopFilterId) => {
    setCategoryFilter(next)
    setSelectedTagIds([])
  }

  const toggleTagFilter = (tagId: string, checked: boolean) => {
    setSelectedTagIds((prev) =>
      checked ? [...new Set([...prev, tagId])] : prev.filter((id) => id !== tagId)
    )
  }

  const clearTagFilters = () => {
    setSelectedTagIds([])
  }

  const customCardCount = [showCustom3d, showCustomLaser, showAiKonfigurator].filter(
    Boolean
  ).length

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
    const initial = normalizeShopProduct(product)
    applySelectedProduct(initial)

    const fetchId = initial.id !== "unknown" ? initial.id : product.id
    if (!fetchId || fetchId === "unknown") {
      console.warn("Shop: Produkt-ID fehlt — Detail wird nur aus der Liste angezeigt.")
      return
    }

    void fetch(`/api/products/${encodeURIComponent(fetchId)}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.product) applySelectedProduct(data.product as Product)
      })
      .catch((error) => {
        console.error("Fehler beim Laden des Produkts:", error)
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

                      {productModelUrl ? (
                        <Product3DPreview
                          ref={product3dCanvasRef}
                          key={`${detailProduct.id}-${productModelUrl}`}
                          modelUrl={productModelUrl}
                          color={filamentSelection?.colorHex ?? "#1a1a1a"}
                          fixedDimensionsMm={productDimensionsToViewerMm(
                            productDimensions
                          )}
                        />
                      ) : null}
                    </div>

                    <div className="flex min-w-0 flex-col gap-6 lg:min-h-[640px]">
                      <FilamentColorPicker
                        materials={filamentMaterials}
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
                        {t("shop_delivery_notice")}{" "}
                        <Link
                          href="/kontakt"
                          className="font-medium text-primary underline-offset-2 hover:underline"
                        >
                          Kontaktformular
                        </Link>
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
          {t("shop_hero_badge")}
        </Badge>
        <h1 className="text-4xl font-bold md:text-5xl">
          <span className="text-foreground">{t("shop_hero_title_prefix")}</span>
          <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
            {t("shop_hero_title_brand")}
          </span>
          <span className="text-foreground">{t("shop_hero_title_suffix")}</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          {t("shop_hero_subtitle")}
        </p>
      </section>

      {(showCustom3d || showCustomLaser || showAiKonfigurator) && (
        <section className="relative z-10 mx-auto max-w-7xl px-4">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold md:text-3xl">
              <span className="text-foreground">Erschaffen Sie etwas </span>
              <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
                {t("shop_custom_section_title")}
              </span>
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              {t("shop_custom_section_subtitle")}
            </p>
          </div>

          <div
            className={cn(
              "mx-auto grid w-full gap-6",
              customCardCount === 1 && "max-w-md",
              customCardCount === 2 && "max-w-4xl md:grid-cols-2",
              customCardCount >= 3 && "max-w-6xl md:grid-cols-2 lg:grid-cols-3"
            )}
          >
            {showCustom3d && (
              <Link
                href={SHOP_ROUTES.konfigurator3d}
                className="relative z-10 block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Card className="h-full border-border/50 bg-card/50 transition-colors hover:border-primary/50">
                  <CardContent className="flex h-full flex-col p-8">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
                      <Printer className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mb-2 text-lg font-bold">{t("shop_custom_3d_title")}</h3>
                    <p className="mb-6 flex-1 text-sm text-muted-foreground">
                      {t("shop_custom_3d_description")}
                    </p>
                    <span className="inline-flex items-center text-sm font-medium text-foreground">
                      Jetzt Erstellen
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            )}

            {showAiKonfigurator && (
              <Link
                href={SHOP_ROUTES.aiKonfigurator}
                className="relative z-10 block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Card className="h-full border-border/50 bg-card/50 transition-colors hover:border-violet-500/50">
                  <CardContent className="flex h-full flex-col p-8">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/20">
                      <Sparkles className="h-6 w-6 text-violet-400" />
                    </div>
                    <h3 className="mb-2 text-lg font-bold">KI-Modell erstellen</h3>
                    <p className="mb-6 flex-1 text-sm text-muted-foreground">
                      Beschreibe dein Wunschmodell per Text oder Bild — unsere KI generiert
                      druckbare 3D-Geometrie nach euren technischen Vorgaben.
                    </p>
                    <span className="inline-flex items-center text-sm font-medium text-foreground">
                      KI-Konfigurator öffnen
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            )}

            {showCustomLaser && (
              <Link
                href={SHOP_ROUTES.konfiguratorLaser}
                className="relative z-10 block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Card className="h-full border-border/50 bg-card/50 transition-colors hover:border-cyan-500/50">
                  <CardContent className="flex h-full flex-col p-8">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/20">
                      <Zap className="h-6 w-6 text-cyan-400" />
                    </div>
                    <h3 className="mb-2 text-lg font-bold">{t("shop_custom_laser_title")}</h3>
                    <p className="mb-6 flex-1 text-sm text-muted-foreground">
                      {t("shop_custom_laser_description")}
                    </p>
                    <span className="inline-flex items-center text-sm font-medium text-foreground">
                      Jetzt Erstellen
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            )}
          </div>
        </section>
      )}

      <section className="relative z-0 mx-auto max-w-7xl px-4 space-y-6">
        <ShopMainFilterTabs
          options={mainFilterOptions ?? []}
          activeId={categoryFilter}
          onChange={handleCategoryChange}
        />

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <ShopTagFilterPanel
            className="w-full lg:sticky lg:top-24 lg:w-64 lg:shrink-0"
            tags={visibleProductTags ?? []}
            selectedTagIds={selectedTagIds}
            onToggleTag={toggleTagFilter}
            onClear={clearTagFilters}
          />

          <div className="min-w-0 flex-1">
            <div className="mb-6 flex flex-col gap-4 border-b border-border/50 pb-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {displayedProducts.length} Produkt{displayedProducts.length === 1 ? "" : "e"}
              </p>
              <div className="flex items-center justify-center gap-2 sm:justify-end">
                <ArrowUpDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
                <Select
                  value={sortMode}
                  onValueChange={(value) => setSortMode(value as ShopSortMode)}
                >
                  <SelectTrigger className="w-full min-w-[220px] sm:w-[240px]">
                    <SelectValue placeholder="Sortieren" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="price-asc">Preis: aufsteigend</SelectItem>
                    <SelectItem value="price-desc">Preis: absteigend</SelectItem>
                    <SelectItem value="popular">Beliebtheit</SelectItem>
                    <SelectItem value="newest">Neueste zuerst</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

        {displayedProducts.length === 0 ? (
          <Card className="border-border/50 bg-card/50">
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground">{t("shop_empty_category")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {displayedProducts.map((product) => (
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
          </div>
        </div>
      </section>
    </div>
  )
}
