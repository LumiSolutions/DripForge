"use client"

import { Badge } from "@/components/ui/badge"
import { SiteText } from "@/components/dripforge/editable-site-text"
import { SiteTextPhrase } from "@/components/dripforge/site-text-phrase"
import type { SiteTextKey } from "@/lib/admin/site-texts"

const HIGHLIGHT_CLASS =
  "bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent"

type LegalPageHeroProps = {
  badgeKey: SiteTextKey
  titlePrefixKey: SiteTextKey
  titleHighlightKey: SiteTextKey
  titleSuffixKey: SiteTextKey
}

export function LegalPageHero({
  badgeKey,
  titlePrefixKey,
  titleHighlightKey,
  titleSuffixKey,
}: LegalPageHeroProps) {
  return (
    <div className="mx-auto max-w-4xl px-4 text-center">
      <Badge variant="secondary" className="mb-4">
        <SiteText k={badgeKey} />
      </Badge>
      <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
        <SiteTextPhrase
          spaced={false}
          parts={[
            { key: titlePrefixKey, className: "text-foreground" },
            { key: titleHighlightKey, className: HIGHLIGHT_CLASS },
            { key: titleSuffixKey, className: "text-foreground" },
          ]}
        />
      </h1>
    </div>
  )
}
