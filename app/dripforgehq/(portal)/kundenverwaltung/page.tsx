"use client"

import { useRouter } from "next/navigation"
import { AdminCustomersTab } from "@/components/admin/admin-customers-tab"
import { adminRouteHref } from "@/lib/admin/admin-nav"

export default function AdminCustomersPage() {
  const router = useRouter()
  return (
    <AdminCustomersTab
      onOpenOrder={(orderId) => {
        router.push(
          `${adminRouteHref("belege")}?view=orders&order=${encodeURIComponent(orderId)}`
        )
      }}
    />
  )
}
