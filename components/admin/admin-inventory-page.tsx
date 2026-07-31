"use client"

import { useState } from "react"
import { AdminMaterialsTab } from "@/components/admin/admin-materials-tab"
import { AdminMaterialStatsSection } from "@/components/admin/admin-material-stats-section"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import type { MaterialCategory } from "@/lib/admin/material-types"
import { cn } from "@/lib/utils"

type InventorySubTab = MaterialCategory | "material-types"

const INVENTORY_SUB: { id: InventorySubTab; label: string }[] = [
  { id: "filament", label: "Filament-Lager" },
  { id: "material-types", label: "Material-Arten" },
  { id: "lasermaterial", label: "Lasermaterial" },
]

export function AdminInventoryPage() {
  const [inventorySub, setInventorySub] = useState<InventorySubTab>("filament")

  return (
    <div className="space-y-6">
      <div>
        <h2 className={cn("text-xl font-bold", adminUi.heading)}>Lagerverwaltung</h2>
        <p className={cn("text-sm", adminUi.muted)}>
          Filament, Lasermaterial und Material-Arten verwalten
        </p>
      </div>
      <div className={cn("flex flex-wrap gap-2 rounded-xl border p-2", adminUi.section)}>
        {INVENTORY_SUB.map((sub) => (
          <button
            key={sub.id}
            type="button"
            onClick={() => setInventorySub(sub.id)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              inventorySub === sub.id ? adminUi.navActive : adminUi.navInactive
            )}
          >
            {sub.label}
          </button>
        ))}
      </div>
      {inventorySub === "material-types" ? (
        <AdminMaterialStatsSection />
      ) : (
        <AdminMaterialsTab category={inventorySub} />
      )}
    </div>
  )
}
