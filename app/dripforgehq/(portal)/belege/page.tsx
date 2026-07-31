import type { Metadata } from "next"
import { AdminBelegePage } from "@/components/admin/admin-belege-page"

export const metadata: Metadata = {
  title: "Belege | DripForge HQ",
  robots: { index: false, follow: false },
}

export default function AdminBelegeRoutePage() {
  return <AdminBelegePage />
}
