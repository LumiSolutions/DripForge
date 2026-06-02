"use client"

import { useSiteTheme } from "@/hooks/use-site-theme"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { cn } from "@/lib/utils"

export function AdminThemeShell({ children }: { children: React.ReactNode }) {
  const { hydrated } = useSiteTheme()

  if (!hydrated) {
    return (
      <div
        className={cn(
          "flex min-h-screen items-center justify-center",
          adminUi.page,
          adminUi.loader
        )}
      >
        Wird geladen…
      </div>
    )
  }

  return <div className={cn("min-h-screen", adminUi.page)}>{children}</div>
}
