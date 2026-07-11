"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"
import { ComingSoonPage } from "@/components/dripforge/coming-soon-page"
import { isLaunchGateBypassPath } from "@/lib/dripforge/launch-gate-paths"
import { useLaunchGateStatus } from "@/hooks/use-launch-gate-status"

export function LaunchGateShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/"
  const { status, loading, reload } = useLaunchGateStatus()

  if (isLaunchGateBypassPath(pathname)) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Wird geladen…
      </div>
    )
  }

  if (status?.showGlobalCountdown || status?.showPathCountdown) {
    return <ComingSoonPage onAccessGranted={() => void reload()} />
  }

  return <>{children}</>
}
