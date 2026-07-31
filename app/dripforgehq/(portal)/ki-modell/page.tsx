import type { Metadata } from "next"
import { AdminAiSettingsTab } from "@/components/admin/admin-ai-settings-tab"

export const metadata: Metadata = {
  title: "KI-Modell | DripForge HQ",
  robots: { index: false, follow: false },
}

export default function AdminAiModelPage() {
  return <AdminAiSettingsTab />
}
