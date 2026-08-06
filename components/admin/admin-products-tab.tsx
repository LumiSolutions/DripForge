"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  Archive,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ProductDescriptionEditor } from "@/components/admin/product-description-editor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AdminProduct } from "@/lib/admin/types"
import { formatVariantenForAdmin } from "@/lib/dripforge/product-varianten"
import {
  calculateSalePrice,
  inferSaleRabattFromProduct,
  resolveProductBasisPreis,
  roundChf,
  validateSaleDiscount,
  type SaleRabattTyp,
} from "@/lib/dripforge/product-sale"
import {
  normalizeQuantityDiscountTiers,
  type QuantityDiscountTier,
} from "@/lib/dripforge/quantity-discount-tiers"
import {
  analyzeProductStlFile,
  isStlFileName,
} from "@/lib/dripforge/analyze-product-stl"
import type { LaserMaterialId, Product } from "@/lib/dripforge/types"
import {
  buildLaserMaterialSelectOptions,
  resolveLaserMaterialIdFromStockItem,
} from "@/lib/dripforge/laser-material-options"
import type { LaserMaterialTypeDefinition } from "@/lib/admin/laser-material-types"
import {
  getActiveMaterialTypes,
  type MaterialTypeDefinition,
} from "@/lib/admin/material-stats-types"
import { normalizeAllowedFilamentMaterialTypeIds } from "@/lib/dripforge/product-filament-materials"
import type { MaterialItem, ProductMaterialLink } from "@/lib/admin/material-types"
import {
  calculateGrossMarginPercent,
  calculateMarkupFactor,
  calculateProductPricingBreakdown,
  salePriceFromMarkupFactor,
  salePriceFromTargetMarginPercent,
} from "@/lib/admin/material-pricing"
import { type ProductSortMode } from "@/lib/admin/list-sort-utils"
import { allocateNextProductSku } from "@/lib/admin/product-sku"
import { MODEL_FILE_ACCEPT } from "@/lib/dripforge/model-file-accept"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"
import {
  AdminProductTagCheckboxes,
  AdminProductTagsSection,
} from "@/components/admin/admin-product-tags-section"
import { AdminProductsListPanel } from "@/components/admin/admin-products-list-panel"
import { AdminGallerySortable } from "@/components/admin/admin-gallery-sortable"
import { AdminImageCropDialog } from "@/components/admin/admin-image-crop-dialog"
import { AdminRotationPreview } from "@/components/admin/admin-rotation-preview"
import type { ProductTag } from "@/lib/admin/product-tags"
import {
  getProductShopStatus,
  PRODUCT_SHOP_STATUS_OPTIONS,
  productFieldsFromShopStatus,
  type ProductShopStatus,
} from "@/lib/admin/product-status"
import {
  formatOptionalNumber,
  parseOptionalInt,
  parseOptionalNumber,
} from "@/lib/admin/optional-number"
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  MANUAL_AVAILABILITY_OPTIONS,
  ZERO_STOCK_BEHAVIOR_OPTIONS,
  type ProductManualAvailability,
  type ProductZeroStockBehavior,
} from "@/lib/dripforge/product-inventory"

type ProductFormState = Partial<AdminProduct> & {
  variantenText?: string
  basisPreis?: number
  purchasePriceChf?: number
  additionalBaseCostChf?: number
}

const EMPTY_FORM: ProductFormState = {
  id: "",
  name: "",
  description: "",
  basisPreis: 0,
  purchasePriceChf: 0,
  additionalBaseCostChf: 0,
  price: 0,
  originalPrice: null,
  type: "3d",
  sale: false,
  saleRabattTyp: "percent",
  saleRabattWert: 10,
  istAktiv: true,
  isTopProduct: false,
  laserMaterialId: "wood",
  dimensionsMm: { length: 100, width: 100, height: 100 },
  volumen: 0,
  gewicht: 0,
  galerieBilder: [],
  individualisierungsBild: "",
  modellDateiUrl: "",
  variantenText: "",
  shopVariants: [],
  materialLinks: [],
  tags: [],
  imageShape: "rounded",
  sku: "",
  trackInventory: false,
  stockQuantity: 0,
  lowStockThreshold: DEFAULT_LOW_STOCK_THRESHOLD,
  manualAvailability: "available",
  zeroStockBehavior: "sold_out",
}

type MediaUploadCategory = "gallery" | "customization" | "model"

async function uploadAdminFile(
  productId: string,
  category: MediaUploadCategory,
  file: File
): Promise<string> {
  const formData = new FormData()
  formData.append("productId", productId)
  formData.append("category", category)
  formData.append("file", file)

  const res = await fetch("/api/admin/upload", {
    method: "POST",
    credentials: "include",
    body: formData,
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error ?? "Upload fehlgeschlagen")
  }
  return data.url as string
}

function filenameFromUrl(url: string): string {
  const path = url.split("?")[0] ?? url
  const name = path.slice(path.lastIndexOf("/") + 1)
  return name || "Datei"
}

function emptyMaterialLink(): ProductMaterialLink {
  return { materialId: "", consumptionGrams: 0 }
}

function materialLabel(item: MaterialItem): string {
  const parts = [item.manufacturer, item.name, item.farbe].filter(Boolean)
  return parts.join(" — ") || item.name
}

/** Dropdown-Label: id, Name, Farbe, Materialtyp */
function materialSelectLabel(item: MaterialItem): string {
  const namePart = item.farbe?.trim()
    ? `${item.name} — ${item.farbe.trim()}`
    : item.name
  const typePart = item.materialType?.trim() ? ` [${item.materialType}]` : ""
  return `${item.id} · ${namePart}${typePart}`
}

function marginToneClass(marginPercent: number | null): string {
  if (marginPercent == null) return adminUi.muted
  if (marginPercent >= 60) return "text-emerald-600 dark:text-emerald-400"
  if (marginPercent >= 30) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

const DEFAULT_PRODUCT_SECTIONS: Record<string, boolean> = {
  allgemein: true,
  inventory: false,
  sale: false,
  quantityDiscount: false,
  tags: false,
  dimensions: false,
  colors: false,
  laser: false,
  varianten: false,
  materials: false,
  pricing: false,
  media: false,
}

function ProductEditAccordion({
  title,
  open,
  onToggle,
  children,
  headerRight,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
  headerRight?: ReactNode
}) {
  return (
    <div className={cn("rounded-xl border", adminUi.section)}>
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center gap-2 cursor-pointer font-semibold text-left"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
          <span className={adminUi.accentTitle}>{title}</span>
        </button>
        {headerRight}
      </div>
      {open ? <div className="space-y-4 border-t px-4 pb-4 pt-3">{children}</div> : null}
    </div>
  )
}

export function AdminProductsTab() {
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [isEditing, setIsEditing] = useState(false)
  const [uploadingMedia, setUploadingMedia] = useState<MediaUploadCategory | null>(
    null
  )
  const [imageUrlInput, setImageUrlInput] = useState("")
  const [materialCatalog, setMaterialCatalog] = useState<MaterialItem[]>([])
  const [laserMaterialTypes, setLaserMaterialTypes] = useState<
    LaserMaterialTypeDefinition[]
  >([])
  const [filamentMaterialTypes, setFilamentMaterialTypes] = useState<
    MaterialTypeDefinition[]
  >([])
  const [productSort, setProductSort] = useState<ProductSortMode>("name-asc")
  const [productTags, setProductTags] = useState<ProductTag[]>([])
  const [laserMaterialFilter, setLaserMaterialFilter] = useState("")
  const [materialLinkFilters, setMaterialLinkFilters] = useState<Record<number, string>>(
    {}
  )
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    ...DEFAULT_PRODUCT_SECTIONS,
  })
  /** Freitext während der Eingabe — Parsing erst bei Blur/Speichern. */
  const [partLabelsDraft, setPartLabelsDraft] = useState<string | null>(null)
  const [defaultColorDraft, setDefaultColorDraft] = useState<string | null>(null)
  const [formBaseline, setFormBaseline] = useState("")
  const [discardPromptOpen, setDiscardPromptOpen] = useState(false)
  const [stlAnalyzing, setStlAnalyzing] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const parsePartLabelsDraft = (raw: string): string[] =>
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 24)

  const snapshotForm = (state: ProductFormState, partDraft: string | null, colorDraft: string | null) =>
    JSON.stringify({
      ...state,
      partLabels:
        partDraft !== null ? parsePartLabelsDraft(partDraft) : state.partLabels,
      defaultFilamentColorName:
        colorDraft !== null
          ? colorDraft.trim() || null
          : state.defaultFilamentColorName,
    })

  const isFormDirty = () => {
    if (!formBaseline) return false
    return (
      snapshotForm(form, partLabelsDraft, defaultColorDraft) !== formBaseline
    )
  }

  const archivedCount = useMemo(
    () => products.filter((p) => getProductShopStatus(p) === "inactive").length,
    [products]
  )

  const loadMaterials = useCallback(async () => {
    try {
      const [materialsRes, typesRes] = await Promise.all([
        fetch("/api/admin/materials", {
          credentials: "include",
          cache: "no-store",
        }),
        fetch("/api/admin/material-stats", {
          credentials: "include",
          cache: "no-store",
        }),
      ])
      const data = await materialsRes.json()
      if (materialsRes.ok) setMaterialCatalog(data.materials ?? [])
      if (typesRes.ok) {
        const typesData = await typesRes.json()
        setLaserMaterialTypes(typesData.laserTypes ?? [])
        setFilamentMaterialTypes(typesData.materialTypes ?? [])
      }
    } catch {
      /* optional for product editor */
    }
  }, [])

  const closeEditor = () => {
    setIsEditing(false)
    setForm(EMPTY_FORM)
    setPartLabelsDraft(null)
    setDefaultColorDraft(null)
    setFormBaseline("")
    setDiscardPromptOpen(false)
    setImageUrlInput("")
    setLaserMaterialFilter("")
    setMaterialLinkFilters({})
    setOpenSections({ ...DEFAULT_PRODUCT_SECTIONS })
    setSaveSuccess(null)
  }

  const requestCloseEditor = () => {
    if (isFormDirty()) {
      setDiscardPromptOpen(true)
      return
    }
    closeEditor()
  }

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/products", {
        credentials: "include",
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      setProducts(data.products ?? [])
    } catch (err) {
      console.warn("Admin: Produkte konnten nicht geladen werden.", err)
      setError(
        err instanceof Error ? err.message : "Produkte konnten nicht geladen werden."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  const loadProductTags = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/product-tags", {
        credentials: "include",
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) {
        console.error("[Admin Produkte] Tags laden fehlgeschlagen:", res.status, data)
        return
      }
      if (Array.isArray(data.tags)) {
        setProductTags(data.tags as ProductTag[])
      }
    } catch (err) {
      console.error("[Admin Produkte] Tags laden fehlgeschlagen:", err)
    }
  }, [])

  useEffect(() => {
    void loadProducts()
    void loadMaterials()
    void loadProductTags()
  }, [loadProducts, loadMaterials, loadProductTags])

  const startCreate = () => {
    const next = {
      ...EMPTY_FORM,
      id: `p-${Date.now()}`,
      sku: allocateNextProductSku(products),
    }
    setForm(next)
    setPartLabelsDraft(null)
    setDefaultColorDraft(null)
    setFormBaseline(snapshotForm(next, null, null))
    setLaserMaterialFilter("")
    setMaterialLinkFilters({})
    setOpenSections({ ...DEFAULT_PRODUCT_SECTIONS })
    setIsEditing(true)
  }

  const startEdit = (product: AdminProduct) => {
    const inferred = inferSaleRabattFromProduct(product)
    const next: ProductFormState = {
      ...product,
      basisPreis: resolveProductBasisPreis(product),
      saleRabattTyp: inferred.typ,
      saleRabattWert: inferred.wert,
      istAktiv: product.istAktiv !== false,
      isTopProduct: Boolean(product.isTopProduct),
      galerieBilder: product.galerieBilder ?? product.images ?? [],
      individualisierungsBild: product.individualisierungsBild ?? "",
      modellDateiUrl: product.modellDateiUrl ?? product.modelUrl ?? "",
      variantenText: formatVariantenForAdmin(product.varianten ?? []),
      shopVariants: product.shopVariants ?? [],
      materialLinks: product.materialLinks ?? [],
      additionalBaseCostChf: product.additionalBaseCostChf ?? 0,
      purchasePriceChf: product.purchasePriceChf ?? 0,
      tags: product.tags ?? [],
      imageShape: product.imageShape ?? "rounded",
      sku: product.sku ?? "",
      quantityDiscountTiers: normalizeQuantityDiscountTiers(
        product.quantityDiscountTiers
      ),
      printTimeMinutes: product.printTimeMinutes,
      printTimeShowInShop: Boolean(product.printTimeShowInShop),
      allowedFilamentMaterialTypeIds: product.allowedFilamentMaterialTypeIds,
      trackInventory: Boolean(product.trackInventory),
      stockQuantity: product.stockQuantity ?? 0,
      lowStockThreshold:
        product.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD,
      manualAvailability: product.manualAvailability ?? "available",
      zeroStockBehavior: product.zeroStockBehavior ?? "sold_out",
      defaultRotationDeg: product.defaultRotationDeg ?? { x: 0, y: 0, z: 0 },
    }
    setForm(next)
    setPartLabelsDraft(null)
    setDefaultColorDraft(null)
    setFormBaseline(snapshotForm(next, null, null))
    setLaserMaterialFilter("")
    setMaterialLinkFilters({})
    setOpenSections({
      ...DEFAULT_PRODUCT_SECTIONS,
      sale: Boolean(product.sale),
      inventory:
        Boolean(product.trackInventory) ||
        (product.manualAvailability != null &&
          product.manualAvailability !== "available"),
    })
    setIsEditing(true)
    setSaveSuccess(null)
  }

  const updateField = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const commitPartLabelsDraft = () => {
    if (partLabelsDraft === null) return
    updateField("partLabels", parsePartLabelsDraft(partLabelsDraft))
    setPartLabelsDraft(null)
  }

  const commitDefaultColorDraft = () => {
    if (defaultColorDraft === null) return
    updateField("defaultFilamentColorName", defaultColorDraft.trim() || null)
    setDefaultColorDraft(null)
  }

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ""
    if (!files.length || !form.id) return

    setUploadingMedia("gallery")
    setError(null)
    try {
      const urls: string[] = []
      for (const file of files) {
        urls.push(await uploadAdminFile(form.id, "gallery", file))
      }
      updateField("galerieBilder", [...(form.galerieBilder ?? []), ...urls])
    } catch (err) {
      console.warn("Admin: Galerie-Upload fehlgeschlagen.", err)
      setError(err instanceof Error ? err.message : "Galerie-Upload fehlgeschlagen.")
    } finally {
      setUploadingMedia(null)
    }
  }

  const handleCustomizationUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !form.id) return

    setUploadingMedia("customization")
    setError(null)
    try {
      const url = await uploadAdminFile(form.id, "customization", file)
      updateField("individualisierungsBild", url)
    } catch (err) {
      console.warn("Admin: Individualisierungs-Upload fehlgeschlagen.", err)
      setError(
        err instanceof Error
          ? err.message
          : "Individualisierungs-Upload fehlgeschlagen."
      )
    } finally {
      setUploadingMedia(null)
    }
  }

  const handleModelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !form.id) return

    setUploadingMedia("model")
    setError(null)
    try {
      const url = await uploadAdminFile(form.id, "model", file)
      updateField("modellDateiUrl", url)

      if (form.type === "3d" && isStlFileName(file.name)) {
        setStlAnalyzing(true)
        try {
          const analysis = await analyzeProductStlFile(file)
          setForm((prev) => ({
            ...prev,
            modellDateiUrl: url,
            dimensionsMm: {
              length: analysis.length,
              width: analysis.width,
              height: analysis.height,
            },
            volumen: analysis.volumeCm3,
            volumenEinheit: "cm3",
            gewicht: analysis.weightG,
          }))
          setOpenSections((prev) => ({ ...prev, dimensions: true }))
        } catch (analyzeErr) {
          console.warn("Admin: STL-Analyse fehlgeschlagen.", analyzeErr)
        } finally {
          setStlAnalyzing(false)
        }
      }
    } catch (err) {
      console.warn("Admin: 3D-Upload fehlgeschlagen.", err)
      setError(err instanceof Error ? err.message : "3D-Upload fehlgeschlagen.")
    } finally {
      setUploadingMedia(null)
    }
  }

  const applyCustomizationCrop = async (dataUrl: string) => {
    if (!form.id) return
    setUploadingMedia("customization")
    setError(null)
    try {
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const file = new File([blob], `customization-crop-${Date.now()}.jpg`, {
        type: "image/jpeg",
      })
      const url = await uploadAdminFile(form.id, "customization", file)
      updateField("individualisierungsBild", url)
    } catch (err) {
      console.warn("Admin: Zuschnitt-Upload fehlgeschlagen.", err)
      setError(
        err instanceof Error ? err.message : "Zuschnitt konnte nicht gespeichert werden."
      )
    } finally {
      setUploadingMedia(null)
    }
  }

  const addImageUrl = () => {
    const url = imageUrlInput.trim()
    if (!url) return
    updateField("galerieBilder", [...(form.galerieBilder ?? []), url])
    setImageUrlInput("")
  }

  const laserMaterialOptions = useMemo(
    () => buildLaserMaterialSelectOptions(materialCatalog, laserMaterialTypes),
    [materialCatalog, laserMaterialTypes]
  )

  const filteredLaserMaterialOptions = useMemo(() => {
    const q = laserMaterialFilter.trim().toLowerCase()
    if (!q) return laserMaterialOptions
    return laserMaterialOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q)
    )
  }, [laserMaterialOptions, laserMaterialFilter])

  const productVariantOptions = useMemo(() => {
    const fromText = (form.variantenText ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    return fromText
  }, [form.variantenText])

  const filteredMaterialCatalogForLink = useCallback(
    (index: number) => {
      const q = (materialLinkFilters[index] ?? "").trim().toLowerCase()
      if (!q) return materialCatalog
      return materialCatalog.filter((m) => {
        const hay = [
          m.id,
          m.name,
          m.farbe,
          m.materialType,
          m.manufacturer,
          m.category,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        return hay.includes(q)
      })
    },
    [materialCatalog, materialLinkFilters]
  )

  const updateMaterialLink = (
    index: number,
    patch: Partial<ProductMaterialLink>
  ) => {
    const links = [...(form.materialLinks ?? [])]
    const prev = links[index]
    const next = { ...prev, ...patch }
    links[index] = next

    if (patch.materialId !== undefined && form.type === "laser") {
      const selected = materialCatalog.find((m) => m.id === patch.materialId)
      const laserId = selected
        ? resolveLaserMaterialIdFromStockItem(selected)
        : null
      if (laserId) {
        setForm((prevForm) => ({
          ...prevForm,
          materialLinks: links,
          laserMaterialId: laserId,
        }))
        return
      }
    }

    updateField("materialLinks", links)
  }

  const addMaterialLink = () => {
    updateField("materialLinks", [...(form.materialLinks ?? []), emptyMaterialLink()])
  }

  const removeMaterialLink = (index: number) => {
    const links = [...(form.materialLinks ?? [])]
    links.splice(index, 1)
    updateField("materialLinks", links)
  }

  const pricingBreakdown = useMemo(
    () =>
      calculateProductPricingBreakdown(
        form.materialLinks ?? [],
        materialCatalog,
        form.additionalBaseCostChf ?? 0
      ),
    [form.materialLinks, form.additionalBaseCostChf, materialCatalog]
  )

  const salePreview = useMemo(() => {
    const basis = Number(form.basisPreis) || 0
    if (!form.sale || basis <= 0) return null

    const typ = (form.saleRabattTyp ?? "percent") as SaleRabattTyp
    const wert = Number(form.saleRabattWert) || 0
    const validation = validateSaleDiscount(basis, typ, wert)
    const endpreis = validation ? null : calculateSalePrice(basis, typ, wert)

    return { basis, endpreis, validation }
  }, [form.basisPreis, form.sale, form.saleRabattTyp, form.saleRabattWert])

  const marginPreview = useMemo(() => {
    const selfCost = pricingBreakdown.totalSelfCostChf
    const sale = Number(form.basisPreis) || 0
    if (selfCost <= 0 && sale <= 0) return null
    const profit = roundChf(sale - selfCost)
    const marginPercent = calculateGrossMarginPercent(sale, selfCost)
    const markupFactor = calculateMarkupFactor(sale, selfCost)
    return { selfCost, sale, profit, marginPercent, markupFactor }
  }, [pricingBreakdown.totalSelfCostChf, form.basisPreis])

  const applyMarkupFactor = (factor: number) => {
    const next = salePriceFromMarkupFactor(pricingBreakdown.totalSelfCostChf, factor)
    updateField("basisPreis", next)
  }

  const applyTargetMargin = (marginPercent: number) => {
    const next = salePriceFromTargetMarginPercent(
      pricingBreakdown.totalSelfCostChf,
      marginPercent
    )
    updateField("basisPreis", next)
  }

  const saveProduct = async () => {
    setSaving(true)
    setError(null)
    setSaveSuccess(null)

    const committedPartLabels =
      partLabelsDraft !== null
        ? parsePartLabelsDraft(partLabelsDraft)
        : form.partLabels
    const committedColor =
      defaultColorDraft !== null
        ? defaultColorDraft.trim() || null
        : form.defaultFilamentColorName
    if (partLabelsDraft !== null) {
      setPartLabelsDraft(null)
      updateField("partLabels", committedPartLabels)
    }
    if (defaultColorDraft !== null) {
      setDefaultColorDraft(null)
      updateField("defaultFilamentColorName", committedColor)
    }

    if (form.sale) {
      const basis = Number(form.basisPreis) || 0
      const typ = (form.saleRabattTyp ?? "percent") as SaleRabattTyp
      const wert = Number(form.saleRabattWert) || 0
      const validation = validateSaleDiscount(basis, typ, wert)
      if (validation) {
        setError(validation)
        setSaving(false)
        return
      }
    }

    try {
      const isNew = !products.some((p) => p.id === form.id)
      const url = isNew
        ? "/api/admin/products"
        : `/api/admin/products/${form.id}`
      const method = isNew ? "POST" : "PUT"
      const quantityDiscountTiers = normalizeQuantityDiscountTiers(
        form.quantityDiscountTiers
      )

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          partLabels: committedPartLabels,
          defaultFilamentColorName: committedColor,
          defaultRotationDeg: form.defaultRotationDeg ?? null,
          quantityDiscountTiers:
            quantityDiscountTiers.length > 0 ? quantityDiscountTiers : [],
          printTimeMinutes: form.printTimeMinutes ?? null,
          printTimeShowInShop: Boolean(form.printTimeShowInShop),
          allowedFilamentMaterialTypeIds:
            form.type === "3d"
              ? normalizeAllowedFilamentMaterialTypeIds(
                  form.allowedFilamentMaterialTypeIds ??
                    getActiveMaterialTypes(filamentMaterialTypes).map((t) => t.id)
                ) ?? []
              : undefined,
          purchasePriceChf: pricingBreakdown.totalSelfCostChf,
          additionalBaseCostChf: pricingBreakdown.additionalBaseCostChf,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")

      const savedProduct = (data.product ?? null) as AdminProduct | null
      await loadProducts()

      if (savedProduct) {
        startEdit(savedProduct)
      } else {
        setFormBaseline(
          snapshotForm(
            {
              ...form,
              partLabels: committedPartLabels,
              defaultFilamentColorName: committedColor,
            },
            null,
            null
          )
        )
      }
      setSaveSuccess("Produktdaten erfolgreich gespeichert")
    } catch (err) {
      console.warn("Admin: Produkt konnte nicht gespeichert werden.", err)
      setError(
        err instanceof Error ? err.message : "Produkt konnte nicht gespeichert werden."
      )
    } finally {
      setSaving(false)
    }
  }

  const removeProduct = async (id: string) => {
    if (!confirm("Produkt wirklich löschen?")) return
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Löschen fehlgeschlagen")
      await loadProducts()
      if (form.id === id) closeEditor()
    } catch (err) {
      console.warn("Admin: Produkt konnte nicht geloescht werden.", err)
      setError(
        err instanceof Error ? err.message : "Produkt konnte nicht geloescht werden."
      )
    }
  }

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-24", adminUi.loader)}>
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Produkte werden geladen…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={cn("text-xl font-bold", adminUi.heading)}>Produkt-Management</h2>
          <p className={cn("text-sm", adminUi.muted)}>
            Produkte und Shop-Tags zentral verwalten
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={startCreate}
          className={adminUi.primaryBtn}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Neues Produkt
        </Button>
      </div>

      {error && !isEditing && <p className={adminUi.error}>{error}</p>}

      <Tabs defaultValue="products" className="space-y-6">
        <TabsList>
          <TabsTrigger value="products">Produkte verwalten</TabsTrigger>
          <TabsTrigger value="tags">Produkt-Tags verwalten</TabsTrigger>
          <TabsTrigger value="archive" className="gap-1.5">
            <Archive className="h-3.5 w-3.5" />
            Archiv
            {archivedCount > 0 && (
              <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                {archivedCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <AdminProductsListPanel
            products={products}
            productTags={productTags}
            productSort={productSort}
            onProductSortChange={setProductSort}
            activeProductId={isEditing ? form.id : undefined}
            onEdit={startEdit}
            onRefresh={loadProducts}
          />
        </TabsContent>

        <TabsContent value="tags">
          <AdminProductTagsSection onTagsChange={setProductTags} />
        </TabsContent>

        <TabsContent value="archive" className="space-y-4">
          <p className={cn("text-sm", adminUi.muted)}>
            Inaktive / archivierte Produkte sind im öffentlichen Shop nicht sichtbar und
            nicht über Direktlinks erreichbar.
          </p>
          <AdminProductsListPanel
            products={products}
            productTags={productTags}
            productSort={productSort}
            onProductSortChange={setProductSort}
            activeProductId={isEditing ? form.id : undefined}
            onEdit={startEdit}
            onRefresh={loadProducts}
            lockedStatusFilter="inactive"
            emptyMessage="Keine archivierten Produkte."
          />
        </TabsContent>
      </Tabs>

      <Dialog
        open={isEditing}
        onOpenChange={(open) => {
          if (!open) requestCloseEditor()
        }}
      >
        <DialogContent
          className="max-h-[90vh] max-w-2xl overflow-y-auto"
          showCloseButton={false}
          onPointerDownOutside={(e) => {
            e.preventDefault()
            requestCloseEditor()
          }}
          onInteractOutside={(e) => {
            e.preventDefault()
            requestCloseEditor()
          }}
          onEscapeKeyDown={(e) => {
            e.preventDefault()
            requestCloseEditor()
          }}
        >
          <DialogHeader>
            <div className="flex items-start justify-between gap-3 pr-2">
              <DialogTitle>
                {products.some((p) => p.id === form.id)
                  ? "Produkt bearbeiten"
                  : "Neues Produkt"}
              </DialogTitle>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                aria-label="Schliessen"
                onClick={requestCloseEditor}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-5">
            {error && <p className={adminUi.error}>{error}</p>}

            <div className="flex items-center justify-end">
              {products.some((p) => p.id === form.id) && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => void removeProduct(form.id!)}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Löschen
                </Button>
              )}
            </div>

              <ProductEditAccordion
                title="Allgemein"
                open={Boolean(openSections.allgemein)}
                onToggle={() => toggleSection("allgemein")}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label className={adminUi.label}>Produktname</Label>
                    <Input
                      value={form.name ?? ""}
                      onChange={(e) => updateField("name", e.target.value)}
                      className={adminUi.input}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={adminUi.label}>Artikelnummer (SKU)</Label>
                    <Input
                      value={form.sku ?? ""}
                      onChange={(e) =>
                        updateField(
                          "sku",
                          e.target.value.replace(/\D/g, "").slice(0, 12)
                        )
                      }
                      placeholder="10001"
                      inputMode="numeric"
                      className={adminUi.input}
                    />
                    <p className={cn("text-xs", adminUi.muted)}>
                      Fortlaufend numerisch — beim Anlegen automatisch vergeben, manuell
                      änderbar.
                    </p>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className={adminUi.label}>Beschreibung</Label>
                    <ProductDescriptionEditor
                      key={form.id || "new-product"}
                      value={form.description ?? ""}
                      onChange={(html) => updateField("description", html)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={adminUi.label}>Typ</Label>
                    <select
                      value={form.type ?? "3d"}
                      onChange={(e) =>
                        updateField("type", e.target.value as Product["type"])
                      }
                      className={cn("h-10 w-full rounded-md border px-3 text-sm", adminUi.select)}
                    >
                      <option value="3d">3D-Druck (fest)</option>
                      <option value="laser">Lasergravur</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-4 sm:col-span-2">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className={adminUi.label}>Status</Label>
                        <Select
                          value={getProductShopStatus({
                            istAktiv: form.istAktiv,
                            sale: Boolean(form.sale),
                          })}
                          onValueChange={(value) => {
                            const status = value as ProductShopStatus
                            const fields = productFieldsFromShopStatus(status)
                            setForm((prev) => ({
                              ...prev,
                              istAktiv: fields.istAktiv,
                              sale:
                                fields.sale !== undefined ? fields.sale : prev.sale,
                            }))
                          }}
                        >
                          <SelectTrigger className={adminUi.select}>
                            <SelectValue placeholder="Status wählen" />
                          </SelectTrigger>
                          <SelectContent>
                            {PRODUCT_SHOP_STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className={cn("text-xs", adminUi.muted)}>
                          Inaktiv / Archiviert: im Shop ausgeblendet (404 bei Direktlink).
                        </p>
                      </div>
                      <div className="flex flex-col justify-end gap-3 pb-1">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={Boolean(form.sale)}
                            onCheckedChange={(checked) => {
                              updateField("sale", checked)
                              if (checked) {
                                updateField("istAktiv", true)
                                setOpenSections((prev) => ({ ...prev, sale: true }))
                              }
                            }}
                            disabled={form.istAktiv === false}
                          />
                          <Label className={adminUi.label}>Im Sale</Label>
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={form.istAktiv !== false}
                            onCheckedChange={(checked) =>
                              updateField("istAktiv", checked)
                            }
                          />
                          <Label className={adminUi.label}>Produkt aktiv</Label>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl border border-border/60 px-4 py-3">
                      <Switch
                        id="isTopProduct"
                        checked={Boolean(form.isTopProduct)}
                        onCheckedChange={(checked) => updateField("isTopProduct", checked)}
                        className="mt-0.5"
                      />
                      <div className="space-y-1">
                        <Label htmlFor="isTopProduct" className={adminUi.label}>
                          Als Top-Produkt-Fallback markieren
                        </Label>
                        <p className={cn("text-xs", adminUi.muted)}>
                          Wird auf der Startseite unter «Unsere Top Produkte» angezeigt,
                          wenn noch nicht genug Verkäufe für die Bestseller-Liste vorliegen
                          (Admin: Homepage-Einstellungen).
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </ProductEditAccordion>

              <ProductEditAccordion
                title="Lagerbestand & Status"
                open={Boolean(openSections.inventory)}
                onToggle={() => toggleSection("inventory")}
              >
                <p className={cn("text-xs", adminUi.muted)}>
                  Standard: Bestandsverwaltung aus — Produkt gilt als unbegrenzt
                  verfügbar. Manueller Status überschreibt die Menge.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label className={adminUi.label}>
                      Manuelle Verfügbarkeit
                    </Label>
                    <Select
                      value={form.manualAvailability ?? "available"}
                      onValueChange={(value) =>
                        updateField(
                          "manualAvailability",
                          value as ProductManualAvailability
                        )
                      }
                    >
                      <SelectTrigger className={adminUi.select}>
                        <SelectValue placeholder="Status wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {MANUAL_AVAILABILITY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-border/60 px-3 py-3 sm:col-span-2">
                    <Switch
                      id="trackInventory"
                      checked={Boolean(form.trackInventory)}
                      onCheckedChange={(checked) =>
                        updateField("trackInventory", checked)
                      }
                      className="mt-0.5"
                    />
                    <div className="space-y-1">
                      <Label htmlFor="trackInventory" className={adminUi.label}>
                        Lagerbestand verfolgen
                      </Label>
                      <p className={cn("text-xs", adminUi.muted)}>
                        Wenn aktiv, steuert die Stückzahl Verfügbarkeit und Badges
                        im Shop (zusätzlich zum manuellen Status).
                      </p>
                    </div>
                  </div>
                  {form.trackInventory ? (
                    <>
                      <div className="space-y-2">
                        <Label className={adminUi.label}>
                          Lagerbestand (Anzahl)
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={form.stockQuantity ?? 0}
                          onChange={(e) =>
                            updateField(
                              "stockQuantity",
                              Math.max(0, Math.floor(Number(e.target.value) || 0))
                            )
                          }
                          className={adminUi.input}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className={adminUi.label}>
                          Schwellenwert «Fast ausverkauft»
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={
                            form.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD
                          }
                          onChange={(e) =>
                            updateField(
                              "lowStockThreshold",
                              Math.max(0, Math.floor(Number(e.target.value) || 0))
                            )
                          }
                          className={adminUi.input}
                        />
                        <p className={cn("text-xs", adminUi.muted)}>
                          Default {DEFAULT_LOW_STOCK_THRESHOLD} Stk. — Warnt auf der
                          Produktdetailseite.
                        </p>
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label className={adminUi.label}>
                          Status bei Bestand 0
                        </Label>
                        <Select
                          value={form.zeroStockBehavior ?? "sold_out"}
                          onValueChange={(value) =>
                            updateField(
                              "zeroStockBehavior",
                              value as ProductZeroStockBehavior
                            )
                          }
                        >
                          <SelectTrigger className={adminUi.select}>
                            <SelectValue placeholder="Verhalten wählen" />
                          </SelectTrigger>
                          <SelectContent>
                            {ZERO_STOCK_BEHAVIOR_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className={cn("text-xs", adminUi.muted)}>
                          «Vorbestellung erlaubt» lässt den Kauf zu und ändert den
                          Button-Text im Shop.
                        </p>
                      </div>
                    </>
                  ) : null}
                </div>
              </ProductEditAccordion>

              {form.sale && (
                <ProductEditAccordion
                  title="Sale-Rabatt"
                  open={Boolean(openSections.sale)}
                  onToggle={() => toggleSection("sale")}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className={adminUi.label}>Rabatt-Typ</Label>
                      <select
                        value={form.saleRabattTyp ?? "percent"}
                        onChange={(e) =>
                          updateField(
                            "saleRabattTyp",
                            e.target.value as SaleRabattTyp
                          )
                        }
                        className={cn("h-10 w-full rounded-md border px-3 text-sm", adminUi.select)}
                      >
                        <option value="percent">Prozent (%)</option>
                        <option value="fixed">Fixer Betrag (CHF)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className={adminUi.label}>Rabatt-Wert</Label>
                      <Input
                        type="number"
                        step={form.saleRabattTyp === "fixed" ? "0.01" : "1"}
                        min="0"
                        value={formatOptionalNumber(form.saleRabattWert)}
                        onChange={(e) =>
                          updateField(
                            "saleRabattWert",
                            parseOptionalNumber(e.target.value) ?? undefined
                          )
                        }
                        placeholder={
                          form.saleRabattTyp === "fixed" ? "5.00" : "10"
                        }
                        className={adminUi.input}
                      />
                    </div>
                  </div>
                  {salePreview?.validation ? (
                    <p className="text-xs text-red-600 dark:text-red-400">{salePreview.validation}</p>
                  ) : salePreview?.endpreis != null ? (
                    <p className={cn("text-xs", adminUi.muted)}>
                      Vorschau Shop-Preis: CHF {salePreview.endpreis.toFixed(2)} statt CHF{" "}
                      {salePreview.basis.toFixed(2)}
                    </p>
                  ) : null}
                </ProductEditAccordion>
              )}

              <ProductEditAccordion
                title="Mengenrabatt (Staffelpreise)"
                open={Boolean(openSections.quantityDiscount)}
                onToggle={() => toggleSection("quantityDiscount")}
              >
                <p className={cn("text-xs", adminUi.muted)}>
                  Rabatt greift ab der angegebenen Stückzahl — auch wenn der Kunde
                  dasselbe Produkt in verschiedenen Farben/Varianten wählt
                  (Summe zählt).
                </p>
                <div className="space-y-3">
                  {(form.quantityDiscountTiers ?? []).map((tier, index) => (
                    <div
                      key={`qty-tier-${index}`}
                      className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"
                    >
                      <div className="space-y-1.5">
                        <Label className={cn("text-xs", adminUi.labelMuted)}>
                          Ab Stückzahl
                        </Label>
                        <Input
                          type="number"
                          min={2}
                          step={1}
                          value={formatOptionalNumber(tier.minQty)}
                          onChange={(e) => {
                            const n = parseOptionalInt(e.target.value)
                            const next = [
                              ...(form.quantityDiscountTiers ?? []),
                            ] as QuantityDiscountTier[]
                            next[index] = {
                              ...next[index],
                              minQty:
                                n ??
                                (undefined as unknown as QuantityDiscountTier["minQty"]),
                            }
                            updateField("quantityDiscountTiers", next)
                          }}
                          className={adminUi.input}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className={cn("text-xs", adminUi.labelMuted)}>
                          Rabatt (%)
                        </Label>
                        <Input
                          type="number"
                          min={0.1}
                          max={90}
                          step={0.5}
                          value={formatOptionalNumber(tier.discountPercent)}
                          onChange={(e) => {
                            const n = parseOptionalNumber(e.target.value)
                            const next = [
                              ...(form.quantityDiscountTiers ?? []),
                            ] as QuantityDiscountTier[]
                            next[index] = {
                              ...next[index],
                              discountPercent:
                                n ??
                                (undefined as unknown as QuantityDiscountTier["discountPercent"]),
                            }
                            updateField("quantityDiscountTiers", next)
                          }}
                          className={adminUi.input}
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-10 px-2 text-red-600 hover:text-red-500"
                        onClick={() => {
                          const next = (form.quantityDiscountTiers ?? []).filter(
                            (_, i) => i !== index
                          )
                          updateField("quantityDiscountTiers", next)
                        }}
                        aria-label="Staffel entfernen"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const existing = form.quantityDiscountTiers ?? []
                      const lastMin = existing[existing.length - 1]?.minQty ?? 3
                      updateField("quantityDiscountTiers", [
                        ...existing,
                        {
                          minQty:
                            existing.length === 0
                              ? 5
                              : Math.max(2, lastMin + 2),
                          discountPercent: existing.length === 0 ? 10 : 15,
                        },
                      ])
                    }}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Staffel hinzufügen
                  </Button>
                </div>
              </ProductEditAccordion>

              <ProductEditAccordion
                title="Shop-Tags"
                open={Boolean(openSections.tags)}
                onToggle={() => toggleSection("tags")}
              >
                <p className={cn("text-xs", adminUi.muted)}>
                  Tags steuern die Filter-Kategorien im Shop (Mehrfachauswahl möglich).
                </p>
                <AdminProductTagCheckboxes
                  tags={productTags}
                  selectedTagIds={form.tags ?? []}
                  onChange={(tagIds) => updateField("tags", tagIds)}
                  onTagsChange={setProductTags}
                />
              </ProductEditAccordion>

              {(form.type === "3d" || form.type === "laser") && (
                <ProductEditAccordion
                  title={
                    form.type === "laser"
                      ? "Masse & Gewicht (Versand)"
                      : "Feste Masse"
                  }
                  open={Boolean(openSections.dimensions)}
                  onToggle={() => toggleSection("dimensions")}
                >
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(["length", "width", "height"] as const).map((axis, i) => (
                      <div key={axis} className="space-y-1.5">
                        <Label className={cn("text-xs", adminUi.labelMuted)}>
                          {["Länge", "Breite", "Höhe"][i]} (mm)
                        </Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={formatOptionalNumber(form.dimensionsMm?.[axis])}
                          onChange={(e) => {
                            const n = parseOptionalNumber(e.target.value)
                            updateField("dimensionsMm", {
                              length: form.dimensionsMm?.length ?? 0,
                              width: form.dimensionsMm?.width ?? 0,
                              height: form.dimensionsMm?.height ?? 0,
                              [axis]:
                                n ??
                                (undefined as unknown as number),
                            })
                          }}
                          className={adminUi.input}
                        />
                      </div>
                    ))}
                  </div>
                  {form.type === "3d" && (
                    <AdminRotationPreview
                      rotation={form.defaultRotationDeg}
                      modelUrl={
                        form.modellDateiUrl || form.modelUrl || null
                      }
                      onChange={(next) => updateField("defaultRotationDeg", next)}
                    />
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className={cn("text-xs", adminUi.labelMuted)}>Gewicht (g)</Label>
                      <Input
                        type="number"
                        value={formatOptionalNumber(form.gewicht)}
                        onChange={(e) =>
                          updateField(
                            "gewicht",
                            parseOptionalNumber(e.target.value) ?? undefined
                          )
                        }
                        className={adminUi.input}
                      />
                    </div>
                    {form.type === "3d" ? (
                      <div className="space-y-1.5">
                        <Label className={cn("text-xs", adminUi.labelMuted)}>Volumen (cm³)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={formatOptionalNumber(form.volumen)}
                          onChange={(e) =>
                            updateField(
                              "volumen",
                              parseOptionalNumber(e.target.value) ?? undefined
                            )
                          }
                          className={adminUi.input}
                        />
                      </div>
                    ) : (
                      <p className={cn("text-xs sm:pt-6", adminUi.muted)}>
                        Masse und Gewicht steuern die dynamische Versandberechnung
                        im Checkout.
                      </p>
                    )}
                  </div>
                  {form.type === "3d" && (
                    <div className="mt-4 space-y-2">
                      <Label className={adminUi.label}>Gesamte Druckzeit</Label>
                      <p className={cn("text-xs", adminUi.muted)}>
                        Intern für Admins — optional. Bei STL-Upload werden Masse,
                        Volumen und Gewicht automatisch vorausgefüllt.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className={cn("text-xs", adminUi.labelMuted)}>
                            Stunden
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={
                              form.printTimeMinutes == null
                                ? ""
                                : formatOptionalNumber(
                                    Math.floor(form.printTimeMinutes / 60)
                                  )
                            }
                            onChange={(e) => {
                              const parsed = parseOptionalInt(e.target.value)
                              const minutes =
                                form.printTimeMinutes != null
                                  ? form.printTimeMinutes % 60
                                  : 0
                              if (parsed === null) {
                                updateField(
                                  "printTimeMinutes",
                                  minutes > 0 ? minutes : undefined
                                )
                                return
                              }
                              const hours = Math.max(0, parsed)
                              const total = hours * 60 + minutes
                              updateField(
                                "printTimeMinutes",
                                total > 0 ? total : undefined
                              )
                            }}
                            className={adminUi.input}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className={cn("text-xs", adminUi.labelMuted)}>
                            Minuten
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            max={59}
                            step={1}
                            value={
                              form.printTimeMinutes == null
                                ? ""
                                : formatOptionalNumber(form.printTimeMinutes % 60)
                            }
                            onChange={(e) => {
                              const parsed = parseOptionalInt(e.target.value)
                              const hours =
                                form.printTimeMinutes != null
                                  ? Math.floor(form.printTimeMinutes / 60)
                                  : 0
                              if (parsed === null) {
                                updateField(
                                  "printTimeMinutes",
                                  hours > 0 ? hours * 60 : undefined
                                )
                                return
                              }
                              const minutes = Math.min(59, Math.max(0, parsed))
                              const total = hours * 60 + minutes
                              updateField(
                                "printTimeMinutes",
                                total > 0 ? total : undefined
                              )
                            }}
                            className={adminUi.input}
                          />
                        </div>
                      </div>
                      <div
                        className={cn(
                          "flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5",
                          adminUi.cardMuted
                        )}
                      >
                        <div>
                          <Label className={adminUi.label}>
                            Druckzeit im Shop anzeigen
                          </Label>
                          <p className={cn("mt-0.5 text-xs", adminUi.muted)}>
                            Standard aus — Kunden sehen die Druckzeit erst nach
                            Aktivierung.
                          </p>
                        </div>
                        <Switch
                          checked={Boolean(form.printTimeShowInShop)}
                          onCheckedChange={(checked) =>
                            updateField("printTimeShowInShop", checked)
                          }
                        />
                      </div>
                      {stlAnalyzing && (
                        <p className={cn("flex items-center gap-2 text-xs", adminUi.muted)}>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          STL wird analysiert (Masse / Volumen / Gewicht)…
                        </p>
                      )}
                    </div>
                  )}
                </ProductEditAccordion>
              )}

              {form.type === "3d" && (
                <ProductEditAccordion
                  title="Farben & Mehrteiligkeit"
                  open={Boolean(openSections.colors)}
                  onToggle={() => toggleSection("colors")}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label className={adminUi.label}>Mehrfarbig / mehrteilig</Label>
                        <p className={cn("text-xs", adminUi.muted)}>
                          Kunde kann einzelnen Teilen Filamentfarben zuweisen.
                        </p>
                      </div>
                      <Switch
                        checked={Boolean(form.multiColorEnabled)}
                        onCheckedChange={(checked) =>
                          updateField("multiColorEnabled", checked)
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={cn("text-xs", adminUi.labelMuted)}>
                        Standard-Farbe (Name)
                      </Label>
                      <Input
                        value={
                          defaultColorDraft ??
                          (form.defaultFilamentColorName ?? "")
                        }
                        onChange={(e) => setDefaultColorDraft(e.target.value)}
                        onBlur={commitDefaultColorDraft}
                        placeholder="z. B. Ash Gray"
                        className={adminUi.input}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={cn("text-xs", adminUi.labelMuted)}>
                        Teil-Bezeichnungen (kommagetrennt)
                      </Label>
                      <Input
                        value={
                          partLabelsDraft ??
                          (form.partLabels ?? []).join(", ")
                        }
                        onChange={(e) => setPartLabelsDraft(e.target.value)}
                        onBlur={commitPartLabelsDraft}
                        placeholder="z. B. Rücken, Körper, Pfoten"
                        className={adminUi.input}
                      />
                      <p className={cn("text-xs", adminUi.muted)}>
                        Kommas und Leerzeichen sind erlaubt — z. B.
                        «Rücken, Körper, Pfoten».
                      </p>
                    </div>

                    <div className="space-y-2 border-t border-border/50 pt-3">
                      <Label className={adminUi.label}>
                        Druckbare Material-Arten
                      </Label>
                      <p className={cn("text-xs", adminUi.muted)}>
                        Nur aktivierte Arten erscheinen als Tabs (PLA / PETG / …)
                        auf der Produktdetailseite. Neue Produkte starten mit allen
                        aktiven Arten; danach speichert die Auswahl explizit.
                      </p>
                      <div className="space-y-2">
                        {getActiveMaterialTypes(filamentMaterialTypes).length ===
                        0 ? (
                          <p className={cn("text-xs", adminUi.muted)}>
                            Keine Material-Arten geladen — unter «Material-Arten»
                            pflegen.
                          </p>
                        ) : (
                          getActiveMaterialTypes(filamentMaterialTypes).map(
                            (type) => {
                              const activeIds =
                                form.allowedFilamentMaterialTypeIds
                              const checked =
                                activeIds == null
                                  ? true
                                  : activeIds.includes(type.id)
                              return (
                                <div
                                  key={type.id}
                                  className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2"
                                >
                                  <div>
                                    <p className="text-sm font-medium">
                                      {type.name}
                                    </p>
                                    <p className={cn("text-xs", adminUi.muted)}>
                                      ID: {type.id}
                                    </p>
                                  </div>
                                  <Switch
                                    checked={checked}
                                    onCheckedChange={(on) => {
                                      const allIds = getActiveMaterialTypes(
                                        filamentMaterialTypes
                                      ).map((t) => t.id)
                                      const current =
                                        form.allowedFilamentMaterialTypeIds ==
                                        null
                                          ? [...allIds]
                                          : [
                                              ...(form.allowedFilamentMaterialTypeIds ??
                                                []),
                                            ]
                                      const next = on
                                        ? Array.from(
                                            new Set([...current, type.id])
                                          )
                                        : current.filter((id) => id !== type.id)
                                      updateField(
                                        "allowedFilamentMaterialTypeIds",
                                        next
                                      )
                                    }}
                                  />
                                </div>
                              )
                            }
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </ProductEditAccordion>
              )}

              {form.type === "laser" && (
                <ProductEditAccordion
                  title="Laser-Optionen"
                  open={Boolean(openSections.laser)}
                  onToggle={() => toggleSection("laser")}
                >
                  <div className="space-y-2">
                    <Label className={adminUi.label}>Lasermaterial (Lager)</Label>
                    {materialCatalog.length > 8 && (
                      <Input
                        value={laserMaterialFilter}
                        onChange={(e) => setLaserMaterialFilter(e.target.value)}
                        placeholder="Material filtern…"
                        className={cn("h-8", adminUi.input)}
                      />
                    )}
                    <Select
                      value={form.laserMaterialId ?? "wood"}
                      onValueChange={(value) =>
                        updateField("laserMaterialId", value as LaserMaterialId)
                      }
                    >
                      <SelectTrigger className={cn("w-full", adminUi.input)}>
                        <SelectValue placeholder="Lasermaterial wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredLaserMaterialOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                        {form.laserMaterialId &&
                        !laserMaterialOptions.some(
                          (o) => o.value === form.laserMaterialId
                        ) ? (
                          <SelectItem value={form.laserMaterialId}>
                            {form.laserMaterialId}
                          </SelectItem>
                        ) : null}
                      </SelectContent>
                    </Select>
                    <p className={cn("text-xs", adminUi.muted)}>
                      Optionen aus verwalteten Laser-Materialarten und Lagermaterialien
                      (Name — Farbe). Wird automatisch gesetzt, wenn unten ein
                      Lasermaterial verknüpft wird.
                    </p>
                  </div>
                </ProductEditAccordion>
              )}

              <ProductEditAccordion
                title="Varianten"
                open={Boolean(openSections.varianten)}
                onToggle={() => toggleSection("varianten")}
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className={adminUi.label}>Stichworte (Laser / Rohmaterial)</Label>
                    <Input
                      value={form.variantenText ?? ""}
                      onChange={(e) => updateField("variantenText", e.target.value)}
                      placeholder="z. B. Schwarz, Weiss, Rot"
                      className={adminUi.input}
                    />
                    <p className={cn("text-xs", adminUi.muted)}>
                      Kommagetrennt — für Laser-Auswahl und Rohmaterial-Links.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className={adminUi.label}>
                        Shop-Varianten (Preis / STL)
                      </Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={adminUi.outlineBtn}
                        onClick={() => {
                          const next = [
                            ...(form.shopVariants ?? []),
                            {
                              id: `sv-${Date.now().toString(36)}`,
                              name: "Neue Variante",
                              priceDelta: 0,
                            },
                          ]
                          updateField("shopVariants", next)
                        }}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Variante
                      </Button>
                    </div>
                    <p className={cn("text-xs", adminUi.muted)}>
                      Sets, Grössen, Stückzahlen — mit Aufpreis oder Festpreis.
                      STL-Override nur wenn gesetzt, sonst Produkt-Standard.
                    </p>
                    {(form.shopVariants ?? []).length === 0 ? (
                      <p className={cn("text-xs", adminUi.muted)}>
                        Noch keine Shop-Varianten.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {(form.shopVariants ?? []).map((variant, index) => (
                          <div
                            key={variant.id}
                            className="space-y-2 rounded-lg border border-border/60 p-3"
                          >
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Name</Label>
                                <Input
                                  value={variant.name}
                                  className={adminUi.input}
                                  onChange={(e) => {
                                    const next = [...(form.shopVariants ?? [])]
                                    next[index] = {
                                      ...variant,
                                      name: e.target.value,
                                    }
                                    updateField("shopVariants", next)
                                  }}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Festpreis CHF (optional)</Label>
                                <Input
                                  type="number"
                                  step="0.05"
                                  min={0}
                                  value={variant.price ?? ""}
                                  className={adminUi.input}
                                  placeholder="leer = Basis + Aufpreis"
                                  onChange={(e) => {
                                    const next = [...(form.shopVariants ?? [])]
                                    const raw = e.target.value
                                    next[index] = {
                                      ...variant,
                                      price:
                                        raw === ""
                                          ? undefined
                                          : Math.max(0, Number(raw) || 0),
                                    }
                                    updateField("shopVariants", next)
                                  }}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Aufpreis CHF</Label>
                                <Input
                                  type="number"
                                  step="0.05"
                                  value={formatOptionalNumber(variant.priceDelta)}
                                  className={adminUi.input}
                                  onChange={(e) => {
                                    const n = parseOptionalNumber(e.target.value)
                                    const next = [...(form.shopVariants ?? [])]
                                    next[index] = {
                                      ...variant,
                                      priceDelta:
                                        n ??
                                        (undefined as unknown as number),
                                    }
                                    updateField("shopVariants", next)
                                  }}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">STL-Override URL</Label>
                                <Input
                                  value={variant.modellDateiUrl ?? ""}
                                  className={adminUi.input}
                                  placeholder="leer = Standard-Modell"
                                  onChange={(e) => {
                                    const next = [...(form.shopVariants ?? [])]
                                    next[index] = {
                                      ...variant,
                                      modellDateiUrl: e.target.value.trim() || undefined,
                                    }
                                    updateField("shopVariants", next)
                                  }}
                                />
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className={adminUi.outlineBtn}
                                onClick={() => {
                                  const input = document.createElement("input")
                                  input.type = "file"
                                  input.accept = ".stl,.obj,.glb,.gltf,.3mf"
                                  input.onchange = () => {
                                    const file = input.files?.[0]
                                    if (!file) return
                                    void (async () => {
                                      const fd = new FormData()
                                      fd.append("file", file)
                                      fd.append("productId", form.id || "temp")
                                      fd.append("category", "model")
                                      const res = await fetch("/api/admin/upload", {
                                        method: "POST",
                                        credentials: "include",
                                        body: fd,
                                      })
                                      const data = (await res.json()) as {
                                        url?: string
                                        error?: string
                                      }
                                      if (!res.ok || !data.url) return
                                      const next = [...(form.shopVariants ?? [])]
                                      next[index] = {
                                        ...variant,
                                        modellDateiUrl: data.url,
                                      }
                                      updateField("shopVariants", next)
                                    })()
                                  }
                                  input.click()
                                }}
                              >
                                <Upload className="mr-1 h-3 w-3" />
                                STL hochladen
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  updateField(
                                    "shopVariants",
                                    (form.shopVariants ?? []).filter((_, i) => i !== index)
                                  )
                                }}
                              >
                                <Trash2 className="mr-1 h-3 w-3" />
                                Entfernen
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </ProductEditAccordion>

              <ProductEditAccordion
                title="Rohmaterial-Verknüpfung"
                open={Boolean(openSections.materials)}
                onToggle={() => toggleSection("materials")}
                headerRight={
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={adminUi.outlineBtn}
                    onClick={(e) => {
                      e.stopPropagation()
                      addMaterialLink()
                      setOpenSections((prev) => ({ ...prev, materials: true }))
                    }}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Link
                  </Button>
                }
              >
                <p className={cn("text-xs", adminUi.muted)}>
                  Verbrauch pro verkaufter Einheit in Gramm — wird bei Bestellung reserviert
                </p>

                {(form.materialLinks?.length ?? 0) === 0 ? (
                  <p className={cn("text-xs", adminUi.muted)}>
                    Kein Rohmaterial verknüpft.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {form.materialLinks!.map((link, index) => {
                      const selectedMaterial = materialCatalog.find(
                        (m) => m.id === link.materialId
                      )
                      const filteredMats = filteredMaterialCatalogForLink(index)
                      const linkOptions =
                        link.materialId &&
                        !filteredMats.some((m) => m.id === link.materialId) &&
                        selectedMaterial
                          ? [selectedMaterial, ...filteredMats]
                          : filteredMats
                      return (
                        <div
                          key={`mat-link-${index}`}
                          className={cn(
                            "grid gap-2 rounded-md border border-border/80 bg-muted/30 p-2 sm:grid-cols-2",
                            adminUi.section
                          )}
                        >
                          <div className="space-y-1 sm:col-span-2">
                            <Label className={cn("text-[11px]", adminUi.labelMuted)}>
                              Rohmaterial
                            </Label>
                            {materialCatalog.length > 6 && (
                              <Input
                                value={materialLinkFilters[index] ?? ""}
                                onChange={(e) =>
                                  setMaterialLinkFilters((prev) => ({
                                    ...prev,
                                    [index]: e.target.value,
                                  }))
                                }
                                placeholder="Suchen: ID, Name, Farbe, Typ…"
                                className={cn("h-7 text-xs", adminUi.input)}
                              />
                            )}
                            <Select
                              value={link.materialId || undefined}
                              onValueChange={(value) =>
                                updateMaterialLink(index, { materialId: value })
                              }
                            >
                              <SelectTrigger className={cn("h-8 w-full text-xs", adminUi.input)}>
                                <SelectValue placeholder="— Material wählen —" />
                              </SelectTrigger>
                              <SelectContent>
                                {linkOptions.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {materialSelectLabel(m)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className={cn("text-[11px]", adminUi.labelMuted)}>
                              Verbrauch (g / Stück)
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              value={link.consumptionGrams}
                              onChange={(e) =>
                                updateMaterialLink(index, {
                                  consumptionGrams: Math.max(
                                    0,
                                    Number(e.target.value) || 0
                                  ),
                                })
                              }
                              className={cn("h-8 text-xs", adminUi.input)}
                            />
                          </div>

                          {productVariantOptions.length > 0 ? (
                            <div className="space-y-1">
                              <Label className={cn("text-[11px]", adminUi.labelMuted)}>
                                Produktvariante (optional)
                              </Label>
                              <Select
                                value={link.productVariant || "__all__"}
                                onValueChange={(value) =>
                                  updateMaterialLink(index, {
                                    productVariant:
                                      value === "__all__" ? undefined : value,
                                  })
                                }
                              >
                                <SelectTrigger className={cn("h-8 w-full text-xs", adminUi.input)}>
                                  <SelectValue placeholder="Alle Varianten" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__all__">Alle Varianten</SelectItem>
                                  {productVariantOptions.map((v) => (
                                    <SelectItem key={v} value={v}>
                                      {v}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : null}

                          {selectedMaterial && (
                            <p className={cn("text-[11px] leading-snug sm:col-span-2", adminUi.muted)}>
                              → {materialLabel(selectedMaterial)}
                              {(() => {
                                const line = pricingBreakdown.lines.find(
                                  (entry) =>
                                    entry.link.materialId === link.materialId &&
                                    entry.link.consumptionGrams === link.consumptionGrams &&
                                    (entry.link.productVariant ?? "") ===
                                      (link.productVariant ?? "")
                                )
                                return line ? ` · ${line.detail}` : ""
                              })()}
                            </p>
                          )}

                          <div className="sm:col-span-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className={cn("h-7 px-2 text-xs hover:text-red-300", adminUi.muted)}
                              onClick={() => removeMaterialLink(index)}
                            >
                              <X className="mr-1 h-3 w-3" />
                              Entfernen
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </ProductEditAccordion>

              <ProductEditAccordion
                title="Kalkulation / Preise"
                open={Boolean(openSections.pricing)}
                onToggle={() => toggleSection("pricing")}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <h4 className={cn("text-sm font-semibold", adminUi.accentTitle)}>
                        Kalkulationsbasis (EK)
                      </h4>
                      <p className={cn("text-xs", adminUi.muted)}>
                        Materialkosten aus verknüpften Lagerartikeln plus Zusatzkosten.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className={adminUi.label}>Materialkosten</Label>
                      {(form.materialLinks?.length ?? 0) === 0 ? (
                        <p className={cn("text-xs", adminUi.muted)}>
                          Keine Rohmaterial-Verknüpfung — Materialkosten CHF 0.00
                        </p>
                      ) : pricingBreakdown.lines.length === 0 ? (
                        <p className={cn("text-xs", adminUi.muted)}>
                          Materialien wählen und Verbrauch angeben.
                        </p>
                      ) : (
                        <ul className="space-y-1.5 text-xs tabular-nums">
                          {pricingBreakdown.lines.map((line, lineIndex) => (
                            <li key={`cost-${lineIndex}`} className={adminUi.muted}>
                              <span className={cn("font-medium", adminUi.accentTitle)}>
                                {line.label}
                              </span>
                              <br />
                              {line.detail}
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className={cn("text-sm font-medium tabular-nums", adminUi.accentTitle)}>
                        Summe Material: CHF {pricingBreakdown.materialCostChf.toFixed(2)}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className={adminUi.label}>Zusätzliche Basiskosten (CHF)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formatOptionalNumber(form.additionalBaseCostChf)}
                        onChange={(e) =>
                          updateField(
                            "additionalBaseCostChf",
                            parseOptionalNumber(e.target.value) ?? undefined
                          )
                        }
                        placeholder="Strom, Verschleiss, Verpackung…"
                        className={adminUi.input}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className={adminUi.label}>Gesamte Selbstkosten (EK)</Label>
                      <Input
                        type="text"
                        readOnly
                        value={`CHF ${pricingBreakdown.totalSelfCostChf.toFixed(2)}`}
                        className={cn(adminUi.input, "font-semibold tabular-nums opacity-90")}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h4 className={cn("text-sm font-semibold", adminUi.accentTitle)}>
                        Verkaufspreis & Marge
                      </h4>
                      <p className={cn("text-xs", adminUi.muted)}>
                        Verkaufspreis vor Sale-Rabatt — nicht im Shop sichtbar: EK-Kalkulation.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className={adminUi.label}>Verkaufspreis (CHF)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formatOptionalNumber(form.basisPreis)}
                        onChange={(e) =>
                          updateField(
                            "basisPreis",
                            parseOptionalNumber(e.target.value) ?? undefined
                          )
                        }
                        className={adminUi.input}
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className={adminUi.label}>Faktor (Aufschlag)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          value={
                            marginPreview?.markupFactor != null
                              ? marginPreview.markupFactor
                              : ""
                          }
                          placeholder="z. B. 3"
                          onChange={(e) => {
                            const factor = Number(e.target.value)
                            if (factor > 0) applyMarkupFactor(factor)
                          }}
                          className={adminUi.input}
                        />
                        <p className={cn("text-xs", adminUi.muted)}>VK = EK × Faktor</p>
                      </div>
                      <div className="space-y-2">
                        <Label className={adminUi.label}>Gewünschte Marge (%)</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="99.9"
                          value={
                            marginPreview?.marginPercent != null
                              ? marginPreview.marginPercent
                              : ""
                          }
                          placeholder="z. B. 70"
                          onChange={(e) => {
                            const margin = Number(e.target.value)
                            if (Number.isFinite(margin) && margin >= 0 && margin < 100) {
                              applyTargetMargin(margin)
                            }
                          }}
                          className={adminUi.input}
                        />
                        <p className={cn("text-xs", adminUi.muted)}>Bruttomarge auf VK</p>
                      </div>
                    </div>

                    {marginPreview && (
                      <div
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm tabular-nums",
                          adminUi.section
                        )}
                      >
                        <p className={marginToneClass(marginPreview.marginPercent)}>
                          Bruttogewinn: CHF {marginPreview.profit.toFixed(2)}
                          {marginPreview.marginPercent != null &&
                            ` (${marginPreview.marginPercent.toFixed(1)} % Marge)`}
                        </p>
                        {marginPreview.marginPercent != null &&
                          marginPreview.marginPercent >= 60 && (
                            <p className={cn("text-xs", adminUi.muted)}>
                              Zielmarge erreicht (≥ 60 %)
                            </p>
                          )}
                      </div>
                    )}
                  </div>
                </div>
              </ProductEditAccordion>

              <ProductEditAccordion
                title="Medien & Dateien"
                open={Boolean(openSections.media)}
                onToggle={() => toggleSection("media")}
              >
                <div className="space-y-2">
                  <Label className={adminUi.label}>Bildergalerie (Shop-Vorschau)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="https://… Bild-URL"
                      className={adminUi.input}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className={adminUi.outlineBtn}
                      onClick={addImageUrl}
                    >
                      URL
                    </Button>
                  </div>
                  <Input
                    type="file"
                    multiple
                    accept="image/*"
                    disabled={uploadingMedia === "gallery"}
                    onChange={(e) => void handleGalleryUpload(e)}
                    className={adminUi.fileInput}
                  />
                  {uploadingMedia === "gallery" && (
                    <p className={cn("flex items-center gap-2 text-xs", adminUi.muted)}>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Galerie wird hochgeladen…
                    </p>
                  )}
                  {(form.galerieBilder?.length ?? 0) > 0 && (
                    <AdminGallerySortable
                      images={form.galerieBilder!}
                      onChange={(next) => updateField("galerieBilder", next)}
                    />
                  )}
                  <div className="space-y-1 pt-2">
                    <Label className={adminUi.label}>Anzeigeform im Shop</Label>
                    <select
                      value={form.imageShape ?? "rounded"}
                      onChange={(e) =>
                        updateField(
                          "imageShape",
                          e.target.value as "rounded" | "square" | "circle"
                        )
                      }
                      className={cn("h-10 w-full rounded-md border px-3 text-sm", adminUi.select)}
                    >
                      <option value="rounded">Abgerundete Ecken (Standard)</option>
                      <option value="square">Quadratisch (scharfe Kanten)</option>
                      <option value="circle">Rund (Circle)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className={adminUi.label}>
                    Individualisierungs-Vorlage (Hintergrund Laser/Vorschau)
                  </Label>
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={uploadingMedia === "customization"}
                    onChange={(e) => void handleCustomizationUpload(e)}
                    className={adminUi.fileInput}
                  />
                  {uploadingMedia === "customization" && (
                    <p className={cn("flex items-center gap-2 text-xs", adminUi.muted)}>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Vorlage wird hochgeladen…
                    </p>
                  )}
                  {form.individualisierungsBild && (
                    <div className="flex flex-wrap items-start gap-3 pt-1">
                      <div className={cn("h-16 w-16 shrink-0 overflow-hidden rounded-lg border", adminUi.thumbnail)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={form.individualisierungsBild}
                          alt="Individualisierungs-Vorlage"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <AdminImageCropDialog
                          imageUrl={form.individualisierungsBild}
                          onCropped={applyCustomizationCrop}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className={cn("hover:text-red-300", adminUi.muted)}
                          onClick={() => updateField("individualisierungsBild", "")}
                        >
                          <X className="mr-1 h-3 w-3" />
                          Entfernen
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className={adminUi.label}>3D-Datei / Modell</Label>
                  <Input
                    type="file"
                    accept={MODEL_FILE_ACCEPT}
                    disabled={uploadingMedia === "model"}
                    onChange={(e) => void handleModelUpload(e)}
                    className={adminUi.fileInput}
                  />
                  <p className={cn("text-xs", adminUi.muted)}>
                    Erlaubt: .stl, .obj, .glb, .gltf — STL füllt Masse, Volumen und
                    Gewicht automatisch (wie Custom-Upload).
                  </p>
                  {(uploadingMedia === "model" || stlAnalyzing) && (
                    <p className={cn("flex items-center gap-2 text-xs", adminUi.muted)}>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {stlAnalyzing
                        ? "STL wird analysiert…"
                        : "3D-Datei wird hochgeladen…"}
                    </p>
                  )}
                  {form.modellDateiUrl && (
                    <div
                      className={cn(
                        "flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                        adminUi.cardMuted,
                        adminUi.muted
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {filenameFromUrl(form.modellDateiUrl)}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 shrink-0 gap-1 text-xs"
                        asChild
                      >
                        <a
                          href={form.modellDateiUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                        >
                          <ExternalLink className="h-3 w-3" />
                          STL öffnen / herunterladen
                        </a>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className={cn("shrink-0 hover:text-red-300", adminUi.muted)}
                        onClick={() => updateField("modellDateiUrl", "")}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </ProductEditAccordion>

            <Button
              type="button"
              onClick={() => void saveProduct()}
              disabled={saving}
              className={cn("w-full", adminUi.primaryBtn)}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Speichern
            </Button>
            {saveSuccess ? (
              <p
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300"
                role="status"
              >
                {saveSuccess}
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardPromptOpen} onOpenChange={setDiscardPromptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fenster schliessen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchtest du das Fenster wirklich schließen? Ungespeicherte Änderungen
              gehen verloren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex-col sm:space-x-0 gap-2 sm:items-stretch">
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDiscardPromptOpen(false)
                closeEditor()
              }}
            >
              Nicht speichern
            </Button>
            <AlertDialogAction
              className={adminUi.primaryBtn}
              onClick={(e) => {
                e.preventDefault()
                setDiscardPromptOpen(false)
                void saveProduct()
              }}
            >
              Speichern
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
