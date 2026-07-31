import type { Metadata } from "next"
import { AdminProductsTab } from "@/components/admin/admin-products-tab"

export const metadata: Metadata = {
  title: "Produkte | DripForge HQ",
  robots: { index: false, follow: false },
}

export default function AdminProductsPage() {
  return <AdminProductsTab />
}
