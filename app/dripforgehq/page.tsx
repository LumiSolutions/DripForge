import type { Metadata } from "next"
import { AdminDashboard } from "@/components/admin/admin-dashboard"

export const metadata: Metadata = {
  title: "DripForge HQ",
  description: "Internes DripForge Backoffice",
  robots: { index: false, follow: false },
}

export default function DripforgeHqPage() {
  return <AdminDashboard />
}
