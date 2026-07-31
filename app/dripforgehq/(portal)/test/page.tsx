import type { Metadata } from "next"
import { AdminTestEnvironmentPage } from "@/components/admin/admin-test-environment-page"

export const metadata: Metadata = {
  title: "Test-Umgebung | DripForge HQ",
  robots: { index: false, follow: false },
}

export default function AdminTestEnvironmentRoutePage() {
  return <AdminTestEnvironmentPage />
}
