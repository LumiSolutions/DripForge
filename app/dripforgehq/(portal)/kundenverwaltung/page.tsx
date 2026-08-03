"use client"

import { useRouter } from "next/navigation"
import { AdminCustomersTab } from "@/components/admin/admin-customers-tab"
import { AdminCustomerCategoriesCard } from "@/components/admin/admin-customer-categories-card"
import { adminRouteHref } from "@/lib/admin/admin-nav"

export default function AdminCustomersPage() {
  const router = useRouter()
  return (
    <div className="space-y-6">
      <AdminCustomerCategoriesCard />
      <AdminCustomersTab
        onOpenOrder={(orderId) => {
          router.push(
            `${adminRouteHref("belege")}?view=orders&order=${encodeURIComponent(orderId)}`
          )
        }}
      />
    </div>
  )
}
