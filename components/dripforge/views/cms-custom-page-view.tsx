"use client"

import Image from "next/image"
import type { CmsPageEntry } from "@/lib/admin/site-nav"
import type { CmsPageBlock } from "@/lib/admin/cms-custom-pages"
import { groupBlocksByRow } from "@/lib/admin/cms-custom-pages"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { PageKontakt } from "@/components/dripforge/views/page-kontakt"
import { useShopNavigate } from "@/hooks/use-shop-navigate"
import { cn } from "@/lib/utils"

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

function BlockRenderer({ block }: { block: CmsPageBlock }) {
  const navigate = useShopNavigate()

  switch (block.type) {
    case "richtext":
      return <RichHtml html={block.html} />
    case "imageText": {
      const imageFirst = block.imagePosition !== "right"
      return (
        <div
          className={cn(
            "grid items-center gap-6 md:grid-cols-2 md:gap-8",
            !imageFirst && "md:[&>*:first-child]:order-2"
          )}
        >
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-secondary/40">
            {block.imageUrl ? (
              <Image
                src={block.imageUrl}
                alt={block.imageAlt || ""}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Bild
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
      return (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-2 md:p-4">
          <PageKontakt setCurrentView={navigate} />
        </div>
      )
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

  return (
    <div className={cn("pb-16", preview && "rounded-xl border border-border/50")}>
      <section className="relative overflow-hidden border-b border-border/50">
        {page.bannerImageUrl ? (
          <div className="absolute inset-0">
            <Image
              src={page.bannerImageUrl}
              alt=""
              fill
              priority={!preview}
              className="object-cover opacity-30"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-cyan-400/10" />
        )}
        <div
          className={cn(
            "relative mx-auto max-w-4xl px-4 text-center",
            preview ? "py-8" : "py-14 md:py-20"
          )}
        >
          <h1
            className={cn(
              "font-bold tracking-tight",
              preview ? "text-2xl" : "text-4xl md:text-5xl"
            )}
          >
            {title}
          </h1>
          {subtitle ? (
            <p
              className={cn(
                "mx-auto mt-3 max-w-2xl text-muted-foreground",
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
          "mx-auto flex max-w-5xl flex-col gap-10 px-4",
          preview ? "py-6" : "py-10 md:gap-12 md:py-14"
        )}
      >
        {grouped.every(({ columns }) => columns.every((col) => col.length === 0)) ? (
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
                <div key={`${row.id}-${colIndex}`} className="flex min-w-0 flex-col gap-6">
                  {colBlocks.map((block) => (
                    <section key={block.id}>
                      <BlockRenderer block={block} />
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
