"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import type { AdminProduct } from "@/lib/admin/types"
import { formatVariantenForAdmin } from "@/lib/dripforge/product-varianten"
import {
  calculateSalePrice,
  inferSaleRabattFromProduct,
  resolveProductBasisPreis,
  validateSaleDiscount,
  type SaleRabattTyp,
} from "@/lib/dripforge/product-sale"
import type { LaserMaterialId, Product } from "@/lib/dripforge/types"
import type { MaterialItem, ProductMaterialLink } from "@/lib/admin/material-types"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

type ProductFormState = Partial<AdminProduct> & {
  variantenText?: string
  basisPreis?: number
}

const EMPTY_FORM: ProductFormState = {
  id: "",
  name: "",
  description: "",
  basisPreis: 0,
  price: 0,
  originalPrice: null,
  type: "3d",
  sale: false,
  saleRabattTyp: "percent",
  saleRabattWert: 10,
  istAktiv: true,
  laserMaterialId: "wood",
  dimensionsMm: { length: 100, width: 100, height: 100 },
  volumen: 0,
  gewicht: 0,
  galerieBilder: [],
  individualisierungsBild: "",
  modellDateiUrl: "",
  variantenText: "",
  materialLinks: [],
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

function materialLabel(item: MaterialItem, variantId?: string): string {
  if (!variantId) return item.name
  const variant = item.variants.find((v) => v.id === variantId)
  return variant?.farbe ? `${item.name} — ${variant.farbe}` : item.name
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

  const loadMaterials = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/materials", {
        credentials: "include",
        cache: "no-store",
      })
      const data = await res.json()
      if (res.ok) setMaterialCatalog(data.materials ?? [])
    } catch {
      /* optional for product editor */
    }
  }, [])

  const closeEditor = () => {
    setIsEditing(false)
    setForm(EMPTY_FORM)
    setImageUrlInput("")
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

  useEffect(() => {
    void loadProducts()
    void loadMaterials()
  }, [loadProducts, loadMaterials])

  const startCreate = () => {
    setForm({
      ...EMPTY_FORM,
      id: `p-${Date.now()}`,
    })
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
      galerieBilder: product.galerieBilder ?? product.images ?? [],
      individualisierungsBild: product.individualisierungsBild ?? "",
      modellDateiUrl: product.modellDateiUrl ?? product.modelUrl ?? "",
      variantenText: formatVariantenForAdmin(product.varianten ?? []),
      materialLinks: product.materialLinks ?? [],
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

  const productVariantOptions = useMemo(() => {
    const fromText = (form.variantenText ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    return fromText
  }, [form.variantenText])

  const updateMaterialLink = (
    index: number,
    patch: Partial<ProductMaterialLink>
  ) => {
    const links = [...(form.materialLinks ?? [])]
    const prev = links[index]
    const next = { ...prev, ...patch }
    if (patch.materialId !== undefined && patch.materialId !== prev.materialId) {
      next.variantId = undefined
    }
    links[index] = next
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

  const salePreview = useMemo(() => {
    const basis = Number(form.basisPreis) || 0
    if (!form.sale || basis <= 0) return null

    const typ = (form.saleRabattTyp ?? "percent") as SaleRabattTyp
    const wert = Number(form.saleRabattWert) || 0
    const validation = validateSaleDiscount(basis, typ, wert)
    const endpreis = validation ? null : calculateSalePrice(basis, typ, wert)

    return { basis, endpreis, validation }
  }, [form.basisPreis, form.sale, form.saleRabattTyp, form.saleRabattWert])

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
        body: JSON.stringify(form),
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
    if (!confirm("Produkt wirklich loeschen?")) return
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Loeschen fehlgeschlagen")
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
          <p className={cn("text-sm", adminUi.muted)}>{products.length} Produkte</p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={startCreate}
          className={adminUi.primaryBtn}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Neu
        </Button>
      </div>

      {error && !isEditing && <p className={adminUi.error}>{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => startEdit(product)}
            className={cn(
              "flex w-full items-start justify-between gap-3 rounded-xl border p-4 text-left transition-colors",
              form.id === product.id && isEditing
                ? adminUi.listItemActive
                : adminUi.listItem
            )}
          >
              <div>
                <p className={cn("font-semibold", adminUi.heading)}>{product.name}</p>
                <p className={cn("text-xs", adminUi.muted)}>
                  {product.type === "3d" ? "3D-Druck" : "Laser"} · CHF{" "}
                  {product.price.toFixed(2)}
                  {product.sale && product.originalPrice ? (
                    <span className={cn("ml-1 line-through", adminUi.tableCellMuted)}>
                      {product.originalPrice.toFixed(2)}
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="flex gap-1">
                {product.istAktiv === false && (
                  <Badge variant="outline" className={adminUi.badgeInactive}>
                    Inaktiv
                  </Badge>
                )}
                {product.sale && (
                  <Badge className="bg-orange-500/20 text-orange-300">Sale</Badge>
                )}
                <Pencil className={cn("h-4 w-4", adminUi.muted)} />
              </div>
          </button>
        ))}
      </div>

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
                  Loeschen
                </Button>
              )}
            </div>

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
                  <Label className={adminUi.label}>Basispreis (CHF)</Label>
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
                <div className="flex flex-wrap items-center gap-6 sm:col-span-2">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={Boolean(form.sale)}
                      onCheckedChange={(checked) => updateField("sale", checked)}
                    />
                    <Label className={adminUi.label}>Im Sale</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={form.istAktiv !== false}
                      onCheckedChange={(checked) => updateField("istAktiv", checked)}
                    />
                    <Label className={adminUi.label}>Produkt aktiv</Label>
                  </div>
                </div>

                {form.sale && (
                  <div className={cn("space-y-3 rounded-xl border p-4 sm:col-span-2", adminUi.section)}>
                    <h4 className={cn("text-sm font-semibold", adminUi.accentTitle)}>Sale-Rabatt</h4>
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
                  </div>
                )}
              </div>

              {form.type === "3d" && (
                <div className={cn("space-y-4 rounded-xl border p-4", adminUi.section)}>
                  <h4 className={cn("text-sm font-semibold", adminUi.accentTitle)}>
                    Feste Masse (Standard-Produkt)
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(["length", "width", "height"] as const).map((axis, i) => (
                      <div key={axis} className="space-y-1.5">
                        <Label className={cn("text-xs", adminUi.labelMuted)}>
                          {["Laenge", "Breite", "Hoehe"][i]} (mm)
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
                </div>
              )}

              {form.type === "laser" && (
                <div className={cn("space-y-4 rounded-xl border p-4", adminUi.section)}>
                  <h4 className={cn("text-sm font-semibold", adminUi.accentTitle)}>
                    Laser-Optionen
                  </h4>
                  <div className="space-y-2">
                    <Label className={adminUi.label}>Material-ID</Label>
                    <select
                      value={form.laserMaterialId ?? "wood"}
                      onChange={(e) =>
                        updateField(
                          "laserMaterialId",
                          e.target.value as LaserMaterialId
                        )
                      }
                      className={cn("h-10 w-full rounded-md border px-3 text-sm", adminUi.select)}
                    >
                      <option value="wood">Holz</option>
                      <option value="acrylic">Acryl</option>
                      <option value="stone">Schiefer</option>
                      <option value="leather">Leder</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className={adminUi.label}>
                      Varianten-Stichworte (mit Komma trennen)
                    </Label>
                    <Input
                      value={form.variantenText ?? ""}
                      onChange={(e) =>
                        updateField("variantenText", e.target.value)
                      }
                      placeholder="Echtleder Braun, Echtleder Schwarz"
                      className={adminUi.input}
                    />
                    <p className={cn("text-xs", adminUi.muted)}>
                      Leer lassen = keine Varianten-Box im Shop
                    </p>
                  </div>
                </div>
              )}

              <div className={cn("space-y-4 rounded-xl border p-4", adminUi.section)}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className={cn("text-sm font-semibold", adminUi.accentTitle)}>
                      Rohmaterial-Verknüpfung
                    </h4>
                    <p className={cn("text-xs", adminUi.muted)}>
                      Verbrauch pro verkaufter Einheit in Gramm — wird bei Bestellung reserviert
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={adminUi.outlineBtn}
                    onClick={addMaterialLink}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Link
                  </Button>
                </div>

                {(form.materialLinks?.length ?? 0) === 0 ? (
                  <p className={cn("text-xs", adminUi.muted)}>
                    Kein Rohmaterial verknüpft.
                  </p>
                ) : (
                  form.materialLinks!.map((link, index) => {
                    const selectedMaterial = materialCatalog.find(
                      (m) => m.id === link.materialId
                    )
                    return (
                      <div
                        key={`mat-link-${index}`}
                        className={cn(
                          "grid gap-3 rounded-lg border p-3 sm:grid-cols-2",
                          adminUi.section
                        )}
                      >
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className={cn("text-xs", adminUi.labelMuted)}>
                            Rohmaterial
                          </Label>
                          <select
                            value={link.materialId}
                            onChange={(e) =>
                              updateMaterialLink(index, { materialId: e.target.value })
                            }
                            className={cn(
                              "h-10 w-full rounded-md border px-3 text-sm",
                              adminUi.select
                            )}
                          >
                            <option value="">— Material wählen —</option>
                            {materialCatalog.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                                {m.category === "filament" ? " (Filament)" : m.category === "lasermaterial" ? " (Laser)" : ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedMaterial && selectedMaterial.variants.length > 0 && (
                          <div className="space-y-1.5 sm:col-span-2">
                            <Label className={cn("text-xs", adminUi.labelMuted)}>
                              Variante (Farbe)
                            </Label>
                            <select
                              value={link.variantId ?? ""}
                              onChange={(e) =>
                                updateMaterialLink(index, {
                                  variantId: e.target.value || undefined,
                                })
                              }
                              className={cn(
                                "h-10 w-full rounded-md border px-3 text-sm",
                                adminUi.select
                              )}
                            >
                              <option value="">— Gesamtbestand —</option>
                              {selectedMaterial.variants.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.farbe || v.id}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <Label className={cn("text-xs", adminUi.labelMuted)}>
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
                            className={adminUi.input}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className={cn("text-xs", adminUi.labelMuted)}>
                            Produktvariante (optional)
                          </Label>
                          {productVariantOptions.length > 0 ? (
                            <select
                              value={link.productVariant ?? ""}
                              onChange={(e) =>
                                updateMaterialLink(index, {
                                  productVariant: e.target.value || undefined,
                                })
                              }
                              className={cn(
                                "h-10 w-full rounded-md border px-3 text-sm",
                                adminUi.select
                              )}
                            >
                              <option value="">Alle Varianten</option>
                              {productVariantOptions.map((v) => (
                                <option key={v} value={v}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Input
                              value={link.productVariant ?? ""}
                              onChange={(e) =>
                                updateMaterialLink(index, {
                                  productVariant: e.target.value || undefined,
                                })
                              }
                              placeholder="z. B. Schwarz"
                              className={adminUi.input}
                            />
                          )}
                        </div>

                        {selectedMaterial && (
                          <p className={cn("text-xs sm:col-span-2", adminUi.muted)}>
                            → {materialLabel(selectedMaterial, link.variantId)}
                          </p>
                        )}

                        <div className="sm:col-span-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className={cn("hover:text-red-300", adminUi.muted)}
                            onClick={() => removeMaterialLink(index)}
                          >
                            <X className="mr-1 h-3 w-3" />
                            Verknüpfung entfernen
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className={cn("space-y-4 rounded-xl border p-4", adminUi.section)}>
                <h4 className={cn("text-sm font-semibold", adminUi.accentTitle)}>
                  Medien & Dateien
                </h4>

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
              </div>

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
