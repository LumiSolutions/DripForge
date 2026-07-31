import type { Metadata } from "next"
import { AdminSettingsTab } from "@/components/admin/admin-settings-tab"

export const metadata: Metadata = {
  title: "Treuepunkte | DripForge HQ",
  robots: { index: false, follow: false },
}

export default function AdminLoyaltyPage() {
  return <AdminSettingsTab section="loyalty" />
}
