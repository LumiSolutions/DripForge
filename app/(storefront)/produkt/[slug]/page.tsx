"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"

/** Legacy /produkt/[slug] → /p/[slug] */
export default function LegacyProduktRedirect() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()

  useEffect(() => {
    const slug = typeof params.slug === "string" ? params.slug : ""
    router.replace(slug ? `/p/${encodeURIComponent(slug)}` : "/shop")
  }, [params.slug, router])

  return (
    <div className="py-24 text-center text-muted-foreground">
      Weiterleitung…
    </div>
  )
}
