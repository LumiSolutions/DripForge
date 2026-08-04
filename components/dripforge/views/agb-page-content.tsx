"use client"

import { Card, CardContent } from "@/components/ui/card"
import { SiteText } from "@/components/dripforge/editable-site-text"
import { LegalRichText } from "@/components/dripforge/legal-rich-text"
import { LegalPageHero } from "@/components/dripforge/legal-page-hero"

export function AgbPageContent() {
  return (
    <div className="space-y-12 py-8">
      <LegalPageHero
        badgeKey="agb_hero_badge"
        titlePrefixKey="agb_hero_title_prefix"
        titleHighlightKey="agb_hero_title_highlight"
        titleSuffixKey="agb_hero_title_suffix"
      />

      <div className="mx-auto max-w-3xl px-4">
        <Card className="border-border/50 bg-card/50 shadow-sm dark:border-border/60 dark:bg-card/90">
          <CardContent className="space-y-6 p-8 md:p-10">
            <LegalRichText k="agb_content_html" />
            <p className="border-t border-border/50 pt-6 text-sm text-muted-foreground">
              <SiteText k="agb_footer_date" />
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
