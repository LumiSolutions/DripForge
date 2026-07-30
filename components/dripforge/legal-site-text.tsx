"use client"

import type { SiteTextKey } from "@/lib/admin/site-texts"
import { SiteTextEditor } from "@/components/dripforge/editable-site-text"
import { useSiteTexts } from "@/components/dripforge/site-texts-provider"
import { useCompanySettings } from "@/components/dripforge/company-settings-provider"
import { cn } from "@/lib/utils"

function renderLegalBody(text: string, mode: "paragraphs" | "bullets" | "lines") {
  if (mode === "bullets") {
    const items = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^[-•]\s*/, ""))

    return (
      <ul className="list-disc space-y-2 pl-5">
        {items.map((item) => (
          <li key={item.slice(0, 48)}>{item}</li>
        ))}
      </ul>
    )
  }

  if (mode === "lines") {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => (
        <p key={line.slice(0, 48)}>{line}</p>
      ))
  }

  return text
    .split(/\n\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => (
      <p key={paragraph.slice(0, 48)}>{paragraph}</p>
    ))
}

type SiteTextBlockProps = {
  k: SiteTextKey
  mode?: "paragraphs" | "bullets" | "lines"
  className?: string
}

export function SiteTextBlock({
  k,
  mode = "paragraphs",
  className,
}: SiteTextBlockProps) {
  const { t, canInlineEdit } = useSiteTexts()
  const { withCompany } = useCompanySettings()
  const raw = t(k)
  const value = withCompany(raw)

  const content = (
    <div className={cn("space-y-3 text-[0.9375rem] leading-relaxed text-muted-foreground md:text-base", className)}>
      {renderLegalBody(value, mode)}
    </div>
  )

  if (!canInlineEdit) {
    return content
  }

  return (
    <div className="group/site-text relative">
      {content}
      <div className="absolute -right-1 top-0">
        <SiteTextEditor textKey={k} value={raw} align="end" />
      </div>
    </div>
  )
}
