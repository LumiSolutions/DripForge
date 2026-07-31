import type { Metadata } from "next"
import { AdminAccountingTab } from "@/components/admin/admin-accounting-tab"
import { AdminSettingsTab } from "@/components/admin/admin-settings-tab"

export const metadata: Metadata = {
  title: "Buchhaltungseinstellungen | DripForge HQ",
  robots: { index: false, follow: false },
}

export default function AdminAccountingSettingsPage() {
  return (
    <div className="space-y-10">
      <AdminAccountingTab settingsOnly initialView="accounts" />
      <AdminSettingsTab section="accounting" />
    </div>
  )
}
