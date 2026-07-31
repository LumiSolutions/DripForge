import type { Metadata } from "next"
import { AdminStatsTab } from "@/components/admin/admin-stats-tab"

export const metadata: Metadata = {
  title: "Dashboard | DripForge HQ",
  robots: { index: false, follow: false },
}

export default function AdminDashboardPage() {
  return <AdminStatsTab />
}
