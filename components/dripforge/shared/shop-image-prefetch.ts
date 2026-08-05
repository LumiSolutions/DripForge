"use client"

import { useEffect, useRef } from "react"
import { resolveProductImages } from "@/lib/dripforge/product-images-defaults"
import type { Product } from "@/lib/dripforge/types"

const PREFETCH_LIMIT = 24

function scheduleIdle(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  const ric = (
    window as Window & {
      requestIdleCallback?: (
        fn: IdleRequestCallback,
        opts?: IdleRequestOptions
      ) => number
      cancelIdleCallback?: (id: number) => void
    }
  ).requestIdleCallback
  const cic = (
    window as Window & {
      cancelIdleCallback?: (id: number) => void
    }
  ).cancelIdleCallback
  if (typeof ric === "function") {
    const id = ric(() => cb(), { timeout: 5000 })
    return () => {
      if (typeof cic === "function") cic(id)
    }
  }
  const t = window.setTimeout(cb, 2200)
  return () => window.clearTimeout(t)
}

/** Schonendes Vorladen von Produktbild-URLs (kein Blockieren der Startseite). */
export function prefetchProductImageUrls(urls: string[]) {
  if (typeof window === "undefined") return
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))].slice(
    0,
    PREFETCH_LIMIT
  )
  for (const url of unique) {
    if (url.startsWith("data:") || url.startsWith("blob:")) continue
    const img = new window.Image()
    img.decoding = "async"
    img.src = url
  }
}

export function prefetchProductCovers(products: Product[]) {
  const urls = products.flatMap((p) =>
    resolveProductImages(p.id, p.images, p.galerieBilder).slice(0, 1)
  )
  prefetchProductImageUrls(urls)
}

/**
 * Idle-Prefetch für Shop-Katalogbilder. Optional: Produkte direkt übergeben,
 * sonst einmalig von `/api/products` laden (erst im Idle).
 */
export function useShopCatalogImagePrefetch(products?: Product[] | null) {
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    const cancel = scheduleIdle(() => {
      if (ranRef.current) return
      ranRef.current = true
      if (products && products.length > 0) {
        prefetchProductCovers(products)
        return
      }
      void fetch("/api/products", { cache: "force-cache" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { products?: Product[] } | null) => {
          if (Array.isArray(data?.products)) {
            prefetchProductCovers(data.products)
          }
        })
        .catch(() => {
          /* Prefetch ist best-effort */
        })
    })
    return cancel
  }, [products])
}
