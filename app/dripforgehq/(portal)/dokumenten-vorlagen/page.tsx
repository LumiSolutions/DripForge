import type { Metadata } from "next"
import { AdminInvoiceTemplateTab } from "@/components/admin/admin-invoice-template-tab"

export const metadata: Metadata = {
  title: "Dokumenten-Vorlagen | DripForge HQ",
  robots: { index: false, follow: false },
}

export default function AdminDocumentTemplatesPage() {
  return <AdminInvoiceTemplateTab />
}
