import type { Metadata } from "next"
import { AdminSiteTextsTab } from "@/components/admin/admin-site-texts-tab"

export const metadata: Metadata = {
  title: "Website bearbeiten | DripForge HQ",
  robots: { index: false, follow: false },
}

export default function AdminWebsiteEditPage() {
  return <AdminSiteTextsTab />
}
