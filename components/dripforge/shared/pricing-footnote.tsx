"use client"

import Link from "next/link"
import { SHOP_ROUTES } from "@/lib/dripforge/shop-routes"
import { cn } from "@/lib/utils"

const OFFERTE_PHRASE = "unverbindliche Offerte"

type PricingFootnoteProps = {
  text: string
  className?: string
}

/** Rendert den Preis-Hinweis und verlinkt «unverbindliche Offerte» auf den Kontaktbereich. */
export function PricingFootnote({ text, className }: PricingFootnoteProps) {
  const content = text.trim()
  if (!content) return null

  const lower = content.toLowerCase()
  const idx = lower.indexOf(OFFERTE_PHRASE)

  if (idx < 0) {
    return (
      <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
        {content}
      </p>
    )
  }

  const before = content.slice(0, idx)
  const matched = content.slice(idx, idx + OFFERTE_PHRASE.length)
  const after = content.slice(idx + OFFERTE_PHRASE.length)

  return (
    <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
      {before}
      <Link
        href={SHOP_ROUTES.kontakt}
        className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
      >
        {matched}
      </Link>
      {after}
    </p>
  )
}
