"use client"

import { useEffect, useState } from "react"
import { ChevronRight, Plus, Trash2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LegalPageHero } from "@/components/dripforge/legal-page-hero"
import { useSiteTexts } from "@/components/dripforge/site-texts-provider"
import {
  createEmptyCmsFaqItem,
  type CmsFaqItem,
} from "@/lib/admin/cms-faq"
import {
  buildInternationalFaqAnswer,
  DEFAULT_INTERNATIONAL_SHIPPING,
  normalizeInternationalShipping,
} from "@/lib/dripforge/international-shipping"
import { normalizeShippingTiers } from "@/lib/dripforge/shipping-tiers"
import { cn } from "@/lib/utils"

const INTERNATIONAL_FAQ_ID = "faq-international-shipping"

export function FaqPageContent() {
  const { faqItems, canInlineEdit, saveFaqItems } = useSiteTexts()
  const [openId, setOpenId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [internationalFaq, setInternationalFaq] = useState(() =>
    buildInternationalFaqAnswer(DEFAULT_INTERNATIONAL_SHIPPING)
  )

  useEffect(() => {
    void fetch("/api/settings/shipping-tiers", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const tiers = normalizeShippingTiers(data)
        const intl = normalizeInternationalShipping(tiers.international)
        setInternationalFaq(buildInternationalFaqAnswer(intl))
      })
      .catch(() => {
        setInternationalFaq(
          buildInternationalFaqAnswer(DEFAULT_INTERNATIONAL_SHIPPING)
        )
      })
  }, [])

  const toggle = (id: string) => {
    setOpenId((current) => (current === id ? null : id))
  }

  const persist = async (next: CmsFaqItem[]) => {
    setSaving(true)
    try {
      await saveFaqItems(next)
    } finally {
      setSaving(false)
    }
  }

  const updateItem = async (
    id: string,
    patch: Partial<Pick<CmsFaqItem, "question" | "answer">>
  ) => {
    const next = faqItems.map((item) =>
      item.id === id ? { ...item, ...patch } : item
    )
    await persist(next)
  }

  const addItem = async () => {
    const item = createEmptyCmsFaqItem(faqItems.length)
    const next = [...faqItems, item]
    setOpenId(item.id)
    await persist(next)
  }

  const removeItem = async (id: string) => {
    if (faqItems.length <= 1) {
      window.alert("Mindestens ein FAQ-Eintrag muss bestehen bleiben.")
      return
    }
    if (!window.confirm("Diesen FAQ-Eintrag wirklich löschen?")) return
    const next = faqItems
      .filter((item) => item.id !== id)
      .map((item, index) => ({ ...item, sortOrder: index }))
    if (openId === id) setOpenId(null)
    await persist(next)
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
        {canInlineEdit && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">
              FAQ-Verwaltung — Einträge hinzufügen, bearbeiten oder löschen.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => void addItem()}
              disabled={saving}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              FAQ hinzufügen
            </Button>
          </div>
        )}

        {/* Dynamische FAQ aus Admin-Auslandsversand-Einstellungen */}
        <Card
          className={cn(
            "overflow-hidden border-border/50 bg-card/50 shadow-sm transition-all duration-300 dark:bg-card/90",
            openId === INTERNATIONAL_FAQ_ID &&
              "border-primary/40 bg-card ring-1 ring-primary/20"
          )}
        >
          <button
            type="button"
            className="flex w-full items-center justify-between gap-4 p-5 text-left md:p-6"
            onClick={() => toggle(INTERNATIONAL_FAQ_ID)}
            aria-expanded={openId === INTERNATIONAL_FAQ_ID}
          >
            <span
              className={cn(
                "pr-2 text-sm font-bold leading-snug text-foreground md:text-base",
                openId === INTERNATIONAL_FAQ_ID && "text-primary"
              )}
            >
              {internationalFaq.question}
            </span>
            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                openId === INTERNATIONAL_FAQ_ID && "rotate-90 text-primary"
              )}
            />
          </button>
          {openId === INTERNATIONAL_FAQ_ID && (
            <div className="border-t border-border/40 px-5 pb-5 pt-3 text-sm leading-relaxed text-muted-foreground md:px-6 md:pb-6">
              {internationalFaq.answer}
            </div>
          )}
        </Card>

        {faqItems.map((item) => {
          const isOpen = openId === item.id

          return (
            <Card
              key={item.id}
              className={cn(
                "overflow-hidden border-border/50 bg-card/50 shadow-sm transition-all duration-300 dark:bg-card/90",
                isOpen && "border-primary/40 bg-card ring-1 ring-primary/20"
              )}
            >
              <div className="flex items-stretch gap-1">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center justify-between gap-4 p-5 text-left md:p-6"
                  onClick={() => toggle(item.id)}
                  aria-expanded={isOpen}
                >
                  <span
                    className={cn(
                      "pr-2 text-sm font-bold leading-snug text-foreground md:text-base",
                      isOpen && "text-primary"
                    )}
                  >
                    {canInlineEdit ? (
                      <span
                        role="textbox"
                        contentEditable
                        suppressContentEditableWarning
                        className="block rounded px-1 outline-none ring-primary/40 focus:bg-background focus:ring-2"
                        onClick={(e) => e.stopPropagation()}
                        onBlur={(e) => {
                          const next = e.currentTarget.textContent?.trim() ?? ""
                          if (next && next !== item.question) {
                            void updateItem(item.id, { question: next })
                          }
                        }}
                      >
                        {item.question}
                      </span>
                    ) : (
                      item.question
                    )}
                  </span>
                  <ChevronRight
                    className={cn(
                      "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300",
                      isOpen && "rotate-90 text-primary"
                    )}
                    aria-hidden
                  />
                </button>
                {canInlineEdit && (
                  <button
                    type="button"
                    className="m-2 self-start rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="FAQ löschen"
                    aria-label="FAQ löschen"
                    disabled={saving}
                    onClick={() => void removeItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div
                className={cn(
                  "grid transition-all duration-300 ease-in-out",
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                )}
              >
                <div className="overflow-hidden">
                  <div className="border-t border-border/40 px-5 pb-5 pt-4 text-sm leading-relaxed text-muted-foreground md:px-6 md:pb-6 md:text-[0.9375rem]">
                    {canInlineEdit ? (
                      <div
                        role="textbox"
                        contentEditable
                        suppressContentEditableWarning
                        className="min-h-[4rem] rounded px-1 outline-none ring-primary/40 focus:bg-background focus:ring-2"
                        onBlur={(e) => {
                          const next = e.currentTarget.textContent ?? ""
                          if (next !== item.answer) {
                            void updateItem(item.id, { answer: next })
                          }
                        }}
                      >
                        {item.answer}
                      </div>
                    ) : (
                      item.answer
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
