import type { Metadata } from "next"
import { AdminSettingsTab } from "@/components/admin/admin-settings-tab"

export const metadata: Metadata = {
  title: "Support-Kampagne | DripForge HQ",
  robots: { index: false, follow: false },
}

export default function AdminSupportCampaignPage() {
  return <AdminSettingsTab section="support" />
}
