"use client"

import Link from "next/link"
import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"

export const SUPPORT_ROUTE = "/support"

/** Gleiche Touch-Fläche wie Sonne/Lupe im Shop-Header (≥44px auf Mobile) */
export const HEADER_ICON_BTN_CLASS =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground active:text-foreground touch-manipulation sm:h-10 sm:w-10"

type SupportMissionLinkProps = {
  active?: boolean
  onNavigate?: () => void
  /** main = Shop-Header; countdown = Coming-Soon-Header */
  variant?: "main" | "countdown"
  /** desktop = Nav ab md; mobile = Toolbar unter md */
  display?: "desktop" | "mobile" | "all"
  className?: string
}

/** Herz-Icon + «Unsere Mission» — Label per CSS: hidden md:inline */
export function SupportMissionLink({
  active = false,
  onNavigate,
  variant = "main",
  display = "mobile",
  className,
}: SupportMissionLinkProps) {
  const visibilityClass =
    display === "desktop"
      ? "hidden md:inline-flex"
      : display === "mobile"
        ? "inline-flex md:hidden"
        : "inline-flex"

  const isMain = variant === "main"

  return (
    <Link
      href={SUPPORT_ROUTE}
      prefetch
      onClick={onNavigate}
      title="Unsere Mission"
      aria-label="Unsere Mission unterstützen"
      className={cn(
        visibilityClass,
        "relative z-10",
        isMain
          ? display === "desktop"
            ? cn(
                "items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )
            : cn(
                HEADER_ICON_BTN_CLASS,
                active && "text-primary hover:text-primary"
              )
          : cn(
              HEADER_ICON_BTN_CLASS,
              "rounded-full border border-white/10 bg-white/5 text-orange-400/90 hover:border-orange-500/30 hover:bg-orange-500/10 hover:text-orange-200 md:h-auto md:w-auto md:gap-2 md:rounded-full md:px-4 md:py-2",
              active && "border-orange-500/40 bg-orange-500/15 text-orange-300"
            ),
        className
      )}
    >
      <Heart
        className={cn(
          "pointer-events-none h-5 w-5 shrink-0",
          isMain
            ? active
              ? "fill-primary/25 text-primary"
              : "text-primary/90"
            : active
              ? "fill-orange-500/30 text-orange-400"
              : "text-orange-400/90"
        )}
      />
      <span className="pointer-events-none hidden whitespace-nowrap md:inline">
        Unsere Mission
      </span>
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
