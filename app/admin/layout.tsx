import type { Metadata } from "next"
import { AdminThemeShell } from "@/components/admin/admin-theme-shell"

export const metadata: Metadata = {
  title: "Admin | DripForge",
  robots: { index: false, follow: false },
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminThemeShell>{children}</AdminThemeShell>
}
