import type { Metadata } from "next"
import { AdminDashboard } from "@/components/admin/admin-dashboard"

export const metadata: Metadata = {
  title: "Admin | DripForge",
  description: "DripForge Admin-Dashboard — Bestellungen, Produkte, Einstellungen",
  robots: { index: false, follow: false },
}

export default function AdminPage() {
  return <AdminDashboard />
}
