"use client"

import Link from "next/link"
import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"

export const SUPPORT_ROUTE = "/support"

type SupportNavLinkProps = {
  active: boolean
  onNavigate?: () => void
  variant?: "desktop" | "mobile"
}

export function SupportNavLink({
  active,
  onNavigate,
  variant = "desktop",
}: SupportNavLinkProps) {
  const isMobile = variant === "mobile"

  return (
    <Link
      href={SUPPORT_ROUTE}
      onClick={onNavigate}
      className={cn(
        "flex shrink-0 items-center gap-2 font-medium transition-colors",
        isMobile
          ? "gap-3 rounded-lg px-4 py-3 text-sm"
          : "rounded-lg px-4 py-2 text-sm",
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
      )}
    >
      <Heart
        className={cn(
          isMobile ? "h-5 w-5" : "h-4 w-4",
          active ? "fill-primary/25 text-primary" : "text-primary/80"
        )}
      />
      <span className="whitespace-nowrap">Unsere Mission</span>
    </Link>
  )
}
