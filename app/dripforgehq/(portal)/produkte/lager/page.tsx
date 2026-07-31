import type { Metadata } from "next"
import { AdminInventoryPage } from "@/components/admin/admin-inventory-page"

export const metadata: Metadata = {
  title: "Lagerverwaltung | DripForge HQ",
  robots: { index: false, follow: false },
}

export default function AdminLagerPage() {
  return <AdminInventoryPage />
}
