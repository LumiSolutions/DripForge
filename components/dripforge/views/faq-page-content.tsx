"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { SiteText } from "@/components/dripforge/editable-site-text"
import { LegalPageHero } from "@/components/dripforge/legal-page-hero"
import type { SiteTextKey } from "@/lib/admin/site-texts"
import { cn } from "@/lib/utils"

const FAQ_COUNT = 10

function faqQuestionKey(index: number): SiteTextKey {
  return `faq_q${index}_question` as SiteTextKey
}

function faqAnswerKey(index: number): SiteTextKey {
  return `faq_q${index}_answer` as SiteTextKey
}

export function FaqPageContent() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggle = (index: number) => {
    setOpenIndex((current) => (current === index ? null : index))
  }

  return (
    <div className="space-y-12 py-8">
      <LegalPageHero
        badgeKey="faq_hero_badge"
        titlePrefixKey="faq_hero_title_prefix"
        titleHighlightKey="faq_hero_title_highlight"
        titleSuffixKey="faq_hero_title_suffix"
      />

      <div className="mx-auto max-w-3xl space-y-3 px-4">
        {Array.from({ length: FAQ_COUNT }, (_, i) => {
          const index = i + 1
          const isOpen = openIndex === index
          const questionKey = faqQuestionKey(index)
          const answerKey = faqAnswerKey(index)

          return (
            <Card
              key={index}
              className={cn(
                "overflow-hidden border-border/50 bg-card/50 shadow-sm transition-all duration-300 dark:bg-card/90",
                isOpen && "border-primary/40 bg-card ring-1 ring-primary/20"
              )}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 p-5 text-left md:p-6"
                onClick={() => toggle(index)}
                aria-expanded={isOpen}
              >
                <span
                  className={cn(
                    "pr-2 text-sm font-bold leading-snug text-foreground md:text-base",
                    isOpen && "text-primary"
                  )}
                >
                  <SiteText k={questionKey} />
                </span>
                <ChevronRight
                  className={cn(
                    "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300",
                    isOpen && "rotate-90 text-primary"
                  )}
                  aria-hidden
                />
              </button>
              <div
                className={cn(
                  "grid transition-all duration-300 ease-in-out",
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                )}
              >
                <div className="overflow-hidden">
                  <p className="border-t border-border/40 px-5 pb-5 pt-4 text-sm leading-relaxed text-muted-foreground md:px-6 md:pb-6 md:text-[0.9375rem]">
                    <SiteText k={answerKey} />
                  </p>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
