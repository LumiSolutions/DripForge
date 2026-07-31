import type { Metadata } from "next"
import { AdminSettingsTab } from "@/components/admin/admin-settings-tab"

export const metadata: Metadata = {
  title: "E-Mail-Vorlagen | DripForge HQ",
  robots: { index: false, follow: false },
}

export default function AdminEmailTemplatesPage() {
  return <AdminSettingsTab section="email" />
}
