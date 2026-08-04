"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { safeNavigate } from "@/lib/dripforge/safe-navigate"
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
  LayoutGrid,
  Grid2x2,
  List,
  CheckCircle2,
  Loader2,
  Palette,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  FilamentColorPicker,
  pickDefaultFilamentSelection,
  type FilamentSelection,
} from "@/components/dripforge/shared/filament-color-picker"
import {
  FilamentMultiColorPicker,
  type FilamentMultiColorSelection,
} from "@/components/dripforge/shared/filament-multi-color-picker"
import { ProductDescription } from "@/components/dripforge/product-description"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  createDefaultLaserDesignerState,
  LaserDesignerStudio,
  type LaserDesignerState,
} from "@/components/dripforge/shared/laser-designer-studio"
import { products as staticProducts } from "@/lib/dripforge/data"
import { useFilamentCatalog } from "@/hooks/use-filament-materials"
import { useAiPublicSettings } from "@/hooks/use-ai-public-settings"
import { getLaserMaterialForProduct } from "@/lib/dripforge/laser"
import { resolveProductVarianten } from "@/lib/dripforge/product-varianten"
import {
  productHasShopVariants,
  resolveProductShopVariants,
} from "@/lib/dripforge/product-shop-variants"
import {
  resolveShopVariantModelUrl,
  resolveShopVariantUnitPrice,
} from "@/lib/dripforge/types"
import {
  applyQuantityDiscountToUnitPrice,
  normalizeQuantityDiscountTiers,
} from "@/lib/dripforge/quantity-discount-tiers"
import { resolveProductModelUrl } from "@/lib/dripforge/product-model-defaults"
import { resolveProductPrintFile } from "@/lib/dripforge/product-print-file"
import {
  capture3dPreviewLeitbild,
} from "@/lib/dripforge/capture-leitbild"
import {
  buildLaserCartCustomDetails,
  laserDesignHasContent,
} from "@/lib/dripforge/build-laser-cart-details"
import { buildLaserCombinedMockup } from "@/lib/dripforge/ensure-laser-mockup"
import { ensureLaserLayers } from "@/lib/dripforge/laser-layers"
import { resolveProductImages } from "@/lib/dripforge/product-images-defaults"
import {
  formatProductDimensionsText,
  productDimensionsToViewerMm,
} from "@/lib/dripforge/product-dimensions"
import { FesteMasseCard } from "@/components/dripforge/shared/feste-masse-card"
import { ProductImageGallery } from "@/components/dripforge/shared/product-image-gallery"
import { PricingCategoriesSubtitle } from "@/components/dripforge/shared/pricing-categories-subtitle"
import {
  ShopProductCard,
  type ShopCardSurface,
} from "@/components/dripforge/shared/shop-product-card"
import type { CartItem, Product, ProductDimensionsMm } from "@/lib/dripforge/types"
import type { ServiceVisibilitySettings, ShopConfiguratorSettings } from "@/lib/admin/types"
import { DEFAULT_SHOP_CONFIGURATORS } from "@/lib/admin/types"
import {
  buildShopFilterOptions,
  isShopFilterId,
  type ShopFilterId,
} from "@/lib/dripforge/shop-filters"
import { filterProductsByShopTags, getTagsForCategoryScope } from "@/lib/dripforge/shop-tag-filters"
import { ShopTagFilterPanel } from "@/components/dripforge/shared/shop-tag-filter-panel"
import { ShopStickyFilterChrome } from "@/components/dripforge/shared/shop-sticky-filter-chrome"
import type { ProductTag } from "@/lib/admin/product-tags"
import { normalizeShopProduct } from "@/lib/dripforge/normalize-shop-product"
import { productHref } from "@/lib/dripforge/product-slug"
import { SHOP_ROUTES } from "@/lib/dripforge/shop-routes"
import { ProductDetailErrorBoundary } from "@/components/dripforge/product-detail-error-boundary"
import { HomeTopProductsSection } from "@/components/dripforge/views/home-top-products-section"
import { filterFilamentMaterialsForProduct } from "@/lib/dripforge/product-filament-materials"
import { SiteText } from "@/components/dripforge/editable-site-text"
import { SiteTextPhrase } from "@/components/dripforge/site-text-phrase"
import { useSiteTexts } from "@/components/dripforge/site-texts-provider"
import { useCustomerCategory } from "@/components/dripforge/customer-category-provider"
import { captureProductionLayerPng } from "@/lib/dripforge/capture-production-layer"
import { LoadSavedDesignButton } from "@/components/konto/load-saved-design-button"
import { hydrateLaserDesignerFromConfig } from "@/lib/konto/hydrate-laser-design"

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
  shopConfigurators?: ShopConfiguratorSettings
  /** false bis /api/settings/services geantwortet hat — Teaser-Karten optimistisch anzeigen */
  servicesLoaded?: boolean
  /** true = dedizierte /produkt/[slug]-Seite (kein Listing) */
  productDetailMode?: boolean
  /** Katalog für kollisionssichere Slugs */
  productCatalog?: Product[]
}

type ShopSortMode = "price-asc" | "price-desc" | "newest" | "popular"
/** grid3 = grosse Karten (1 / 2 / 3 Spalten), grid5 = kompakt (2 / 3 / 5), list = Liste */
type ShopViewMode = "grid3" | "grid5" | "list"

function normalizeShopViewMode(raw: string | null): ShopViewMode {
  if (raw === "grid3" || raw === "grid-lg") return "grid3"
  if (raw === "grid5" || raw === "grid-sm") return "grid5"
  if (raw === "list") return "list"
  return "grid3"
}

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

/** Shop-Übersicht: initial gerenderte Produktanzahl (Rest via «Mehr laden»). */
const SHOP_INITIAL_VISIBLE = 12
/** Anzahl weiterer Produkte pro «Mehr laden»-Klick. */
const SHOP_LOAD_MORE_STEP = 12

export function PageShop({
  setCurrentView,
  selectedProduct,
  setSelectedProduct,
  addToCart,
  services,
  shopConfigurators = DEFAULT_SHOP_CONFIGURATORS,
  servicesLoaded = false,
  productDetailMode = false,
  productCatalog,
}: PageShopProps) {
  const router = useRouter()
  const { canInlineEdit } = useSiteTexts()
  // Lazy-Load: Filamentfarben nur auf der Produktdetailseite abrufen, nicht auf
  // der Shop-Übersicht (Performance beim Initial-Load).
  const { materials: filamentMaterialsAll, loading: filamentsLoading } =
    useFilamentCatalog({ enabled: productDetailMode || Boolean(selectedProduct) })
  // Kundenkategorie-Rabatt (eingeloggter Kunde) für die Detail-Preisanzeige.
  const customerCategory = useCustomerCategory()

  const filamentMaterials = useMemo(
    () =>
      filterFilamentMaterialsForProduct(
        filamentMaterialsAll,
        selectedProduct?.allowedFilamentMaterialTypeIds
      ),
    [filamentMaterialsAll, selectedProduct?.allowedFilamentMaterialTypeIds]
  )

  const aiPublic = useAiPublicSettings()
  const showCustom3d = servicesLoaded ? Boolean(shopConfigurators.custom3d) : true
  const showCustomLaser = servicesLoaded ? Boolean(shopConfigurators.customLaser) : true
  const showAiKonfigurator = showCustom3d && Boolean(aiPublic?.enabled)
  const [filamentTab, setFilamentTab] = useState("pla")
  const [filamentSelection, setFilamentSelection] = useState<FilamentSelection | null>(null)

  useEffect(() => {
    if (filamentMaterials.length === 0) return
    const firstId = filamentMaterials[0]?.id
    if (!firstId) return
    setFilamentTab((prev) =>
      filamentMaterials.some((m) => m.id === prev) ? prev : firstId
    )
  }, [filamentMaterials])
  const [multiColorSelection, setMultiColorSelection] =
    useState<FilamentMultiColorSelection | null>(null)
  const [customerRemarks, setCustomerRemarks] = useState("")
  const [extraVariants, setExtraVariants] = useState<
    Array<{ colorName: string; colorHex: string; filament: string; quantity: number }>
  >([])
  /**
   * Nach «Variante hinzufügen» ist die aktuelle Farbe bereits in der Liste —
   * nicht nochmals zur Mengenrabatt-Stückzahl zählen (Off-by-one).
   */
  const [activeVariantCommitted, setActiveVariantCommitted] = useState(false)
  /** Mehrteilig: Detail-Farbauswahl erst bei «Andere Farben». */
  const [multiColorMode, setMultiColorMode] = useState<"standard" | "custom">(
    "standard"
  )
  const [selectedShopVariantId, setSelectedShopVariantId] = useState<string | null>(
    null
  )
  const [laserDesign, setLaserDesign] = useState<LaserDesignerState | null>(null)
  const laserDesignRef = useRef<LaserDesignerState | null>(null)
  laserDesignRef.current = laserDesign
  const [quantity, setQuantity] = useState(1)
  const [cartAddedOpen, setCartAddedOpen] = useState(false)
  const [cartCapturing, setCartCapturing] = useState(false)
  const product3dCanvasRef = useRef<HTMLCanvasElement>(null)
  const laserPreviewRef = useRef<HTMLDivElement>(null)
  /** Ein Viewer-Mount (Ref) — Mobile vs. Desktop-Platzierung */
  const [isMdUp, setIsMdUp] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const sync = () => setIsMdUp(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])
  const [shopProducts, setShopProducts] = useState<Product[]>(staticProducts)
  const [productTags, setProductTags] = useState<ProductTag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [categoryFilter, setCategoryFilter] = useState<ShopFilterId>("all")
  const [sortMode, setSortMode] = useState<ShopSortMode>("newest")
  // Performance: initial nur eine Seite rendern, Rest per «Mehr laden».
  const [visibleCount, setVisibleCount] = useState(SHOP_INITIAL_VISIBLE)
  const [viewMode, setViewMode] = useState<ShopViewMode>("grid3")
  const [cardSurface, setCardSurface] = useState<ShopCardSurface>("brand")

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("df-shop-view-mode")
      setViewMode(normalizeShopViewMode(stored))
      const surface = window.localStorage.getItem("df-shop-card-surface")
      if (surface === "brand" || surface === "neutral") setCardSurface(surface)
    } catch {
      /* ignore */
    }
  }, [])

  const setViewModePersist = (mode: ShopViewMode) => {
    setViewMode(mode)
    try {
      window.localStorage.setItem("df-shop-view-mode", mode)
    } catch {
      /* ignore */
    }
  }

  const setCardSurfacePersist = (surface: ShopCardSurface) => {
    setCardSurface(surface)
    try {
      window.localStorage.setItem("df-shop-card-surface", surface)
    } catch {
      /* ignore */
    }
  }

  // Listen-Icon ist auf Mobile ausgeblendet → Fallback auf Einzelansicht
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const coerce = () => {
      if (mq.matches) {
        setViewMode((prev) => (prev === "list" ? "grid3" : prev))
      }
    }
    coerce()
    mq.addEventListener("change", coerce)
    return () => mq.removeEventListener("change", coerce)
  }, [])

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

  // Bei Filter-/Sortierwechsel wieder auf die erste Seite zurücksetzen.
  useEffect(() => {
    setVisibleCount(SHOP_INITIAL_VISIBLE)
  }, [categoryFilter, selectedTagIds, sortMode])

  const visibleProducts = useMemo(
    () => displayedProducts.slice(0, visibleCount),
    [displayedProducts, visibleCount]
  )
  const hasMoreProducts = displayedProducts.length > visibleProducts.length

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

  // Produktseite / Deep-Link: Laser-/Filament-State beim Produktwechsel initialisieren
  useEffect(() => {
    if (!selectedProduct) {
      setLaserDesign(null)
      return
    }
    const normalized = normalizeShopProduct(selectedProduct)
    setQuantity(1)
    setCustomerRemarks("")
    setExtraVariants([])
    setActiveVariantCommitted(false)
    setMultiColorMode("standard")
    setMultiColorSelection(null)
    const preferred = pickDefaultFilamentSelection(filamentMaterials, {
      colorId: normalized.defaultFilamentColorId,
      colorName: normalized.defaultFilamentColorName,
    })
    setFilamentTab(preferred?.materialId ?? filamentMaterials[0]?.id ?? "pla")
    setFilamentSelection(preferred)
    const shopVariants = resolveProductShopVariants(normalized)
    setSelectedShopVariantId(shopVariants[0]?.id ?? null)
    if (normalized.type === "laser") {
      const mat = getLaserMaterialForProduct(normalized)
      setLaserDesign(
        createDefaultLaserDesignerState(mat, resolveProductVarianten(normalized))
      )
    } else {
      setLaserDesign(null)
    }
    // Nur bei Produkt-ID-Wechsel neu initialisieren
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct?.id])

  // Default-Filamentfarbe nachladen, sobald Katalog verfügbar ist
  useEffect(() => {
    if (!selectedProduct || filamentMaterials.length === 0) return
    if (selectedProduct.type !== "3d") return
    if (filamentSelection) return
    const preferred = pickDefaultFilamentSelection(filamentMaterials, {
      colorId: selectedProduct.defaultFilamentColorId,
      colorName: selectedProduct.defaultFilamentColorName,
    })
    if (preferred) {
      setFilamentTab(preferred.materialId)
      setFilamentSelection(preferred)
    }
  }, [filamentMaterials, selectedProduct, filamentSelection])

  const openProduct = (product: Product) => {
    if (canInlineEdit) return
    const initial = normalizeShopProduct(product)
    const catalog = productCatalog?.length ? productCatalog : shopProducts
    safeNavigate(productHref(initial, catalog), {
      routerPush: (to) => router.push(to),
    })
  }

  const closeProduct = () => {
    setSelectedProduct(null)
    if (productDetailMode) {
      safeNavigate("/shop", {
        routerPush: (to) => router.push(to),
      })
    }
  }

  const effectiveFilamentSelection =
    filamentSelection ?? pickDefaultFilamentSelection(filamentMaterials, {
      colorId: selectedProduct?.defaultFilamentColorId,
      colorName: selectedProduct?.defaultFilamentColorName,
    })

  const isMultiColorProduct = (product: Product) =>
    Boolean(product.multiColorEnabled) ||
    (product.partLabels?.length ?? 0) > 1

  const handleAddToCart = async () => {
    if (!selectedProduct || cartCapturing) return

    const dimensionsText = selectedProduct.dimensionsMm
      ? formatProductDimensionsText(selectedProduct.dimensionsMm)
      : undefined
    const weightG =
      selectedProduct.gewicht != null && Number.isFinite(Number(selectedProduct.gewicht))
        ? Number(selectedProduct.gewicht)
        : undefined
    const remarksTrimmed = customerRemarks.trim()

    if (selectedProduct.type === "3d") {
      const useMultiColor =
        isMultiColorProduct(selectedProduct) && multiColorMode === "custom"
      if (useMultiColor) {
        if (!multiColorSelection?.colors.length) return
        if (!multiColorSelection.colors.every((c) => c.inStock)) return
      } else {
        const selection = effectiveFilamentSelection
        if (!selection?.inStock) return
      }
      const shopVariants = resolveProductShopVariants(selectedProduct)
      if (shopVariants.length > 0 && !selectedShopVariantId) return
      const activeShopVariant = shopVariants.find((v) => v.id === selectedShopVariantId)
      const baseUnitPrice = resolveShopVariantUnitPrice(
        selectedProduct,
        selectedShopVariantId
      )
      const quantityDiscountTiers = normalizeQuantityDiscountTiers(
        selectedProduct.quantityDiscountTiers
      )
      const variantModelUrl = resolveShopVariantModelUrl(
        selectedProduct,
        selectedShopVariantId
      )

      setCartCapturing(true)
      try {
        let leitbild: string | undefined
        try {
          const leitbildUrl = await capture3dPreviewLeitbild(product3dCanvasRef.current)
          leitbild = leitbildUrl ?? undefined
        } catch {
          console.warn("Leitbild: Shop-3D-Snapshot konnte nicht erstellt werden.")
        }

        const printFile = resolveProductPrintFile(selectedProduct)
        const modelForCart = variantModelUrl || printFile?.fileUrl || undefined
        const fileFields =
          printFile || modelForCart
            ? {
                fileName: printFile?.fileName,
                fileUrl: modelForCart ?? printFile?.fileUrl,
                modelUrl: modelForCart ?? printFile?.fileUrl,
              }
            : {}
        const tierFields =
          quantityDiscountTiers.length > 0
            ? { quantityDiscountTiers, baseUnitPrice }
            : { baseUnitPrice }

        if (useMultiColor && multiColorSelection) {
          const primary =
            multiColorSelection.colors.find(
              (c) => c.slot === multiColorSelection.primarySlot
            ) ?? multiColorSelection.colors[0]
          if (!primary) return
          const labels = selectedProduct.partLabels ?? []
          const partColors = multiColorSelection.colors
            .slice()
            .sort((a, b) => a.slot - b.slot)
            .map((slot, index) => ({
              partId: `part-${slot.slot}`,
              partName: labels[index] ?? `Teil ${slot.slot}`,
              colorName: slot.colorName,
              colorHex: slot.colorHex,
              filament: multiColorSelection.materialName,
            }))

          addToCart({
            id: `${selectedProduct.id}-${Date.now()}`,
            productId: selectedProduct.id,
            name: selectedProduct.name,
            price: baseUnitPrice,
            quantity,
            type: "3d",
            leitbild,
            ...tierFields,
            customDetails: {
              filament: multiColorSelection.materialName,
              color: primary.colorName,
              variant: activeShopVariant?.name,
              dimensions: dimensionsText,
              weightG,
              ...(remarksTrimmed ? { customerRemarks: remarksTrimmed } : {}),
              partColors,
              ...fileFields,
            },
          })
        } else {
          const selection = effectiveFilamentSelection
          if (!selection) return
          // Aktive Farbe nur hinzufügen, wenn sie noch nicht als Variante committed ist
          if (!activeVariantCommitted || extraVariants.length === 0) {
            addToCart({
              id: `${selectedProduct.id}-${Date.now()}`,
              productId: selectedProduct.id,
              name: selectedProduct.name,
              price: baseUnitPrice,
              quantity,
              type: "3d",
              leitbild,
              ...tierFields,
              customDetails: {
                filament: selection.materialName,
                color: selection.colorName,
                variant: activeShopVariant?.name,
                dimensions: dimensionsText,
                weightG,
                ...(remarksTrimmed ? { customerRemarks: remarksTrimmed } : {}),
                ...fileFields,
              },
            })
          }

          for (const extra of extraVariants) {
            addToCart({
              id: `${selectedProduct.id}-${Date.now()}-${extra.colorName}`,
              productId: selectedProduct.id,
              name: selectedProduct.name,
              price: baseUnitPrice,
              quantity: Math.max(1, extra.quantity),
              type: "3d",
              leitbild,
              ...tierFields,
              customDetails: {
                filament: extra.filament || selection.materialName,
                color: extra.colorName,
                variant: activeShopVariant?.name,
                dimensions: dimensionsText,
                weightG,
                ...(remarksTrimmed ? { customerRemarks: remarksTrimmed } : {}),
                ...fileFields,
              },
            })
          }
          setExtraVariants([])
          setActiveVariantCommitted(false)
        }
        setCartAddedOpen(true)
      } finally {
        setCartCapturing(false)
      }
      return
    }

    const designSnapshot = laserDesignRef.current
    if (!designSnapshot) return
    const productVarianten = resolveProductVarianten(selectedProduct)
    const needsVariant = productVarianten.length > 0
    const { selectedVariant } = designSnapshot
    const shopVariants = resolveProductShopVariants(selectedProduct)
    if (
      !laserDesignHasContent(designSnapshot) ||
      (needsVariant && !selectedVariant) ||
      (shopVariants.length > 0 && !selectedShopVariantId)
    )
      return
    const activeShopVariant = shopVariants.find((v) => v.id === selectedShopVariantId)
    const laserUnitPrice = resolveShopVariantUnitPrice(
      selectedProduct,
      selectedShopVariantId
    )

    setCartCapturing(true)
    // Auswahl-Chrome ausblenden — Snapshot der Layer bleibt unverändert
    setLaserDesign((prev) =>
      prev ? { ...prev, activeLayerId: null } : prev
    )

    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )

      const layers = ensureLaserLayers(designSnapshot)
      let previewMockup: string | undefined
      let productionLayer: string | undefined
      try {
        const bgUrl =
          selectedProduct.individualisierungsBild?.trim() ||
          resolveProductImages(
            selectedProduct.id,
            selectedProduct.images,
            selectedProduct.galerieBilder
          )[0] ||
          null
        previewMockup = await buildLaserCombinedMockup({
          layers,
          backgroundUrl: bgUrl,
          previewRoot: laserPreviewRef.current,
        })
      } catch {
        console.warn("Mockup: Shop-Laser-Snapshot konnte nicht erstellt werden.")
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
        console.warn("Produktions-Layer: Shop-Export fehlgeschlagen.")
      }

      const laserTiers = normalizeQuantityDiscountTiers(
        selectedProduct.quantityDiscountTiers
      )
      const newItem: CartItem = {
        id: `${selectedProduct.id}-${Date.now()}`,
        productId: selectedProduct.id,
        name: selectedProduct.name,
        price: laserUnitPrice,
        baseUnitPrice: laserUnitPrice,
        ...(laserTiers.length > 0
          ? { quantityDiscountTiers: laserTiers }
          : {}),
        quantity,
        type: "laser",
        leitbild: previewMockup,
        previewMockup,
        productionLayer,
        customDetails: {
          ...buildLaserCartCustomDetails(designSnapshot, {
            material: selectedProduct.name,
            variant: activeShopVariant?.name || selectedVariant,
            productBackgroundUrl:
              selectedProduct.individualisierungsBild?.trim() ||
              resolveProductImages(
                selectedProduct.id,
                selectedProduct.images,
                selectedProduct.galerieBilder
              )[0] ||
              null,
          }),
          dimensions: dimensionsText,
          weightG,
          ...(remarksTrimmed ? { customerRemarks: remarksTrimmed } : {}),
        },
      }

      addToCart(newItem)
      setCartAddedOpen(true)
    } finally {
      setCartCapturing(false)
    }
  }

  const selectedProductVarianten =
    selectedProduct?.type === "laser"
      ? resolveProductVarianten(selectedProduct)
      : []

  const canAddToCart =
    !cartCapturing &&
    Boolean(selectedProduct) &&
    (selectedProduct?.type === "3d"
      ? !filamentsLoading &&
        (isMultiColorProduct(selectedProduct) && multiColorMode === "custom"
          ? Boolean(multiColorSelection?.colors.length) &&
            Boolean(multiColorSelection?.colors.every((c) => c.inStock))
          : Boolean(effectiveFilamentSelection?.inStock)) &&
        (!productHasShopVariants(selectedProduct) || Boolean(selectedShopVariantId))
      : Boolean(
          selectedProduct &&
            laserDesign &&
            (selectedProductVarianten.length === 0 ||
              laserDesign.selectedVariant) &&
            (!productHasShopVariants(selectedProduct) ||
              Boolean(selectedShopVariantId)) &&
            (laserDesign.engravingText.trim() ||
              laserDesign.imageLayout.src ||
              laserDesignHasContent(laserDesign))
        ))

  if (selectedProduct) {
    const detailProduct = normalizeShopProduct(selectedProduct)
    const detailShopVariants = resolveProductShopVariants(detailProduct)
    const baseUnitPrice = resolveShopVariantUnitPrice(
      detailProduct,
      selectedShopVariantId
    )
    const quantityDiscountTiers = normalizeQuantityDiscountTiers(
      detailProduct.quantityDiscountTiers
    )
    const showMultiColorPicker =
      isMultiColorProduct(detailProduct) && multiColorMode === "custom"
    const extraVariantQty = showMultiColorPicker
      ? 0
      : extraVariants.reduce((sum, e) => sum + e.quantity, 0)
    const activeQtyForPricing =
      !showMultiColorPicker && activeVariantCommitted && extraVariants.length > 0
        ? 0
        : quantity
    const pricingQty = activeQtyForPricing + extraVariantQty
    const qtyDiscount = applyQuantityDiscountToUnitPrice(
      baseUnitPrice,
      quantityDiscountTiers,
      pricingQty
    )
    // Kundenkategorie-Rabatt zusätzlich auf den (mengenrabattierten) Anzeigepreis.
    // Der Warenkorb speichert weiterhin den Basispreis; der Rabatt wird
    // serverseitig verbindlich angewendet (processOrderPayload).
    const unitPrice = customerCategory.applyDiscount(qtyDiscount.unitPrice)
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

    // Nur gültige GLB/GLTF/STL-URLs an den Viewer — sonst Galerie ohne Crash.
    const productModelUrl =
      resolveShopVariantModelUrl(detailProduct, selectedShopVariantId) ||
      resolveProductModelUrl(
        detailProduct.id,
        detailProduct.modelUrl,
        detailProduct.modellDateiUrl
      ) ||
      undefined

    const shopVariantPicker =
      detailShopVariants.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Variante</p>
          <div className="flex flex-wrap gap-2">
            {detailShopVariants.map((variant) => {
              const active = selectedShopVariantId === variant.id
              const priceLabel = resolveShopVariantUnitPrice(
                detailProduct,
                variant.id
              )
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => setSelectedShopVariantId(variant.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "border-primary bg-primary/10 font-semibold text-foreground"
                      : "border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {variant.name}
                  <span className="ml-1.5 tabular-nums text-xs opacity-80">
                    CHF {priceLabel.toFixed(2)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null

    const customizationBackgroundUrl =
      detailProduct.individualisierungsBild?.trim() || undefined

    const shopProductVarianten = resolveProductVarianten(detailProduct)

    return (
      <>
      <ProductDetailErrorBoundary onReset={closeProduct}>
      <div className="space-y-10 pb-12 md:pb-24">
        <Dialog open={cartAddedOpen} onOpenChange={setCartAddedOpen}>
          <DialogContent className="z-[200] max-w-md border-border/60 sm:rounded-2xl">
            <DialogHeader className="items-center text-center sm:text-center">
              <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <DialogTitle className="text-xl sm:text-2xl">
                Erfolgreich zum Warenkorb hinzugefügt!
              </DialogTitle>
              <DialogDescription>
                Dein Design bleibt geöffnet — du kannst weiter anpassen oder
                zum Warenkorb wechseln.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col gap-2 sm:flex-col">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setCartAddedOpen(false)}
              >
                Weiter einkaufen / Anpassen
              </Button>
              <Button
                type="button"
                className="w-full bg-primary hover:bg-primary/90"
                onClick={() => {
                  setCartAddedOpen(false)
                  safeNavigate(SHOP_ROUTES.warenkorb, {
                    routerPush: (to) => router.push(to),
                  })
                }}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                Zum Warenkorb
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setCartAddedOpen(false)
                  safeNavigate(SHOP_ROUTES.checkout, {
                    routerPush: (to) => router.push(to),
                  })
                }}
              >
                Zur Kasse
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <div className="mx-auto max-w-7xl px-2 pt-8 sm:px-4">
          <Button
            variant="outline"
            onClick={closeProduct}
            className="mb-8"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurueck zum Shop
          </Button>

          {detailProduct.type === "laser" && shopLaserMaterial && laserDesign ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12 xl:gap-6">
                {/* Spalte 1: Galerie / Text / Settings */}
                <div className="order-1 flex min-w-0 max-w-full flex-col gap-4 xl:col-span-3">
                  <ProductImageGallery
                    images={galleryImages}
                    alt={detailProduct.name}
                  />
                  <Card className="rounded-2xl border-border/50 bg-card/50 shadow-sm">
                    <CardContent className="p-4 sm:p-5">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">Lasergravur</Badge>
                        {detailProduct.sale && (
                          <Badge className="bg-red-500 text-white hover:bg-red-500">
                            Rabatt
                          </Badge>
                        )}
                      </div>
                      <h1 className="text-xl font-bold sm:text-2xl">
                        {detailProduct.name}
                      </h1>
                      <ProductDescription
                        html={detailProduct.description}
                        className="mt-2"
                      />
                    </CardContent>
                  </Card>
                  <LaserDesignerStudio
                    column="settings"
                    material={shopLaserMaterial}
                    productName={detailProduct.name}
                    state={laserDesign}
                    showMaterialCard
                    showVariantPicker={false}
                    showTextLayers={false}
                    onStateChange={(patch) =>
                      setLaserDesign((prev) =>
                        prev ? { ...prev, ...patch } : prev
                      )
                    }
                  />
                </div>

                {/* Spalte 2: Desktop Variante → Preis/Warenkorb; mobil unter Vorschau */}
                <div className="order-3 flex min-w-0 max-w-full flex-col gap-4 xl:order-2 xl:col-span-4 xl:sticky xl:top-[calc(var(--header-height,4rem)+1rem)]">
                  {/* Desktop: Variante direkt über Preis */}
                  {shopProductVarianten.length > 0 && (
                    <div className="hidden xl:block">
                      <LaserDesignerStudio
                        column="settings"
                        material={shopLaserMaterial}
                        productName={detailProduct.name}
                        state={laserDesign}
                        varianten={shopProductVarianten}
                        showMaterialCard={false}
                        showVariantPicker
                        showTextLayers={false}
                        onStateChange={(patch) =>
                          setLaserDesign((prev) =>
                            prev ? { ...prev, ...patch } : prev
                          )
                        }
                      />
                    </div>
                  )}

                  {(detailProduct.dimensionsMm || detailProduct.gewicht != null) && (
                    <FesteMasseCard
                      dimensions={
                        detailProduct.dimensionsMm ?? {
                          length: 0,
                          width: 0,
                          height: 0,
                        }
                      }
                      volumeCm3={detailProduct.volumen ?? null}
                      weightG={detailProduct.gewicht ?? null}
                    />
                  )}

                  <Card className="rounded-2xl border-2 border-primary/25 bg-card/80 shadow-md shadow-primary/5">
                    <CardContent className="space-y-4 p-4 sm:p-5">
                      {shopVariantPicker}
                      <div className="flex flex-col gap-1">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Preis
                        </h3>
                        <p className="text-2xl font-bold tabular-nums text-primary">
                          CHF {unitPrice.toFixed(2)}
                        </p>
                        {qtyDiscount.tier ? (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">
                            Mengenrabatt −{qtyDiscount.discountPercent.toFixed(0)}%
                            (ab {qtyDiscount.tier.minQty} Stk.)
                          </p>
                        ) : quantityDiscountTiers.length > 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Mengenrabatt ab{" "}
                            {quantityDiscountTiers
                              .map(
                                (t) =>
                                  `${t.minQty} Stk. (−${t.discountPercent}%)`
                              )
                              .join(", ")}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          size="default"
                          variant="outline"
                          className="h-10 w-10 p-0"
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          aria-label="Anzahl verringern"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-10 text-center text-lg font-bold tabular-nums">
                          {quantity}
                        </span>
                        <Button
                          size="default"
                          variant="outline"
                          className="h-10 w-10 p-0"
                          onClick={() => setQuantity(quantity + 1)}
                          aria-label="Anzahl erhöhen"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <span className="ml-auto text-base font-semibold tabular-nums">
                          CHF {(unitPrice * quantity).toFixed(2)}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="laser-customer-remarks">
                          Bemerkungen / Extrawünsche
                        </Label>
                        <Textarea
                          id="laser-customer-remarks"
                          value={customerRemarks}
                          onChange={(e) => setCustomerRemarks(e.target.value)}
                          placeholder="z. B. besondere Platzierung, Schriftart…"
                          className="min-h-20 resize-y bg-background/80"
                        />
                      </div>
                      <Button
                        onClick={() => void handleAddToCart()}
                        disabled={!canAddToCart}
                        className="w-full bg-primary text-base hover:bg-primary/90"
                        size="lg"
                      >
                        {cartCapturing ? (
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        ) : (
                          <ShoppingCart className="mr-2 h-5 w-5" />
                        )}
                        {cartCapturing ? "Design wird gespeichert…" : "In den Warenkorb"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Spalte 3: Live-Vorschau (Desktop breiter/quadratisch) — mobil Varianten darüber */}
                <div className="order-2 flex min-w-0 max-w-full flex-col gap-4 xl:order-3 xl:col-span-5 xl:sticky xl:top-[calc(var(--header-height,4rem)+1rem)]">
                  {shopProductVarianten.length > 0 && (
                    <div className="xl:hidden">
                      <LaserDesignerStudio
                        column="settings"
                        material={shopLaserMaterial}
                        productName={detailProduct.name}
                        state={laserDesign}
                        varianten={shopProductVarianten}
                        showMaterialCard={false}
                        showVariantPicker
                        showTextLayers={false}
                        onStateChange={(patch) =>
                          setLaserDesign((prev) =>
                            prev ? { ...prev, ...patch } : prev
                          )
                        }
                      />
                    </div>
                  )}
                  <div className="xl:min-h-[32rem]">
                    <LaserDesignerStudio
                      column="preview"
                      material={shopLaserMaterial}
                      productName={detailProduct.name}
                      state={laserDesign}
                      customizationBackgroundUrl={customizationBackgroundUrl}
                      previewSurfaceRef={laserPreviewRef}
                      belowPreviewTitle={
                        <LoadSavedDesignButton
                          designType="laser"
                          className="w-full justify-center"
                          onSelect={(design) => {
                            setLaserDesign(
                              hydrateLaserDesignerFromConfig(
                                design.config ?? {},
                                shopLaserMaterial,
                                shopProductVarianten
                              )
                            )
                          }}
                        />
                      }
                      onStateChange={(patch) =>
                        setLaserDesign((prev) =>
                          prev ? { ...prev, ...patch } : prev
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
                <>
                  <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 md:gap-10">
                    {/*
                      Mobile: Galerie+Desc+Specs → Live-3D → Filament → Preis/Cart
                      Desktop: Spalte1 Galerie+Text+Specs+3D | Spalte2 Filament+Preis
                    */}
                    <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-2 md:gap-10 lg:items-stretch lg:gap-12">
                      <div className="order-1 flex min-w-0 flex-col gap-6 md:order-1">
                        <ProductImageGallery
                          images={galleryImages}
                          alt={detailProduct.name}
                        />
                        <Card className="rounded-2xl border-border/50 bg-card/50 shadow-sm">
                          <CardContent className="p-4 sm:p-6">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <Badge className="border border-cyan-600/30 bg-cyan-600/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-800 shadow-sm dark:text-cyan-200">
                                3D-Druck
                              </Badge>
                              {detailProduct.sale && (
                                <Badge className="bg-red-500 text-white hover:bg-red-500">
                                  Rabatt
                                </Badge>
                              )}
                            </div>
                            <h1 className="text-xl font-bold sm:text-2xl lg:text-3xl">
                              {detailProduct.name}
                            </h1>
                            <ProductDescription
                              html={detailProduct.description}
                              className="mt-3"
                            />
                          </CardContent>
                        </Card>

                        <FesteMasseCard
                          dimensions={productDimensions}
                          volumeCm3={detailProduct.volumen ?? null}
                          weightG={detailProduct.gewicht ?? null}
                          printTimeLabel={
                            detailProduct.printTimeShowInShop &&
                            detailProduct.printTimeMinutes != null &&
                            detailProduct.printTimeMinutes > 0
                              ? Math.floor(detailProduct.printTimeMinutes / 60) > 0
                                ? `${Math.floor(detailProduct.printTimeMinutes / 60)} h ${detailProduct.printTimeMinutes % 60} min`
                                : `${detailProduct.printTimeMinutes} min`
                              : null
                          }
                        />

                        {/* Desktop: 3D unter Beschreibung/Spezifikationen */}
                        {productModelUrl && isMdUp ? (
                          <div className="min-w-0">
                            <Product3DPreview
                              ref={product3dCanvasRef}
                              key={`${detailProduct.id}-${productModelUrl}-d`}
                              modelUrl={productModelUrl}
                              color={
                                showMultiColorPicker
                                  ? multiColorSelection?.colors.find(
                                      (c) =>
                                        c.slot === multiColorSelection.primarySlot
                                    )?.colorHex?.trim() ||
                                    multiColorSelection?.colors[0]?.colorHex?.trim() ||
                                    "#1a1a1a"
                                  : effectiveFilamentSelection?.colorHex?.trim() ||
                                    "#1a1a1a"
                              }
                              fixedDimensionsMm={productDimensionsToViewerMm(
                                productDimensions
                              )}
                              initialRotationDeg={detailProduct.defaultRotationDeg}
                            />
                          </div>
                        ) : null}
                      </div>

                      {/* Mobile: Live-3D nach Specs */}
                      {productModelUrl && !isMdUp ? (
                        <div className="order-2 min-w-0 md:hidden">
                          <Product3DPreview
                            ref={product3dCanvasRef}
                            key={`${detailProduct.id}-${productModelUrl}-m`}
                            modelUrl={productModelUrl}
                            color={
                              showMultiColorPicker
                                ? multiColorSelection?.colors.find(
                                    (c) =>
                                      c.slot === multiColorSelection.primarySlot
                                  )?.colorHex?.trim() ||
                                  multiColorSelection?.colors[0]?.colorHex?.trim() ||
                                  "#1a1a1a"
                                : effectiveFilamentSelection?.colorHex?.trim() ||
                                  "#1a1a1a"
                              }
                            fixedDimensionsMm={productDimensionsToViewerMm(
                              productDimensions
                            )}
                            initialRotationDeg={detailProduct.defaultRotationDeg}
                          />
                        </div>
                      ) : null}

                      <div className="order-3 flex min-w-0 flex-col gap-6 md:order-2 lg:h-full">
                        {shopVariantPicker}
                        {isMultiColorProduct(detailProduct) && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Farbauswahl</p>
                            <div className="inline-flex w-full rounded-xl bg-secondary p-1">
                              <button
                                type="button"
                                className={cn(
                                  "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                                  multiColorMode === "standard"
                                    ? "bg-primary text-primary-foreground shadow"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                                onClick={() => setMultiColorMode("standard")}
                              >
                                Standard
                              </button>
                              <button
                                type="button"
                                className={cn(
                                  "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                                  multiColorMode === "custom"
                                    ? "bg-primary text-primary-foreground shadow"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                                onClick={() => setMultiColorMode("custom")}
                              >
                                Andere Farben
                              </button>
                            </div>
                            {multiColorMode === "standard" &&
                              detailProduct.defaultFilamentColorName && (
                                <p className="text-xs text-muted-foreground">
                                  Standardfarbe:{" "}
                                  {detailProduct.defaultFilamentColorName}
                                  {(detailProduct.partLabels?.length ?? 0) > 0
                                    ? ` · Teile: ${(detailProduct.partLabels ?? []).join(", ")}`
                                    : ""}
                                </p>
                              )}
                          </div>
                        )}
                        {showMultiColorPicker ? (
                          <FilamentMultiColorPicker
                            materials={filamentMaterials}
                            activeTab={filamentTab}
                            onTabChange={setFilamentTab}
                            onSelectionChange={setMultiColorSelection}
                            slotLabels={detailProduct.partLabels ?? []}
                            lockSlotCountToLabels={
                              (detailProduct.partLabels?.length ?? 0) > 0
                            }
                            className="mt-0 border-0 pt-0"
                          />
                        ) : (
                          <>
                            <FilamentColorPicker
                              materials={filamentMaterials}
                              activeTab={filamentTab}
                              onTabChange={setFilamentTab}
                              onSelectionChange={(sel) => {
                                setFilamentSelection(sel)
                                setActiveVariantCommitted(false)
                              }}
                              preferredColorId={detailProduct.defaultFilamentColorId}
                              preferredColorName={
                                detailProduct.defaultFilamentColorName
                              }
                              className="mt-0 border-0 pt-0"
                            />
                            {effectiveFilamentSelection?.inStock && (
                              <div className="space-y-3">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="w-full"
                                  onClick={() => {
                                    const sel = effectiveFilamentSelection
                                    if (!sel) return
                                    setExtraVariants((prev) => [
                                      ...prev,
                                      {
                                        colorName: sel.colorName,
                                        colorHex: sel.colorHex,
                                        filament: sel.materialName,
                                        quantity: Math.max(1, quantity),
                                      },
                                    ])
                                    setQuantity(1)
                                    setActiveVariantCommitted(true)
                                  }}
                                >
                                  <Plus className="mr-2 h-4 w-4" />
                                  Weitere Variante / Farbe hinzufügen
                                </Button>
                                {extraVariants.length > 0 && (
                                  <ul className="space-y-2 rounded-xl border border-border/50 bg-muted/20 p-3">
                                    {extraVariants.map((extra, index) => (
                                      <li
                                        key={`${extra.colorName}-${index}`}
                                        className="flex items-center gap-3 text-sm"
                                      >
                                        <span
                                          className="h-5 w-5 shrink-0 rounded-full border border-border/50"
                                          style={{
                                            backgroundColor: extra.colorHex,
                                          }}
                                        />
                                        <span className="min-w-0 flex-1 truncate">
                                          {extra.filament} · {extra.colorName} ×
                                          {extra.quantity}
                                        </span>
                                        <button
                                          type="button"
                                          className="rounded p-1 text-muted-foreground hover:text-red-500"
                                          aria-label="Variante entfernen"
                                          onClick={() => {
                                            setExtraVariants((prev) =>
                                              prev.filter((_, i) => i !== index)
                                            )
                                            setActiveVariantCommitted(false)
                                          }}
                                        >
                                          <X className="h-4 w-4" />
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                          </>
                        )}

                        <div className="flex flex-col gap-6 lg:mt-auto">
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
                                {qtyDiscount.tier && (
                                  <div className="flex justify-between gap-3">
                                    <span className="text-muted-foreground">
                                      Mengenrabatt (ab {qtyDiscount.tier.minQty} Stk.)
                                    </span>
                                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                      −{qtyDiscount.discountPercent.toFixed(0)}%
                                      {baseUnitPrice !== unitPrice
                                        ? ` · statt CHF ${baseUnitPrice.toFixed(2)}`
                                        : ""}
                                    </span>
                                  </div>
                                )}
                                {!qtyDiscount.tier &&
                                  quantityDiscountTiers.length > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      Mengenrabatt ab{" "}
                                      {quantityDiscountTiers
                                        .map(
                                          (t) =>
                                            `${t.minQty} Stk. (−${t.discountPercent}%)`
                                        )
                                        .join(", ")}
                                    </p>
                                  )}
                                {detailShopVariants.length > 0 && (
                                  <div className="flex justify-between gap-3">
                                    <span className="text-muted-foreground">
                                      Variante
                                    </span>
                                    <span className="font-medium">
                                      {detailShopVariants.find(
                                        (v) => v.id === selectedShopVariantId
                                      )?.name ?? "—"}
                                    </span>
                                  </div>
                                )}
                                {detailProduct.sale &&
                                  detailProduct.originalPrice != null && (
                                    <div className="flex justify-between gap-3">
                                      <span className="text-muted-foreground">
                                        UVP
                                      </span>
                                      <span className="text-muted-foreground line-through">
                                        CHF {detailProduct.originalPrice.toFixed(2)}
                                      </span>
                                    </div>
                                  )}
                                <div className="flex justify-between gap-3">
                                  <span className="text-muted-foreground">
                                    Material (
                                    {showMultiColorPicker
                                      ? multiColorSelection?.materialName ?? "PLA"
                                      : effectiveFilamentSelection?.materialName ??
                                        "PLA"}
                                    )
                                  </span>
                                  <span className="max-w-[55%] text-right font-medium">
                                    {showMultiColorPicker
                                      ? multiColorSelection?.colors
                                          .map((c) => c.colorName)
                                          .join(", ") || "—"
                                      : effectiveFilamentSelection?.colorName ??
                                        "—"}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <span className="text-muted-foreground">
                                    Masse
                                  </span>
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
                                    onClick={() => {
                                      setActiveVariantCommitted(false)
                                      setQuantity(Math.max(1, quantity - 1))
                                    }}
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
                                    onClick={() => {
                                      setActiveVariantCommitted(false)
                                      setQuantity(quantity + 1)
                                    }}
                                    aria-label="Anzahl erhöhen"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>

                              <div className="border-t border-red-500/20 pt-3">
                                <div className="flex justify-between gap-3 text-lg font-bold">
                                  <span>Gesamtpreis</span>
                                  <span className="text-red-500 dark:text-red-400">
                                    CHF{" "}
                                    {(unitPrice * pricingQty).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <div className="space-y-1.5">
                            <Label htmlFor="3d-customer-remarks">
                              Bemerkungen / Extrawünsche
                            </Label>
                            <Textarea
                              id="3d-customer-remarks"
                              value={customerRemarks}
                              onChange={(e) => setCustomerRemarks(e.target.value)}
                              placeholder="z. B. besondere Anforderungen…"
                              className="min-h-20 resize-y bg-background/80"
                            />
                          </div>

                          <Button
                            onClick={() => void handleAddToCart()}
                            disabled={!canAddToCart}
                            className="w-full bg-primary hover:bg-primary/90"
                            size="lg"
                          >
                            {cartCapturing ? (
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                              <ShoppingCart className="mr-2 h-5 w-5" />
                            )}
                            {cartCapturing
                              ? "Wird hinzugefügt…"
                              : "In den Warenkorb"}
                          </Button>
                          {!showMultiColorPicker &&
                            effectiveFilamentSelection &&
                            !effectiveFilamentSelection.inStock && (
                              <p className="text-center text-sm text-red-500">
                                Gewaehlte Farbe ist derzeit nicht auf Lager.
                              </p>
                            )}
                          {showMultiColorPicker &&
                            multiColorSelection &&
                            !multiColorSelection.colors.every((c) => c.inStock) && (
                              <p className="text-center text-sm text-red-500">
                                Mindestens eine gewaehlte Farbe ist nicht auf Lager.
                              </p>
                            )}

                          <p className="rounded-xl border border-border/40 bg-muted/20 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                            <SiteText k="shop_delivery_notice" />{" "}
                            <Link
                              href="/kontakt"
                              className="font-medium text-primary underline-offset-2 hover:underline"
                            >
                              Kontaktformular
                            </Link>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
          )}
        </div>
      </div>
      </ProductDetailErrorBoundary>
      <HomeTopProductsSection />
      </>
    )
  }

  return (
    <div className="space-y-10 pb-12 md:space-y-16 md:pb-24">
      <section className="py-10 text-center md:py-16">
        <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/10 text-primary">
          <ShoppingBag className="mr-1 h-3 w-3" />
          <SiteText k="shop_hero_badge" />
        </Badge>
        <h1 className="text-4xl font-bold md:text-5xl">
          <SiteTextPhrase
            parts={[
              { key: "shop_hero_title_prefix", className: "text-foreground" },
              {
                key: "shop_hero_title_brand",
                className:
                  "bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent",
              },
              { key: "shop_hero_title_suffix", className: "text-foreground" },
            ]}
          />
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          <SiteText k="shop_hero_subtitle" />
        </p>
      </section>

      {(showCustom3d || showCustomLaser || showAiKonfigurator) && (
        <section className="relative z-10 mx-auto max-w-7xl px-4">
          <div className="mb-6 text-center md:mb-10">
            <h2 className="text-2xl font-bold md:text-3xl">
              <span className="text-foreground">Erschaffen Sie etwas </span>
              <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
                <SiteText k="shop_custom_section_title" />
              </span>
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              <SiteText k="shop_custom_section_subtitle" />
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
                    <h3 className="mb-2 text-lg font-bold"><SiteText k="shop_custom_3d_title" /></h3>
                    <p className="mb-2 flex-1 text-sm text-muted-foreground">
                      <SiteText k="shop_custom_3d_description" />
                    </p>
                    <PricingCategoriesSubtitle service="print3d" className="mb-6" />
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
                    <h3 className="mb-2 text-lg font-bold"><SiteText k="shop_custom_laser_title" /></h3>
                    <p className="mb-2 flex-1 text-sm text-muted-foreground">
                      <SiteText k="shop_custom_laser_description" />
                    </p>
                    <PricingCategoriesSubtitle service="laser" className="mb-6" />
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

      <section className="mx-auto max-w-7xl px-4 pb-4 pt-2 md:pt-4">
        <ShopStickyFilterChrome
          mainFilterOptions={mainFilterOptions ?? []}
          categoryFilter={categoryFilter}
          onCategoryChange={handleCategoryChange}
          visibleProductTags={visibleProductTags ?? []}
          selectedTagIds={selectedTagIds}
          onToggleTag={toggleTagFilter}
          onClearTags={clearTagFilters}
          sortMode={sortMode}
          onSortChange={setSortMode}
          productCount={displayedProducts.length}
          viewToggle={
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-border/60 p-0.5">
                <Button
                  type="button"
                  size="icon"
                  variant={viewMode === "grid3" ? "default" : "ghost"}
                  className="h-9 w-9"
                  aria-label="Einzelansicht / grosse Karten"
                  title="Grosse Karten (1 Spalte mobil, 3 Desktop)"
                  onClick={() => setViewModePersist("grid3")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant={viewMode === "grid5" ? "default" : "ghost"}
                  className="h-9 w-9"
                  aria-label="Zwei-Spalten / kompakte Karten"
                  title="Kompakte Karten (2 Spalten mobil, 5 Desktop)"
                  onClick={() => setViewModePersist("grid5")}
                >
                  <Grid2x2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant={viewMode === "list" ? "default" : "ghost"}
                  className="hidden h-9 w-9 md:inline-flex"
                  aria-label="Listenansicht"
                  title="Listenansicht"
                  onClick={() => setViewModePersist("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
              <div className="inline-flex rounded-lg border border-border/60 p-0.5">
                <Button
                  type="button"
                  size="icon"
                  variant={cardSurface === "brand" ? "default" : "ghost"}
                  className="h-9 w-9"
                  aria-label="Kartenhintergrund Brand-Gradient"
                  title="Brand-Gradient"
                  onClick={() => setCardSurfacePersist("brand")}
                >
                  <Palette className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={cardSurface === "neutral" ? "default" : "ghost"}
                  className="h-9 px-2 text-xs"
                  aria-label="Kartenhintergrund neutral"
                  title="Neutral"
                  onClick={() => setCardSurfacePersist("neutral")}
                >
                  Neutral
                </Button>
              </div>
            </div>
          }
        />

        <div className="mt-8 flex flex-col gap-8 lg:mt-10 lg:flex-row lg:items-start lg:gap-10">
          <ShopTagFilterPanel
            className="hidden w-full lg:sticky lg:top-[calc(var(--df-banner-h,0px)+var(--header-height,4rem)+8.5rem)] lg:block lg:w-64 lg:shrink-0 lg:self-start"
            tags={visibleProductTags ?? []}
            selectedTagIds={selectedTagIds}
            onToggleTag={toggleTagFilter}
            onClear={clearTagFilters}
          />

          <div className="min-w-0 flex-1">
        {displayedProducts.length === 0 ? (
          <Card className="border-border/50 bg-card/50">
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground"><SiteText k="shop_empty_category" /></p>
            </CardContent>
          </Card>
        ) : (
          <div
            className={cn(
              "items-stretch gap-6",
              viewMode === "list" && "grid grid-cols-1",
              viewMode === "grid3" &&
                "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
              viewMode === "grid5" &&
                "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
            )}
          >
            {visibleProducts.map((product, index) => {
              const cardImages = resolveProductImages(
                product.id,
                product.images,
                product.galerieBilder
              )
              const coverSrc =
                product.images?.[0]?.trim() ||
                cardImages[0] ||
                "/placeholder.svg"
              return (
                <ShopProductCard
                  key={product.id}
                  product={product}
                  coverSrc={coverSrc}
                  viewMode={viewMode}
                  surface={cardSurface}
                  canInlineEdit={canInlineEdit}
                  priority={index < 4}
                  onOpen={() => openProduct(product)}
                />
              )
            })}
          </div>
        )}
        {hasMoreProducts && (
          <div className="mt-8 flex flex-col items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() =>
                setVisibleCount((prev) => prev + SHOP_LOAD_MORE_STEP)
              }
            >
              Mehr laden
            </Button>
            <p className="text-xs text-muted-foreground">
              {visibleProducts.length} von {displayedProducts.length} Produkten
            </p>
          </div>
        )}
          </div>
        </div>
      </section>
    </div>
  )
}
