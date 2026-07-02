"use client"

import { Card, CardContent } from "@/components/ui/card"
import { SiteText } from "@/components/dripforge/editable-site-text"
import { SiteTextBlock } from "@/components/dripforge/legal-site-text"
import { LegalPageHero } from "@/components/dripforge/legal-page-hero"
import type { SiteTextKey } from "@/lib/admin/site-texts"

const IMPRESSUM_SECTION_COUNT = 6

function ImpressumSectionBlock({ index }: { index: number }) {
  const titleKey = `impressum_section_${index}_title` as SiteTextKey
  const bodyKey = `impressum_section_${index}_body` as SiteTextKey

  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-foreground md:text-xl">
        <SiteText k={titleKey} />
      </h2>
      <SiteTextBlock k={bodyKey} mode="lines" />
    </section>
  )
}

export function ImpressumPageContent() {
  return (
    <div className="space-y-12 py-8">
      <LegalPageHero
        badgeKey="impressum_hero_badge"
        titlePrefixKey="impressum_hero_title_prefix"
        titleHighlightKey="impressum_hero_title_highlight"
        titleSuffixKey="impressum_hero_title_suffix"
      />

      <div className="mx-auto max-w-3xl px-4">
        <Card className="border-border/50 bg-card/50 shadow-sm dark:border-border/60 dark:bg-card/90">
          <CardContent className="space-y-10 p-8 md:p-10">
            {Array.from({ length: IMPRESSUM_SECTION_COUNT }, (_, i) => (
              <ImpressumSectionBlock key={i + 1} index={i + 1} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
