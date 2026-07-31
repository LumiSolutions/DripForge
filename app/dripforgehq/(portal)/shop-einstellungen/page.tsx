import type { Metadata } from "next"
import { AdminSettingsTab } from "@/components/admin/admin-settings-tab"

export const metadata: Metadata = {
  title: "Shop-Einstellungen | DripForge HQ",
  robots: { index: false, follow: false },
}

export default function AdminShopSettingsPage() {
  return <AdminSettingsTab section="shop" />
}
