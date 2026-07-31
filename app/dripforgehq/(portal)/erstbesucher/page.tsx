import type { Metadata } from "next"
import { AdminSettingsTab } from "@/components/admin/admin-settings-tab"

export const metadata: Metadata = {
  title: "Erstbesucher Onboarding | DripForge HQ",
  robots: { index: false, follow: false },
}

export default function AdminOnboardingPage() {
  return <AdminSettingsTab section="onboarding" />
}
