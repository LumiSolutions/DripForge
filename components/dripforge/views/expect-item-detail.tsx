"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowLeft, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useSiteTexts } from "@/components/dripforge/site-texts-provider"
import type { CmsExpectItem } from "@/lib/admin/cms-page-content"

export function ExpectItemDetail({
  variant,
  slug,
}: {
  variant: "3d" | "laser"
  slug: string
}) {
  const { expectItems3d, expectItemsLaser, loading } = useSiteTexts()
  const [item, setItem] = useState<CmsExpectItem | null | undefined>(undefined)

  useEffect(() => {
    const list = variant === "3d" ? expectItems3d : expectItemsLaser
    const found = list.find((entry) => entry.slug === slug) ?? null
    setItem(found)
  }, [variant, slug, expectItems3d, expectItemsLaser])

  if (loading || item === undefined) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">
        Wird geladen…
      </div>
    )
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-16 text-center">
        <p className="font-medium">Beispiel nicht gefunden.</p>
        <Button asChild variant="outline">
          <Link href={variant === "3d" ? "/3d-druck" : "/laser"}>Zurück</Link>
        </Button>
      </div>
    )
  }

  const backHref = variant === "3d" ? "/3d-druck" : "/laser"

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-12">
      <Button asChild variant="ghost" size="sm">
        <Link href={backHref}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück
        </Link>
      </Button>

      <Card className="overflow-hidden border-border/50">
        <div className="relative flex min-h-[280px] items-center justify-center bg-secondary/40">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt={item.title}
              className="max-h-[420px] w-full object-contain"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-cyan-500/20">
              <Zap className="h-10 w-10 text-cyan-400" />
            </div>
          )}
          {item.materialLabel ? (
            <Badge className="absolute right-4 top-4" variant="secondary">
              {item.materialLabel}
            </Badge>
          ) : null}
        </div>
        <CardContent className="space-y-4 p-8">
          <h1 className="text-3xl font-bold">{item.title}</h1>
          <p className="text-muted-foreground">{item.description}</p>
          {item.materialLabel ? (
            <p className="text-sm">
              <span className="font-medium">Material:</span> {item.materialLabel}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
