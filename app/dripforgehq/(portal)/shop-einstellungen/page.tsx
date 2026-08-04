import type { Metadata } from "next"
import { AdminSettingsTab } from "@/components/admin/admin-settings-tab"
import { AdminBrandLogosCard } from "@/components/admin/admin-brand-logos-card"

export const metadata: Metadata = {
  title: "Shop-Einstellungen | DripForge HQ",
  robots: { index: false, follow: false },
}

export default function AdminShopSettingsPage() {
  return (
    <div className="space-y-6">
      <AdminBrandLogosCard />
      <AdminSettingsTab section="shop" />
    </div>
  )
}
