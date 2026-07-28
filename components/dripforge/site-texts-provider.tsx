"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { usePathname } from "next/navigation"
import {
  DEFAULT_SITE_TEXTS,
  mergeSiteTexts,
  sanitizeSiteTextsInput,
  type SiteTextKey,
  type SiteTexts,
} from "@/lib/admin/site-texts"
import {
  collectSiteImageLibrary,
  DEFAULT_SITE_IMAGES,
  mergeSiteImages,
  sanitizeSiteImagesInput,
  type SiteImageEntry,
  type SiteImageKey,
  type SiteImages,
} from "@/lib/admin/site-images"
import {
  enableSiteConfigPreviewInSession,
  isSiteConfigPreviewEnabled,
  SITE_CONFIG_PREVIEW_PARAM,
} from "@/lib/admin/site-config"

type SiteTextsContextValue = {
  texts: SiteTexts
  images: SiteImages
  loading: boolean
  preview: boolean
  canInlineEdit: boolean
  t: (key: SiteTextKey) => string
  image: (key: SiteImageKey) => SiteImageEntry
  mediaLibrary: string[]
  refresh: () => Promise<void>
  saveText: (key: SiteTextKey, value: string) => Promise<void>
  saveImage: (key: SiteImageKey, entry: SiteImageEntry) => Promise<void>
}

const SiteTextsContext = createContext<SiteTextsContextValue | null>(null)

function readPreviewFromBrowser(): boolean {
  if (typeof window === "undefined") return false
  if (new URLSearchParams(window.location.search).get(SITE_CONFIG_PREVIEW_PARAM) === "true") {
    enableSiteConfigPreviewInSession()
  }
  return isSiteConfigPreviewEnabled(window.location.search)
}

export function SiteTextsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [texts, setTexts] = useState<SiteTexts>(mergeSiteTexts(null))
  const [images, setImages] = useState<SiteImages>(mergeSiteImages(null))
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const refresh = useCallback(async () => {
    const previewNow = readPreviewFromBrowser()
    setPreview(previewNow)

    try {
      const query = previewNow ? `?${SITE_CONFIG_PREVIEW_PARAM}=true` : ""
      const res = await fetch(`/api/site-texts${query}`, { cache: "no-store" })
      const data = (await res.json().catch(() => null)) as {
        texts?: Partial<Record<string, string>>
        images?: Partial<Record<string, unknown>>
        preview?: boolean
      } | null
      setTexts(mergeSiteTexts(data?.texts))
      setImages(mergeSiteImages(data?.images))
      if (typeof data?.preview === "boolean") {
        setPreview(data.preview)
      }
    } catch (error) {
      console.warn("Site-Texts: Laden fehlgeschlagen, Fallback wird genutzt.", error)
      setTexts(mergeSiteTexts(null))
      setImages(mergeSiteImages(null))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, pathname])

  useEffect(() => {
    if (!preview) {
      setIsAdmin(false)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/admin/auth/me", { credentials: "include" })
        if (!cancelled) setIsAdmin(res.ok)
      } catch {
        if (!cancelled) setIsAdmin(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [preview, pathname])

  const saveText = useCallback(async (key: SiteTextKey, value: string) => {
    let previousTexts: SiteTexts | null = null
    setTexts((prev) => {
      previousTexts = prev
      return sanitizeSiteTextsInput({ ...prev, [key]: value })
    })

    const res = await fetch("/api/admin/site-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ texts: { [key]: value } }),
    })
    const data = (await res.json().catch(() => null)) as {
      error?: string
      texts?: Partial<Record<string, string>>
      images?: Partial<Record<string, unknown>>
    } | null
    if (!res.ok) {
      if (previousTexts) setTexts(previousTexts)
      throw new Error(data?.error ?? "Text konnte nicht gespeichert werden.")
    }
    setTexts(mergeSiteTexts(data?.texts))
    if (data?.images) setImages(mergeSiteImages(data.images))
  }, [])

  const saveImage = useCallback(async (key: SiteImageKey, entry: SiteImageEntry) => {
    let previousImages: SiteImages | null = null
    setImages((prev) => {
      previousImages = prev
      return sanitizeSiteImagesInput({ ...prev, [key]: entry })
    })

    const res = await fetch("/api/admin/site-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ images: { [key]: entry } }),
    })
    const data = (await res.json().catch(() => null)) as {
      error?: string
      texts?: Partial<Record<string, string>>
      images?: Partial<Record<string, unknown>>
    } | null
    if (!res.ok) {
      if (previousImages) setImages(previousImages)
      throw new Error(data?.error ?? "Bild konnte nicht gespeichert werden.")
    }
    setImages(mergeSiteImages(data?.images))
    if (data?.texts) setTexts(mergeSiteTexts(data.texts))
  }, [])

  const canInlineEdit = preview && isAdmin
  const mediaLibrary = useMemo(() => collectSiteImageLibrary(images), [images])

  const value = useMemo<SiteTextsContextValue>(
    () => ({
      texts,
      images,
      loading,
      preview,
      canInlineEdit,
      t: (key) => texts[key] ?? DEFAULT_SITE_TEXTS[key],
      image: (key) => images[key] ?? DEFAULT_SITE_IMAGES[key],
      mediaLibrary,
      refresh,
      saveText,
      saveImage,
    }),
    [
      texts,
      images,
      loading,
      preview,
      canInlineEdit,
      mediaLibrary,
      refresh,
      saveText,
      saveImage,
    ]
  )

  return (
    <SiteTextsContext.Provider value={value}>{children}</SiteTextsContext.Provider>
  )
}

export function useSiteTexts(): SiteTextsContextValue {
  const ctx = useContext(SiteTextsContext)
  if (!ctx) {
    return {
      texts: mergeSiteTexts(null),
      images: mergeSiteImages(null),
      loading: false,
      preview: false,
      canInlineEdit: false,
      t: (key) => DEFAULT_SITE_TEXTS[key],
      image: (key) => DEFAULT_SITE_IMAGES[key],
      mediaLibrary: collectSiteImageLibrary(mergeSiteImages(null)),
      refresh: async () => {},
      saveText: async () => {},
      saveImage: async () => {},
    }
  }
  return ctx
}
