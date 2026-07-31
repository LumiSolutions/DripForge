"use client"

import { useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"
import {
  createManagedCatalogItem,
  type ManagedCatalogItem,
  type ManagedCatalogKind,
} from "@/lib/dripforge/managed-catalog"

type EditDraft = {
  id: string
  label: string
  description: string
  featuresText: string
  showFeatures: boolean
}

function itemsOfKind(
  catalog: ManagedCatalogItem[],
  kind: ManagedCatalogKind
): ManagedCatalogItem[] {
  return catalog
    .filter((item) => item.kind === kind)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
}

export function AdminManagedCatalogSection({
  catalog,
  onChange,
}: {
  catalog: ManagedCatalogItem[]
  onChange: (next: ManagedCatalogItem[]) => void
}) {
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const services = itemsOfKind(catalog, "service")
  const configurators = itemsOfKind(catalog, "configurator")

  const updateItem = (id: string, patch: Partial<ManagedCatalogItem>) => {
    onChange(
      catalog.map((item) => (item.id === id ? { ...item, ...patch } : item))
    )
  }

  const addItem = (kind: ManagedCatalogKind) => {
    onChange([...catalog, createManagedCatalogItem(kind)])
  }

  const openEdit = (item: ManagedCatalogItem) => {
    setEditDraft({
      id: item.id,
      label: item.label,
      description: item.description,
      featuresText: (item.features ?? []).join(", "),
      showFeatures: item.kind === "service" && !item.system,
    })
  }

  const saveEdit = () => {
    if (!editDraft) return
    const features = editDraft.showFeatures
      ? editDraft.featuresText
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
      : undefined
    updateItem(editDraft.id, {
      label: editDraft.label.trim() || "Ohne Titel",
      description: editDraft.description.trim(),
      ...(editDraft.showFeatures ? { features } : {}),
    })
    setEditDraft(null)
  }

  const confirmDelete = () => {
    if (!deleteId) return
    const target = catalog.find((item) => item.id === deleteId)
    if (target && !target.system) {
      onChange(catalog.filter((item) => item.id !== deleteId))
    }
    setDeleteId(null)
  }

  const renderList = (
    items: ManagedCatalogItem[],
    emptyLabel: string
  ) => (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className={cn("text-sm", adminUi.muted)}>{emptyLabel}</p>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between",
              adminUi.section
            )}
          >
            <div className="min-w-0 flex-1 space-y-1 pr-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label className={cn("text-sm font-semibold", adminUi.heading)}>
                  {item.label}
                </Label>
                {item.system && (
                  <Badge variant="outline" className={cn("text-[10px]", adminUi.badgeOutline)}>
                    System
                  </Badge>
                )}
              </div>
              <p className={cn("text-xs", adminUi.muted)}>
                {item.description || "Keine Beschreibung"}
              </p>
              {item.kind === "service" &&
                !item.system &&
                (item.features?.length ?? 0) > 0 && (
                  <p className={cn("text-xs", adminUi.labelMuted)}>
                    Features: {item.features!.join(" · ")}
                  </p>
                )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={adminUi.outlineBtn}
                onClick={() => openEdit(item)}
              >
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Bearbeiten
              </Button>
              {!item.system && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(adminUi.outlineBtn, "text-red-600 dark:text-red-400")}
                  onClick={() => setDeleteId(item.id)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Löschen
                </Button>
              )}
              <Switch
                checked={item.enabled}
                onCheckedChange={(checked) =>
                  updateItem(item.id, { enabled: checked })
                }
              />
            </div>
          </div>
        ))
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h3 className={cn("text-base font-semibold", adminUi.accentTitle)}>
          Dienstleistungen auf der Website
        </h3>
        <p className={cn("mt-1 text-sm", adminUi.muted)}>
          Steuert Navigation, Startseite und Kacheln. System-Einträge können deaktiviert und
          umbenannt werden; eigene Einträge erscheinen zusätzlich unter «Unsere Möglichkeiten»
          auf der Laser-Seite.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={adminUi.outlineBtn}
          onClick={() => addItem("service")}
        >
          <Plus className="mr-1 h-4 w-4" />
          Dienstleistung hinzufügen
        </Button>
      </div>

      {renderList(services, "Noch keine Dienstleistungen.")}

      <div className="space-y-3 border-t pt-6">
        <div>
          <h4 className={cn("text-sm font-semibold", adminUi.heading)}>
            Konfigurator-Karten im Shop
          </h4>
          <p className={cn("mt-1 text-xs", adminUi.muted)}>
            Steuert die Sichtbarkeit der Karten unter «Erschaffen Sie etwas Einzigartiges» auf
            der Startseite und im Shop.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={adminUi.outlineBtn}
            onClick={() => addItem("configurator")}
          >
            <Plus className="mr-1 h-4 w-4" />
            Konfigurator hinzufügen
          </Button>
        </div>

        {renderList(configurators, "Noch keine Konfigurator-Karten.")}
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={adminUi.outlineBtn}
          onClick={() => addItem("service")}
        >
          <Plus className="mr-1 h-4 w-4" />
          Dienstleistung hinzufügen
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={adminUi.outlineBtn}
          onClick={() => addItem("configurator")}
        >
          <Plus className="mr-1 h-4 w-4" />
          Konfigurator hinzufügen
        </Button>
      </div>

      <Dialog open={Boolean(editDraft)} onOpenChange={(open) => !open && setEditDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Eintrag bearbeiten</DialogTitle>
            <DialogDescription>
              Label und Beschreibung anpassen
              {editDraft?.showFeatures
                ? "; Features als kommagetrennte Liste für die Laser-Seite."
                : "."}
            </DialogDescription>
          </DialogHeader>
          {editDraft && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="catalog-label" className={adminUi.label}>
                  Label
                </Label>
                <Input
                  id="catalog-label"
                  className={adminUi.input}
                  value={editDraft.label}
                  onChange={(e) =>
                    setEditDraft((prev) =>
                      prev ? { ...prev, label: e.target.value } : prev
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-description" className={adminUi.label}>
                  Beschreibung
                </Label>
                <Textarea
                  id="catalog-description"
                  className={cn(adminUi.input, "min-h-[88px]")}
                  value={editDraft.description}
                  onChange={(e) =>
                    setEditDraft((prev) =>
                      prev ? { ...prev, description: e.target.value } : prev
                    )
                  }
                />
              </div>
              {editDraft.showFeatures && (
                <div className="space-y-2">
                  <Label htmlFor="catalog-features" className={adminUi.label}>
                    Features (kommagetrennt)
                  </Label>
                  <Input
                    id="catalog-features"
                    className={adminUi.input}
                    placeholder="z. B. Präzision, Metall, Holz"
                    value={editDraft.featuresText}
                    onChange={(e) =>
                      setEditDraft((prev) =>
                        prev ? { ...prev, featuresText: e.target.value } : prev
                      )
                    }
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={adminUi.outlineBtn}
              onClick={() => setEditDraft(null)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              className={adminUi.primaryBtn}
              onClick={saveEdit}
            >
              Übernehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eintrag löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Eintrag wird aus dem Katalog entfernt. Die Änderung wird erst beim Speichern
              der Einstellungen dauerhaft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={confirmDelete}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
