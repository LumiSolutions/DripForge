import type { Metadata } from "next"
import { AdminSettingsTab } from "@/components/admin/admin-settings-tab"

export const metadata: Metadata = {
  title: "Dienstleistungen | DripForge HQ",
  robots: { index: false, follow: false },
}

export default function AdminServicesPage() {
  return <AdminSettingsTab section="services" />
}
