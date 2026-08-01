import type { Metadata } from "next"
import { AdminKontaktanfragenTab } from "@/components/admin/admin-kontaktanfragen-tab"

export const metadata: Metadata = {
  title: "Kontaktanfragen | DripForge HQ",
  robots: { index: false, follow: false },
}

export default function AdminKontaktanfragenPage() {
  return <AdminKontaktanfragenTab />
}
