import type { Metadata } from "next"
import { AdminDashboard } from "@/components/admin/admin-dashboard"

export const metadata: Metadata = {
  title: "DripForge Backoffice",
  description: "Internes DripForge Backoffice",
  robots: { index: false, follow: false },
}

export default function BackofficePage() {
  return <AdminDashboard />
}
