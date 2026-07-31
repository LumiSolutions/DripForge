import type { Metadata } from "next"
import { AdminProductionTab } from "@/components/admin/admin-production-tab"

export const metadata: Metadata = {
  title: "Produktionscockpit | DripForge HQ",
  robots: { index: false, follow: false },
}

export default function AdminProductionPage() {
  return <AdminProductionTab />
}
