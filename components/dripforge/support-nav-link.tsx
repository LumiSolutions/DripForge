"use client"

import Link from "next/link"
import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"

export const SUPPORT_ROUTE = "/support"

type SupportNavLinkProps = {
  active: boolean
  onNavigate?: () => void
}

/** Desktop-Navigation: Text + Icon (ab md sichtbar). */
export function SupportNavLink({ active, onNavigate }: SupportNavLinkProps) {
  return (
    <Link
      href={SUPPORT_ROUTE}
      onClick={onNavigate}
      className={cn(
        "hidden shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors md:flex",
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
      )}
    >
      <Heart
        className={cn(
          "h-4 w-4",
          active ? "fill-primary/25 text-primary" : "text-primary/80"
        )}
      />
      <span className="whitespace-nowrap">Unsere Mission</span>
    </Link>
  )
}

/** Mobile-Toolbar: nur Icon, direkt im Header sichtbar (unter md). */
export function SupportNavIconLink({ active }: { active: boolean }) {
  return (
    <Link
      href={SUPPORT_ROUTE}
      title="Unsere Mission"
      aria-label="Unsere Mission unterstützen"
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors md:hidden",
        active
          ? "border-primary/40 bg-primary/15 text-primary"
          : "border-border/80 bg-secondary/40 text-primary/90 hover:border-primary/30 hover:bg-primary/10"
      )}
    >
      <Heart className={cn("h-4 w-4", active && "fill-primary/25")} />
    </Link>
  )
}
