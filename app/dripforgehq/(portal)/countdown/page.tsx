import type { Metadata } from "next"
import { AdminSettingsTab } from "@/components/admin/admin-settings-tab"

export const metadata: Metadata = {
  title: "Countdown | DripForge HQ",
  robots: { index: false, follow: false },
}

export default function AdminCountdownPage() {
  return <AdminSettingsTab section="countdown" />
}
