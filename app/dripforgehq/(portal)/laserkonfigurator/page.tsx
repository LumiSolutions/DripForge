import type { Metadata } from "next"
import { AdminSettingsTab } from "@/components/admin/admin-settings-tab"

export const metadata: Metadata = {
  title: "Laserkonfigurator | DripForge HQ",
  robots: { index: false, follow: false },
}

export default function AdminLaserConfiguratorPage() {
  return <AdminSettingsTab section="laser" />
}
