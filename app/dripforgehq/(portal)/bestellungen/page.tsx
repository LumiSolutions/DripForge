import { redirect } from "next/navigation"
import { adminPortalPath } from "@/lib/admin/admin-portal-path"

/** Legacy-Route: Bestellungen sind unter Belege integriert. */
export default async function AdminOrdersLegacyRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const next = new URLSearchParams()
  next.set("view", "orders")
  const order = params.order
  if (typeof order === "string" && order.trim()) {
    next.set("order", order.trim())
  }
  redirect(`${adminPortalPath("/belege")}?${next.toString()}`)
}
