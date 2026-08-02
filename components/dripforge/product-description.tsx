"use client"

import { cn } from "@/lib/utils"
import { descriptionToDisplayHtml } from "@/lib/dripforge/product-description-html"

/**
 * Rendert Produktbeschreibungen mit Absätzen und DripForge-Highlight.
 * Plaintext bleibt kompatibel (Zeilenumbrüche → Absätze).
 */
export function ProductDescription({
  html,
  className,
}: {
  html: string | null | undefined
  className?: string
}) {
  const safe = descriptionToDisplayHtml(html)
  if (!safe) return null

  return (
    <div
      className={cn(
        "product-description text-sm leading-relaxed text-muted-foreground sm:text-base",
        "[&_p]:mb-3 [&_p:last-child]:mb-0",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        "[&_b]:font-semibold [&_b]:text-foreground",
        "[&_em]:italic [&_i]:italic",
        "[&_u]:underline",
        className
      )}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  )
}
