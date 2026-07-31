"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AdminBelegeTab } from "@/components/admin/admin-belege-tab"
import { AdminOrdersTab } from "@/components/admin/admin-orders-tab"
import { adminRouteHref } from "@/lib/admin/admin-nav"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

type BelegeView = "dokumente" | "orders"

function AdminBelegePageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderParam = searchParams.get("order")?.trim() || null
  const view: BelegeView =
    searchParams.get("view") === "orders" || orderParam ? "orders" : "dokumente"
  const [highlightOrderId, setHighlightOrderId] = useState<string | null>(orderParam)

  // Sync highlight when URL order changes without cascading effect setState on mount
  const effectiveHighlight =
    highlightOrderId && orderParam === highlightOrderId
      ? highlightOrderId
      : orderParam

  const selectView = (next: BelegeView) => {
    const href =
      next === "orders"
        ? `${adminRouteHref("belege")}?view=orders`
        : adminRouteHref("belege")
    router.replace(href)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className={cn("text-xl font-bold", adminUi.heading)}>Belege</h2>
        <p className={cn("text-sm", adminUi.muted)}>
          Belege und Shop-Bestellungen zentral verwalten
        </p>
      </div>

      <div className={cn("flex flex-wrap gap-2 rounded-xl border p-2", adminUi.section)}>
        <button
          type="button"
          onClick={() => selectView("dokumente")}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            view === "dokumente" ? adminUi.navActive : adminUi.navInactive
          )}
        >
          Belege / Dokumente
        </button>
        <button
          type="button"
          onClick={() => selectView("orders")}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            view === "orders" ? adminUi.navActive : adminUi.navInactive
          )}
        >
          Shop-Bestellungen
        </button>
      </div>

      {view === "dokumente" ? (
        <AdminBelegeTab />
      ) : (
        <AdminOrdersTab
          highlightOrderId={effectiveHighlight}
          onHighlightConsumed={() => setHighlightOrderId(null)}
        />
      )}
    </div>
  )
}

export function AdminBelegePage() {
  return (
    <Suspense
      fallback={
        <div className={cn("py-12 text-center text-sm", adminUi.muted)}>
          Belege werden geladen…
        </div>
      }
    >
      <AdminBelegePageInner />
    </Suspense>
  )
}
