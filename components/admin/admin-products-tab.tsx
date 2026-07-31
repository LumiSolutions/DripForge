"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Archive, ChevronDown, ChevronRight, Loader2, Plus, Save, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
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
import type { LaserMaterialId, Product } from "@/lib/dripforge/types"
import {
  buildLaserMaterialSelectOptions,
  resolveLaserMaterialIdFromStockItem,
} from "@/lib/dripforge/laser-material-options"
import type { LaserMaterialTypeDefinition } from "@/lib/admin/laser-material-types"
import type { MaterialItem, ProductMaterialLink } from "@/lib/admin/material-types"
import {
  calculateGrossMarginPercent,
  calculateMarkupFactor,
  calculateProductPricingBreakdown,
  salePriceFromMarkupFactor,
  salePriceFromTargetMarginPercent,
} from "@/lib/admin/material-pricing"
import { type ProductSortMode } from "@/lib/admin/list-sort-utils"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"
import {
  AdminProductTagCheckboxes,
  AdminProductTagsSection,
} from "@/components/admin/admin-product-tags-section"
import { AdminProductsListPanel } from "@/components/admin/admin-products-list-panel"
import type { ProductTag } from "@/lib/admin/product-tags"
import {
  getProductShopStatus,
  PRODUCT_SHOP_STATUS_OPTIONS,
  productFieldsFromShopStatus,
  type ProductShopStatus,
} from "@/lib/admin/product-status"

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
  materialLinks: [],
  tags: [],
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
  sale: false,
  tags: false,
  dimensions: false,
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
  const [productSort, setProductSort] = useState<ProductSortMode>("name-asc")
  const [productTags, setProductTags] = useState<ProductTag[]>([])
  const [laserMaterialFilter, setLaserMaterialFilter] = useState("")
  const [materialLinkFilters, setMaterialLinkFilters] = useState<Record<number, string>>(
    {}
  )
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    ...DEFAULT_PRODUCT_SECTIONS,
  })

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
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
      }
    } catch {
      /* optional for product editor */
    }
  }, [])

  const closeEditor = () => {
    setIsEditing(false)
    setForm(EMPTY_FORM)
    setImageUrlInput("")
    setLaserMaterialFilter("")
    setMaterialLinkFilters({})
    setOpenSections({ ...DEFAULT_PRODUCT_SECTIONS })
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
    setForm({
      ...EMPTY_FORM,
      id: `p-${Date.now()}`,
    })
    setLaserMaterialFilter("")
    setMaterialLinkFilters({})
    setOpenSections({ ...DEFAULT_PRODUCT_SECTIONS })
    setIsEditing(true)
  }

  const startEdit = (product: AdminProduct) => {
    const inferred = inferSaleRabattFromProduct(product)
    setForm({
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
      materialLinks: product.materialLinks ?? [],
      additionalBaseCostChf: product.additionalBaseCostChf ?? 0,
      purchasePriceChf: product.purchasePriceChf ?? 0,
      tags: product.tags ?? [],
    })
    setLaserMaterialFilter("")
    setMaterialLinkFilters({})
    setOpenSections({
      ...DEFAULT_PRODUCT_SECTIONS,
      sale: Boolean(product.sale),
    })
    setIsEditing(true)
  }

  const updateField = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
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
    } catch (err) {
      console.warn("Admin: 3D-Upload fehlgeschlagen.", err)
      setError(err instanceof Error ? err.message : "3D-Upload fehlgeschlagen.")
    } finally {
      setUploadingMedia(null)
    }
  }

  const removeGalleryImage = (index: number) => {
    const next = [...(form.galerieBilder ?? [])]
    next.splice(index, 1)
    updateField("galerieBilder", next)
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

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          purchasePriceChf: pricingBreakdown.totalSelfCostChf,
          additionalBaseCostChf: pricingBreakdown.additionalBaseCostChf,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")

      await loadProducts()
      closeEditor()
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
          if (!open) closeEditor()
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {products.some((p) => p.id === form.id)
                ? "Produkt bearbeiten"
                : "Neues Produkt"}
            </DialogTitle>
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
                  <div className="space-y-2 sm:col-span-2">
                    <Label className={adminUi.label}>Beschreibung</Label>
                    <Textarea
                      value={form.description ?? ""}
                      onChange={(e) => updateField("description", e.target.value)}
                      rows={3}
                      className={adminUi.input}
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
                        value={form.saleRabattWert ?? 0}
                        onChange={(e) =>
                          updateField("saleRabattWert", Number(e.target.value))
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
                />
              </ProductEditAccordion>

              {form.type === "3d" && (
                <ProductEditAccordion
                  title="Feste Masse"
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
                          value={form.dimensionsMm?.[axis] ?? 0}
                          onChange={(e) =>
                            updateField("dimensionsMm", {
                              ...form.dimensionsMm!,
                              [axis]: Number(e.target.value),
                            })
                          }
                          className={adminUi.input}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className={cn("text-xs", adminUi.labelMuted)}>Gewicht (g)</Label>
                      <Input
                        type="number"
                        value={form.gewicht ?? 0}
                        onChange={(e) =>
                          updateField("gewicht", Number(e.target.value))
                        }
                        className={adminUi.input}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={cn("text-xs", adminUi.labelMuted)}>Volumen (cm³)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={form.volumen ?? 0}
                        onChange={(e) =>
                          updateField("volumen", Number(e.target.value))
                        }
                        className={adminUi.input}
                      />
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
                <Input
                  value={form.variantenText ?? ""}
                  onChange={(e) => updateField("variantenText", e.target.value)}
                  placeholder="z. B. Schwarz, Weiss, Rot"
                  className={adminUi.input}
                />
                <p className={cn("text-xs", adminUi.muted)}>
                  Kommagetrennt — definiert Shop-Auswahl und Auswahl bei
                  Rohmaterial-Links. Leer = keine Varianten.
                </p>
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
                        value={form.additionalBaseCostChf ?? 0}
                        onChange={(e) =>
                          updateField("additionalBaseCostChf", Number(e.target.value))
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
                        value={form.basisPreis ?? 0}
                        onChange={(e) =>
                          updateField("basisPreis", Number(e.target.value))
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
                    <div className="flex flex-wrap gap-2 pt-1">
                      {form.galerieBilder!.map((url, index) => (
                        <div
                          key={`${url}-${index}`}
                          className={cn(
                            "group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border",
                            adminUi.thumbnail
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Galerie ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeGalleryImage(index)}
                            className="absolute right-0.5 top-0.5 rounded bg-black/70 p-0.5 text-zinc-200 opacity-0 transition-opacity group-hover:opacity-100"
                            aria-label="Bild entfernen"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
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
                    <div className="flex items-start gap-3 pt-1">
                      <div className={cn("h-16 w-16 shrink-0 overflow-hidden rounded-lg border", adminUi.thumbnail)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={form.individualisierungsBild}
                          alt="Individualisierungs-Vorlage"
                          className="h-full w-full object-cover"
                        />
                      </div>
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
                  )}
                </div>

                <div className="space-y-2">
                  <Label className={adminUi.label}>3D-Datei / Modell</Label>
                  <Input
                    type="file"
                    accept=".stl,.obj,.glb,.gltf"
                    disabled={uploadingMedia === "model"}
                    onChange={(e) => void handleModelUpload(e)}
                    className={adminUi.fileInput}
                  />
                  <p className={cn("text-xs", adminUi.muted)}>
                    Erlaubt: .stl, .obj, .glb, .gltf — fest mit dem Produkt verknuepft
                  </p>
                  {uploadingMedia === "model" && (
                    <p className={cn("flex items-center gap-2 text-xs", adminUi.muted)}>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      3D-Datei wird hochgeladen…
                    </p>
                  )}
                  {form.modellDateiUrl && (
                    <div className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-xs", adminUi.cardMuted, adminUi.muted)}>
                      <span className="truncate">
                        {filenameFromUrl(form.modellDateiUrl)}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className={cn("ml-auto shrink-0 hover:text-red-300", adminUi.muted)}
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
