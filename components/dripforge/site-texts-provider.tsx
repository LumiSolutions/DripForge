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
  mergeSiteLinks,
  resolveSiteLinkHref,
  sanitizeSiteLinksInput,
  type SiteLinks,
} from "@/lib/admin/site-links"
import {
  enableSiteConfigPreviewInSession,
  isSiteConfigPreviewEnabled,
  SITE_CONFIG_PREVIEW_PARAM,
} from "@/lib/admin/site-config"

type SiteTextsContextValue = {
  texts: SiteTexts
  images: SiteImages
  links: SiteLinks
  loading: boolean
  preview: boolean
  canInlineEdit: boolean
  t: (key: SiteTextKey) => string
  image: (key: SiteImageKey) => SiteImageEntry
  linkHref: (key: string, fallback?: string | null) => string
  mediaLibrary: string[]
  refresh: () => Promise<void>
  saveText: (key: SiteTextKey, value: string) => Promise<void>
  saveImage: (key: SiteImageKey, entry: SiteImageEntry) => Promise<void>
  saveLink: (key: string, href: string) => Promise<void>
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
  const [links, setLinks] = useState<SiteLinks>(mergeSiteLinks(null))
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState(false)
  const [staffRole, setStaffRole] = useState<"admin" | "tester" | null>(null)

  const refresh = useCallback(async () => {
    const previewNow = readPreviewFromBrowser()
    setPreview(previewNow)

    try {
      let loaded = false

      if (previewNow) {
        const staffRes = await fetch("/api/preview/site-config", {
          cache: "no-store",
          credentials: "include",
        })
        if (staffRes.ok) {
          const data = (await staffRes.json().catch(() => null)) as {
            texts?: Partial<Record<string, string>>
            images?: Partial<Record<string, unknown>>
            links?: SiteLinks
            preview?: boolean
            role?: "admin" | "tester"
          } | null
          setTexts(mergeSiteTexts(data?.texts))
          setImages(mergeSiteImages(data?.images))
          setLinks(mergeSiteLinks(data?.links))
          if (typeof data?.preview === "boolean") setPreview(data.preview)
          if (data?.role === "admin" || data?.role === "tester") {
            setStaffRole(data.role)
          }
          loaded = true
        }
      }

      if (!loaded) {
        const query = previewNow ? `?${SITE_CONFIG_PREVIEW_PARAM}=true` : ""
        const res = await fetch(`/api/site-texts${query}`, { cache: "no-store" })
        const data = (await res.json().catch(() => null)) as {
          texts?: Partial<Record<string, string>>
          images?: Partial<Record<string, unknown>>
          links?: SiteLinks
          preview?: boolean
        } | null
        setTexts(mergeSiteTexts(data?.texts))
        setImages(mergeSiteImages(data?.images))
        setLinks(mergeSiteLinks(data?.links))
        if (typeof data?.preview === "boolean") {
          setPreview(data.preview)
        }
      }
    } catch (error) {
      console.warn("Site-Texts: Laden fehlgeschlagen, Fallback wird genutzt.", error)
      setTexts(mergeSiteTexts(null))
      setImages(mergeSiteImages(null))
      setLinks(mergeSiteLinks(null))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, pathname])

  useEffect(() => {
    if (!preview) {
      setStaffRole(null)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/admin/auth/me", { credentials: "include" })
        const data = (await res.json().catch(() => null)) as {
          authenticated?: boolean
          role?: "admin" | "tester"
        } | null
        if (cancelled) return
        if (res.ok && (data?.role === "admin" || data?.role === "tester")) {
          setStaffRole(data.role)
        } else {
          setStaffRole(null)
        }
      } catch {
        if (!cancelled) setStaffRole(null)
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
      links?: SiteLinks
    } | null
    if (!res.ok) {
      if (previousTexts) setTexts(previousTexts)
      throw new Error(data?.error ?? "Text konnte nicht gespeichert werden.")
    }
    setTexts(mergeSiteTexts(data?.texts))
    if (data?.images) setImages(mergeSiteImages(data.images))
    if (data?.links) setLinks(mergeSiteLinks(data.links))
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
      links?: SiteLinks
    } | null
    if (!res.ok) {
      if (previousImages) setImages(previousImages)
      throw new Error(data?.error ?? "Bild konnte nicht gespeichert werden.")
    }
    setImages(mergeSiteImages(data?.images))
    if (data?.texts) setTexts(mergeSiteTexts(data.texts))
    if (data?.links) setLinks(mergeSiteLinks(data.links))
  }, [])

  const saveLink = useCallback(async (key: string, href: string) => {
    let previousLinks: SiteLinks | null = null
    setLinks((prev) => {
      previousLinks = prev
      return sanitizeSiteLinksInput({ ...prev, [key]: { href } })
    })

    const res = await fetch("/api/admin/site-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ links: { [key]: { href } } }),
    })
    const data = (await res.json().catch(() => null)) as {
      error?: string
      texts?: Partial<Record<string, string>>
      images?: Partial<Record<string, unknown>>
      links?: SiteLinks
    } | null
    if (!res.ok) {
      if (previousLinks) setLinks(previousLinks)
      throw new Error(data?.error ?? "Link konnte nicht gespeichert werden.")
    }
    setLinks(mergeSiteLinks(data?.links))
    if (data?.texts) setTexts(mergeSiteTexts(data.texts))
    if (data?.images) setImages(mergeSiteImages(data.images))
  }, [])

  const canInlineEdit = preview && staffRole === "admin"
  const mediaLibrary = useMemo(() => collectSiteImageLibrary(images), [images])

  const value = useMemo<SiteTextsContextValue>(
    () => ({
      texts,
      images,
      links,
      loading,
      preview,
      canInlineEdit,
      t: (key) => texts[key] ?? DEFAULT_SITE_TEXTS[key],
      image: (key) => images[key] ?? DEFAULT_SITE_IMAGES[key],
      linkHref: (key, fallback) => resolveSiteLinkHref(links, key, fallback),
      mediaLibrary,
      refresh,
      saveText,
      saveImage,
      saveLink,
    }),
    [
      texts,
      images,
      links,
      loading,
      preview,
      canInlineEdit,
      mediaLibrary,
      refresh,
      saveText,
      saveImage,
      saveLink,
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
      links: mergeSiteLinks(null),
      loading: false,
      preview: false,
      canInlineEdit: false,
      t: (key) => DEFAULT_SITE_TEXTS[key],
      image: (key) => DEFAULT_SITE_IMAGES[key],
      linkHref: (key, fallback) => resolveSiteLinkHref(null, key, fallback),
      mediaLibrary: collectSiteImageLibrary(mergeSiteImages(null)),
      refresh: async () => {},
      saveText: async () => {},
      saveImage: async () => {},
      saveLink: async () => {},
    }
  }
  return ctx
}
