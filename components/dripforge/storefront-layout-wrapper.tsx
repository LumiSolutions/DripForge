"use client"

import type { ReactNode } from "react"
import { StorefrontLaunchLayout } from "@/components/dripforge/storefront-launch-layout"

export function StorefrontLayoutWrapper({ children }: { children: ReactNode }) {
  return <StorefrontLaunchLayout>{children}</StorefrontLaunchLayout>
}
