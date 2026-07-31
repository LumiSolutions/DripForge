import type { Metadata } from "next"
import { AdminAccountingTab } from "@/components/admin/admin-accounting-tab"

export const metadata: Metadata = {
  title: "Buchhaltung | DripForge HQ",
  robots: { index: false, follow: false },
}

export default function AdminAccountingPage() {
  return <AdminAccountingTab />
}
