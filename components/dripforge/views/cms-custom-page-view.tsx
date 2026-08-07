"use client"

import Image from "next/image"
import Link from "next/link"
import {
  CheckCircle2,
  HeartHandshake,
  Printer,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import type { CmsPageEntry } from "@/lib/admin/site-nav"
import type { CmsPageBlock } from "@/lib/admin/cms-custom-pages"
import { groupBlocksByRow } from "@/lib/admin/cms-custom-pages"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DynamicContactForm } from "@/components/dripforge/dynamic-contact-form"
import { cn } from "@/lib/utils"

const VALUE_ICONS: Record<string, LucideIcon> = {
  Printer,
  CheckCircle2,
  HeartHandshake,
  Sparkles,
  Zap: Sparkles,
  Layers: Sparkles,
}

function RichHtml({ html, className }: { html?: string; className?: string }) {
  if (!html?.trim()) return null
  return (
    <div
      className={cn(
        "prose prose-neutral max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-primary",
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function BlockRenderer({
  block,
  skipContact,
}: {
  block: CmsPageBlock
  skipContact?: boolean
}) {
  switch (block.type) {
    case "richtext":
      return <RichHtml html={block.html} />
    case "imageText": {
      const imageFirst = block.imagePosition !== "right"
      return (
        <div
          className={cn(
            "grid items-center gap-8 md:grid-cols-2 md:gap-10",
            !imageFirst && "md:[&>*:first-child]:order-2"
          )}
        >
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-secondary/40 to-cyan-400/20">
            {block.imageUrl && !block.imageUrl.includes("placeholder") ? (
              <Image
                src={block.imageUrl}
                alt={block.imageAlt || ""}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20">
                  <Printer className="h-8 w-8 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {block.imageAlt || "Fertigung bei DripForge"}
                </p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  3D-Druck & Lasergravur – Präzision in Aktion
                </p>
              </div>
            )}
          </div>
          <RichHtml html={block.textHtml} />
        </div>
      )
    }
    case "gallery": {
      const images = block.images ?? []
      if (images.length === 0) return null
      return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
          {images.map((src, index) => (
            <div
              key={`${src}-${index}`}
              className="relative aspect-square overflow-hidden rounded-xl bg-secondary/40"
            >
              <Image
                src={src}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 33vw"
              />
            </div>
          ))}
        </div>
      )
    }
    case "faq": {
      const items = block.faqItems ?? []
      if (items.length === 0) return null
      return (
        <Accordion type="single" collapsible className="w-full">
          {items.map((item) => (
            <AccordionItem key={item.id} value={item.id}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>
                <div className="whitespace-pre-wrap text-muted-foreground">
                  {item.answer}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )
    }
    case "contact":
      if (skipContact) return null
      return (
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold md:text-3xl">
              {block.ctaTitle?.trim() ||
                "Schreib uns / Fragen & Sonderwünsche"}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Hast du eine eigene Idee oder einen Sonderwunsch? Schreib uns –
              wir melden uns persönlich.
            </p>
          </div>
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-6 md:p-8">
              <DynamicContactForm />
            </CardContent>
          </Card>
        </div>
      )
    case "valueCards": {
      const cards = block.cards ?? []
      if (cards.length === 0) return null
      return (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const Icon = VALUE_ICONS[card.icon] ?? Sparkles
            return (
              <div
                key={card.id}
                className="rounded-2xl border border-border/50 bg-card/50 p-6 transition-colors hover:border-primary/40"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {card.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {card.description}
                </p>
              </div>
            )
          })}
        </div>
      )
    }
    case "cta": {
      const title =
        block.ctaTitle?.trim() ||
        "Hast du eine eigene Idee oder einen Sonderwunsch?"
      const label = block.ctaButtonLabel?.trim() || "Jetzt Kontakt aufnehmen"
      const href = block.ctaButtonHref?.trim() || "/kontakt"
      return (
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-cyan-400/10 px-6 py-10 text-center md:px-10 md:py-14">
          <h2 className="text-2xl font-bold md:text-3xl">{title}</h2>
          <div className="mt-6">
            <Button asChild size="lg" className="bg-primary text-primary-foreground">
              <Link href={href}>{label}</Link>
            </Button>
          </div>
        </div>
      )
    }
    default:
      return null
  }
}

export function CmsCustomPageView({
  page,
  preview = false,
}: {
  page: CmsPageEntry
  preview?: boolean
}) {
  const title = page.heroTitle?.trim() || page.title
  const subtitle = page.heroSubtitle?.trim()
  const rows = page.rows?.length
    ? page.rows
    : [{ id: "row-default", layout: "1" as const, sortOrder: 0 }]
  const grouped = groupBlocksByRow(rows, page.blocks ?? [])
  const hasRealBanner =
    Boolean(page.bannerImageUrl) &&
    !String(page.bannerImageUrl).includes("placeholder")

  // Kontaktformular höchstens einmal – doppelte CMS-Blöcke werden übersprungen.
  const firstContactId = [...(page.blocks ?? [])]
    .filter((block) => block.type === "contact")
    .sort((a, b) => a.sortOrder - b.sortOrder)[0]?.id

  return (
    <div className={cn("pb-16", preview && "rounded-xl border border-border/50")}>
      <section className="relative overflow-hidden border-b border-border/50">
        {hasRealBanner ? (
          <div className="absolute inset-0">
            <Image
              src={page.bannerImageUrl!}
              alt=""
              fill
              priority={!preview}
              className="object-cover opacity-35"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/75 to-background" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-background to-cyan-400/15" />
        )}
        <div
          className={cn(
            "relative mx-auto max-w-4xl px-4 text-center",
            preview ? "py-8" : "py-16 md:py-24"
          )}
        >
          <h1
            className={cn(
              "font-bold tracking-tight",
              preview ? "text-2xl" : "text-4xl md:text-5xl"
            )}
          >
            <span className="text-foreground">
              {title.includes("–") ? title.split("–")[0].trim() : title}
            </span>
            {title.includes("–") ? (
              <>
                {" – "}
                <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
                  {title.split("–").slice(1).join("–").trim()}
                </span>
              </>
            ) : null}
          </h1>
          {subtitle ? (
            <p
              className={cn(
                "mx-auto mt-4 max-w-2xl text-muted-foreground",
                !preview && "md:text-lg"
              )}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      </section>

      <div
        className={cn(
          "mx-auto flex max-w-5xl flex-col gap-12 px-4",
          preview ? "py-6" : "py-12 md:gap-16 md:py-16"
        )}
      >
        {grouped.every(({ columns }) =>
          columns.every((col) => col.length === 0)
        ) ? (
          <p className="text-center text-muted-foreground">
            Diese Seite hat noch keinen Inhalt.
          </p>
        ) : (
          grouped.map(({ row, columns }) => (
            <div
              key={row.id}
              className={cn(
                "grid gap-6",
                row.layout === "2" && "md:grid-cols-2",
                row.layout === "3" && "md:grid-cols-3"
              )}
            >
              {columns.map((colBlocks, colIndex) => (
                <div
                  key={`${row.id}-${colIndex}`}
                  className="flex min-w-0 flex-col gap-6"
                >
                  {colBlocks.map((block) => (
                    <section key={block.id}>
                      <BlockRenderer
                        block={block}
                        skipContact={
                          block.type === "contact" &&
                          Boolean(firstContactId) &&
                          block.id !== firstContactId
                        }
                      />
                    </section>
                  ))}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
