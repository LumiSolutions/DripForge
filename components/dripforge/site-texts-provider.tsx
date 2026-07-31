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
  mergeCmsNavItems,
  mergeCmsPages,
  sanitizeCmsNavItemsInput,
  type CmsNavItem,
  type CmsPageEntry,
} from "@/lib/admin/site-nav"
import {
  mergeCmsFaqItems,
  sanitizeCmsFaqItemsInput,
  type CmsFaqItem,
} from "@/lib/admin/cms-faq"
import {
  enableSiteConfigPreviewInSession,
  isSiteConfigPreviewEnabled,
  isSiteConfigReadonlyEnabled,
  SITE_CONFIG_PREVIEW_PARAM,
} from "@/lib/admin/site-config"

type SiteTextsContextValue = {
  texts: SiteTexts
  images: SiteImages
  links: SiteLinks
  navItems: CmsNavItem[]
  pages: CmsPageEntry[]
  faqItems: CmsFaqItem[]
  loading: boolean
  preview: boolean
  readonly: boolean
  canInlineEdit: boolean
  t: (key: SiteTextKey) => string
  image: (key: SiteImageKey) => SiteImageEntry
  linkHref: (key: string, fallback?: string | null) => string
  mediaLibrary: string[]
  refresh: () => Promise<void>
  saveText: (key: SiteTextKey, value: string) => Promise<void>
  saveImage: (key: SiteImageKey, entry: SiteImageEntry) => Promise<void>
  saveLink: (key: string, href: string) => Promise<void>
  saveNavItems: (items: CmsNavItem[]) => Promise<void>
  savePages: (pages: CmsPageEntry[]) => Promise<void>
  saveFaqItems: (items: CmsFaqItem[]) => Promise<void>
  updateNavItemLabel: (id: string, label: string) => Promise<void>
}

const SiteTextsContext = createContext<SiteTextsContextValue | null>(null)

function readPreviewFromBrowser(): boolean {
  if (typeof window === "undefined") return false
  if (new URLSearchParams(window.location.search).get(SITE_CONFIG_PREVIEW_PARAM) === "true") {
    enableSiteConfigPreviewInSession()
  }
  return isSiteConfigPreviewEnabled(window.location.search)
}

function readReadonlyFromBrowser(): boolean {
  if (typeof window === "undefined") return false
  return isSiteConfigReadonlyEnabled(window.location.search)
}

type BundlePayload = {
  texts?: Partial<Record<string, string>>
  images?: Partial<Record<string, unknown>>
  links?: SiteLinks
  navItems?: CmsNavItem[]
  pages?: CmsPageEntry[]
  faqItems?: CmsFaqItem[]
  preview?: boolean
  role?: "admin" | "tester"
  error?: string
}

function applyBundle(
  data: BundlePayload | null,
  setters: {
    setTexts: (v: SiteTexts) => void
    setImages: (v: SiteImages) => void
    setLinks: (v: SiteLinks) => void
    setNavItems: (v: CmsNavItem[]) => void
    setPages: (v: CmsPageEntry[]) => void
    setFaqItems: (v: CmsFaqItem[]) => void
  }
) {
  const texts = mergeSiteTexts(data?.texts)
  setters.setTexts(texts)
  setters.setImages(mergeSiteImages(data?.images))
  setters.setLinks(mergeSiteLinks(data?.links))
  setters.setNavItems(mergeCmsNavItems(data?.navItems))
  setters.setPages(mergeCmsPages(data?.pages))
  setters.setFaqItems(mergeCmsFaqItems(data?.faqItems, texts))
}

export function SiteTextsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [texts, setTexts] = useState<SiteTexts>(mergeSiteTexts(null))
  const [images, setImages] = useState<SiteImages>(mergeSiteImages(null))
  const [links, setLinks] = useState<SiteLinks>(mergeSiteLinks(null))
  const [navItems, setNavItems] = useState<CmsNavItem[]>(mergeCmsNavItems(null))
  const [pages, setPages] = useState<CmsPageEntry[]>(mergeCmsPages(null))
  const [faqItems, setFaqItems] = useState<CmsFaqItem[]>(mergeCmsFaqItems(null))
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState(false)
  const [readonly, setReadonly] = useState(false)
  const [staffRole, setStaffRole] = useState<"admin" | "tester" | null>(null)

  const refresh = useCallback(async () => {
    const previewNow = readPreviewFromBrowser()
    const readonlyNow = readReadonlyFromBrowser()
    setPreview(previewNow)
    setReadonly(readonlyNow)

    const setters = {
      setTexts,
      setImages,
      setLinks,
      setNavItems,
      setPages,
      setFaqItems,
    }

    try {
      let loaded = false

      if (previewNow) {
        const staffRes = await fetch("/api/preview/site-config", {
          cache: "no-store",
          credentials: "include",
        })
        if (staffRes.ok) {
          const data = (await staffRes.json().catch(() => null)) as BundlePayload | null
          applyBundle(data, setters)
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
        const data = (await res.json().catch(() => null)) as BundlePayload | null
        applyBundle(data, setters)
        if (typeof data?.preview === "boolean") {
          setPreview(data.preview)
        }
      }
    } catch (error) {
      console.warn("Site-Texts: Laden fehlgeschlagen, Fallback wird genutzt.", error)
      applyBundle(null, setters)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, pathname])

  useEffect(() => {
    setReadonly(readReadonlyFromBrowser())
  }, [pathname])

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
    const data = (await res.json().catch(() => null)) as BundlePayload | null
    if (!res.ok) {
      if (previousTexts) setTexts(previousTexts)
      throw new Error(data?.error ?? "Text konnte nicht gespeichert werden.")
    }
    applyBundle(data, {
      setTexts,
      setImages,
      setLinks,
      setNavItems,
      setPages,
      setFaqItems,
    })
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
    const data = (await res.json().catch(() => null)) as BundlePayload | null
    if (!res.ok) {
      if (previousImages) setImages(previousImages)
      throw new Error(data?.error ?? "Bild konnte nicht gespeichert werden.")
    }
    applyBundle(data, {
      setTexts,
      setImages,
      setLinks,
      setNavItems,
      setPages,
      setFaqItems,
    })
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
    const data = (await res.json().catch(() => null)) as BundlePayload | null
    if (!res.ok) {
      if (previousLinks) setLinks(previousLinks)
      throw new Error(data?.error ?? "Link konnte nicht gespeichert werden.")
    }
    applyBundle(data, {
      setTexts,
      setImages,
      setLinks,
      setNavItems,
      setPages,
      setFaqItems,
    })
  }, [])

  const saveNavItems = useCallback(async (items: CmsNavItem[]) => {
    let previous: CmsNavItem[] | null = null
    const next = sanitizeCmsNavItemsInput(items)
    setNavItems((prev) => {
      previous = prev
      return next
    })

    const res = await fetch("/api/admin/site-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ navItems: next }),
    })
    const data = (await res.json().catch(() => null)) as BundlePayload | null
    if (!res.ok) {
      if (previous) setNavItems(previous)
      throw new Error(data?.error ?? "Navigation konnte nicht gespeichert werden.")
    }
    setNavItems(mergeCmsNavItems(data?.navItems ?? next))
  }, [])

  const savePages = useCallback(async (nextPages: CmsPageEntry[]) => {
    let previous: CmsPageEntry[] | null = null
    const next = mergeCmsPages(nextPages)
    setPages((prev) => {
      previous = prev
      return next
    })

    const res = await fetch("/api/admin/site-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ pages: next }),
    })
    const data = (await res.json().catch(() => null)) as BundlePayload | null
    if (!res.ok) {
      if (previous) setPages(previous)
      throw new Error(data?.error ?? "Seiten konnten nicht gespeichert werden.")
    }
    setPages(mergeCmsPages(data?.pages ?? next))
  }, [])

  const saveFaqItems = useCallback(async (nextItems: CmsFaqItem[]) => {
    let previous: CmsFaqItem[] | null = null
    const next = sanitizeCmsFaqItemsInput(nextItems)
    setFaqItems((prev) => {
      previous = prev
      return next
    })

    const res = await fetch("/api/admin/site-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ faqItems: next }),
    })
    const data = (await res.json().catch(() => null)) as BundlePayload | null
    if (!res.ok) {
      if (previous) setFaqItems(previous)
      throw new Error(data?.error ?? "FAQ konnte nicht gespeichert werden.")
    }
    setFaqItems(sanitizeCmsFaqItemsInput(data?.faqItems ?? next))
  }, [])

  const updateNavItemLabel = useCallback(
    async (id: string, label: string) => {
      const trimmed = label.trim()
      if (!trimmed) return
      const next = navItems.map((item) =>
        item.id === id ? { ...item, label: trimmed } : item
      )
      await saveNavItems(next)
    },
    [navItems, saveNavItems]
  )

  const canInlineEdit = preview && !readonly && staffRole === "admin"
  const mediaLibrary = useMemo(() => collectSiteImageLibrary(images), [images])

  const value = useMemo<SiteTextsContextValue>(
    () => ({
      texts,
      images,
      links,
      navItems,
      pages,
      faqItems,
      loading,
      preview,
      readonly,
      canInlineEdit,
      t: (key) => texts[key] ?? DEFAULT_SITE_TEXTS[key],
      image: (key) => images[key] ?? DEFAULT_SITE_IMAGES[key],
      linkHref: (key, fallback) => resolveSiteLinkHref(links, key, fallback),
      mediaLibrary,
      refresh,
      saveText,
      saveImage,
      saveLink,
      saveNavItems,
      savePages,
      saveFaqItems,
      updateNavItemLabel,
    }),
    [
      texts,
      images,
      links,
      navItems,
      pages,
      faqItems,
      loading,
      preview,
      readonly,
      canInlineEdit,
      mediaLibrary,
      refresh,
      saveText,
      saveImage,
      saveLink,
      saveNavItems,
      savePages,
      saveFaqItems,
      updateNavItemLabel,
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
      navItems: mergeCmsNavItems(null),
      pages: mergeCmsPages(null),
      faqItems: mergeCmsFaqItems(null),
      loading: false,
      preview: false,
      readonly: false,
      canInlineEdit: false,
      t: (key) => DEFAULT_SITE_TEXTS[key],
      image: (key) => DEFAULT_SITE_IMAGES[key],
      linkHref: (key, fallback) => resolveSiteLinkHref(null, key, fallback),
      mediaLibrary: collectSiteImageLibrary(mergeSiteImages(null)),
      refresh: async () => {},
      saveText: async () => {},
      saveImage: async () => {},
      saveLink: async () => {},
      saveNavItems: async () => {},
      savePages: async () => {},
      saveFaqItems: async () => {},
      updateNavItemLabel: async () => {},
    }
  }
  return ctx
}
