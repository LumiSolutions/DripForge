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
  /** desktop = Nav ab md; mobile = Toolbar unter md; all = beide Breakpoints */
  display?: "desktop" | "mobile" | "all"
  className?: string
}

/** Herz-Icon + «Unsere Mission» — Label immer per CSS: hidden md:inline */
export function SupportMissionLink({
  active = false,
  onNavigate,
  variant = "main",
  display = "all",
  className,
}: SupportMissionLinkProps) {
  const visibilityClass =
    display === "desktop"
      ? "hidden md:inline-flex"
      : display === "mobile"
        ? "inline-flex md:hidden"
        : "inline-flex"

  const mainActive = active
    ? "bg-primary/15 text-primary"
    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"

  const countdownActive = active
    ? "border-orange-500/40 bg-orange-500/15 text-orange-300"
    : "border-white/10 bg-white/5 text-zinc-200 hover:border-orange-500/30 hover:bg-orange-500/10 hover:text-orange-200"

  const isMain = variant === "main"

  return (
    <Link
      href={SUPPORT_ROUTE}
      onClick={onNavigate}
      title="Unsere Mission"
      aria-label="Unsere Mission unterstützen"
      className={cn(
        visibilityClass,
        "shrink-0 items-center justify-center text-sm font-medium transition-[padding,gap,width,border-radius,background-color] duration-200",
        isMain
          ? cn(
              "size-9 gap-0 rounded-full border p-0",
              "md:size-auto md:gap-2 md:rounded-lg md:border-transparent md:px-4 md:py-2",
              active
                ? "border-primary/40 bg-primary/15 text-primary md:bg-primary/15"
                : "border-border/80 bg-secondary/40 text-primary/90 hover:border-primary/30 hover:bg-primary/10 md:border-transparent md:bg-transparent md:text-muted-foreground md:hover:bg-secondary/50 md:hover:text-foreground"
            )
          : cn(
              "size-9 gap-0 rounded-full border p-0",
              "md:size-auto md:gap-2 md:px-4 md:py-2",
              countdownActive
            ),
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
      <span className="hidden whitespace-nowrap md:inline">Unsere Mission</span>
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
