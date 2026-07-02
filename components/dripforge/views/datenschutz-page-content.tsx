"use client"

import { Card, CardContent } from "@/components/ui/card"
import { SiteText } from "@/components/dripforge/editable-site-text"
import { SiteTextBlock } from "@/components/dripforge/legal-site-text"
import { LegalPageHero } from "@/components/dripforge/legal-page-hero"
import { DATENSCHUTZ_BULLET_SECTIONS } from "@/lib/admin/legal-site-text-defaults"
import type { SiteTextKey } from "@/lib/admin/site-texts"

const DATENSCHUTZ_SECTION_COUNT = 8

function PrivacySectionBlock({ index }: { index: number }) {
  const titleKey = `datenschutz_section_${index}_title` as SiteTextKey
  const bodyKey = `datenschutz_section_${index}_body` as SiteTextKey
  const mode = DATENSCHUTZ_BULLET_SECTIONS.has(index) ? "bullets" : "paragraphs"

  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-foreground md:text-xl">
        <SiteText k={titleKey} />
      </h2>
      <SiteTextBlock k={bodyKey} mode={mode} />
    </section>
  )
}

export function DatenschutzPageContent() {
  return (
    <div className="space-y-12 py-8">
      <LegalPageHero
        badgeKey="datenschutz_hero_badge"
        titlePrefixKey="datenschutz_hero_title_prefix"
        titleHighlightKey="datenschutz_hero_title_highlight"
        titleSuffixKey="datenschutz_hero_title_suffix"
      />

      <div className="mx-auto max-w-3xl px-4">
        <Card className="border-border/50 bg-card/50 shadow-sm dark:border-border/60 dark:bg-card/90">
          <CardContent className="space-y-10 p-8 md:p-10">
            {Array.from({ length: DATENSCHUTZ_SECTION_COUNT }, (_, i) => (
              <PrivacySectionBlock key={i + 1} index={i + 1} />
            ))}
            <p className="border-t border-border/50 pt-6 text-sm text-muted-foreground">
              <SiteText k="datenschutz_footer_date" />
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
