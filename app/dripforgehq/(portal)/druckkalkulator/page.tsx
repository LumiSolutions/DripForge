import type { Metadata } from "next"
import { AdminPrintCalculatorTab } from "@/components/admin/admin-print-calculator-tab"

export const metadata: Metadata = {
  title: "Druckkalkulator | DripForge HQ",
  robots: { index: false, follow: false },
}

export default function AdminPrintCalculatorPage() {
  return <AdminPrintCalculatorTab />
}
