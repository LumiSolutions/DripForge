"use client"

import Link from "next/link"
import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"

export const SUPPORT_ROUTE = "/support"

type SupportMissionLinkProps = {
  active?: boolean
  onNavigate?: () => void
  /** main = Shop-Header; countdown = Coming-Soon-Header */
  variant?: "main" | "countdown"
  /** desktop = nur ab md; mobile = nur unter md; all = immer sichtbar */
  display?: "desktop" | "mobile" | "all"
  className?: string
}

/** Herz-Icon + «Unsere Mission» — einheitliches Support-Nav-Element */
export function SupportMissionLink({
  active = false,
  onNavigate,
  variant = "main",
  display = "all",
  className,
}: SupportMissionLinkProps) {
  const displayClass =
    display === "desktop"
      ? "hidden md:flex"
      : display === "mobile"
        ? "flex md:hidden"
        : "flex"

  const mainStyles = active
    ? "bg-primary/15 text-primary"
    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"

  const countdownStyles = active
    ? "border-orange-500/40 bg-orange-500/15 text-orange-300"
    : "border-white/10 bg-white/5 text-zinc-200 hover:border-orange-500/30 hover:bg-orange-500/10 hover:text-orange-200"

  return (
    <Link
      href={SUPPORT_ROUTE}
      onClick={onNavigate}
      title="Unsere Mission"
      aria-label="Unsere Mission unterstützen"
      className={cn(
        displayClass,
        "shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:px-4",
        variant === "countdown"
          ? cn("rounded-full border", countdownStyles)
          : mainStyles,
        className
      )}
    >
      <Heart
        className={cn(
          "h-4 w-4 shrink-0",
          variant === "countdown"
            ? active
              ? "fill-orange-500/30 text-orange-400"
              : "text-orange-400/90"
            : active
              ? "fill-primary/25 text-primary"
              : "text-primary/80"
        )}
      />
      <span className="whitespace-nowrap">Unsere Mission</span>
    </Link>
  )
}

/** @deprecated Nutze SupportMissionLink */
export function SupportNavLink(props: { active: boolean; onNavigate?: () => void }) {
  return (
    <SupportMissionLink
      active={props.active}
      onNavigate={props.onNavigate}
      variant="main"
      display="desktop"
    />
  )
}

/** @deprecated Nutze SupportMissionLink mit display="mobile" */
export function SupportNavIconLink({ active }: { active: boolean }) {
  return (
    <SupportMissionLink active={active} variant="main" display="mobile" />
  )
}
