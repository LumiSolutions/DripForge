import type { Metadata } from "next"
import { AdminThemeShell } from "@/components/admin/admin-theme-shell"

export const metadata: Metadata = {
  title: "DripForge HQ",
  robots: { index: false, follow: false },
}

export default function DripforgeHqLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminThemeShell>{children}</AdminThemeShell>
}
