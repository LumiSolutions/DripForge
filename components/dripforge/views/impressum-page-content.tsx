"use client"

import { Card, CardContent } from "@/components/ui/card"
import { SiteText } from "@/components/dripforge/editable-site-text"
import { SiteTextBlock } from "@/components/dripforge/legal-site-text"
import { LegalPageHero } from "@/components/dripforge/legal-page-hero"
import { useCompanySettings } from "@/components/dripforge/company-settings-provider"
import type { SiteTextKey } from "@/lib/admin/site-texts"

const IMPRESSUM_SECTION_COUNT = 6

function ImpressumIdentitySection() {
  const { company, mailtoHref, telHref } = useCompanySettings()

  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-foreground md:text-xl">
        <SiteText k="impressum_section_1_title" />
      </h2>
      <div className="space-y-1 text-[0.9375rem] leading-relaxed text-muted-foreground md:text-base">
        <p className="font-medium text-foreground">{company.firmenname}</p>
        {company.firmenAdresse
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => (
            <p key={line}>{line}</p>
          ))}
      </div>

      <h2 className="mb-3 mt-10 text-lg font-bold text-foreground md:text-xl">
        <SiteText k="impressum_section_2_title" />
      </h2>
      <div className="space-y-1 text-[0.9375rem] leading-relaxed text-muted-foreground md:text-base">
        <p>
          E-Mail:{" "}
          <a href={mailtoHref} className="hover:text-primary">
            {company.kontaktEmail}
          </a>
        </p>
        {company.telefonnummer ? (
          <p>
            Telefon:{" "}
            {telHref ? (
              <a href={telHref} className="hover:text-primary">
                {company.telefonnummer}
              </a>
            ) : (
              company.telefonnummer
            )}
          </p>
        ) : null}
        {(company.iban || company.bankname) && (
          <>
            {company.bankname ? <p>Bank: {company.bankname}</p> : null}
            {company.iban ? <p>IBAN: {company.iban}</p> : null}
          </>
        )}
        <p>Kontaktformular: Über unsere Website</p>
      </div>
    </section>
  )
}

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
            <ImpressumIdentitySection />
            {Array.from({ length: IMPRESSUM_SECTION_COUNT - 2 }, (_, i) => (
              <ImpressumSectionBlock key={i + 3} index={i + 3} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
