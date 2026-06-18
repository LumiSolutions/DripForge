import type { Metadata } from "next"
import { AdminThemeShell } from "@/components/admin/admin-theme-shell"

export const metadata: Metadata = {
  title: "DripForge Backoffice",
  robots: { index: false, follow: false },
}

export default function BackofficeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminThemeShell>{children}</AdminThemeShell>
}
