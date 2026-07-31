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
  getDefaultCmsPageContentLists,
  getDefaultExpectItems3d,
  getDefaultExpectItemsLaser,
  getDefaultProcessSteps3d,
  getDefaultProcessStepsLaser,
  mergeCmsPageContentLists,
  sanitizeCmsContactFormFields,
  sanitizeCmsExpectItems,
  sanitizeCmsProcessSteps,
  type CmsContactField,
  type CmsExpectItem,
  type CmsProcessStep,
} from "@/lib/admin/cms-page-content"
import {
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
  processSteps3d: CmsProcessStep[]
  processStepsLaser: CmsProcessStep[]
  expectItems3d: CmsExpectItem[]
  expectItemsLaser: CmsExpectItem[]
  contactFormFields: CmsContactField[]
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
  saveProcessSteps3d: (items: CmsProcessStep[]) => Promise<void>
  saveProcessStepsLaser: (items: CmsProcessStep[]) => Promise<void>
  saveExpectItems3d: (items: CmsExpectItem[]) => Promise<void>
  saveExpectItemsLaser: (items: CmsExpectItem[]) => Promise<void>
  saveContactFormFields: (items: CmsContactField[]) => Promise<void>
  updateNavItemLabel: (id: string, label: string) => Promise<void>
}

const SiteTextsContext = createContext<SiteTextsContextValue | null>(null)

function readPreviewFromBrowser(pathname?: string | null): boolean {
  if (typeof window === "undefined") return false
  return isSiteConfigPreviewEnabled(window.location.search, pathname ?? window.location.pathname)
}

function readReadonlyFromBrowser(pathname?: string | null): boolean {
  if (typeof window === "undefined") return false
  return isSiteConfigReadonlyEnabled(
    window.location.search,
    pathname ?? window.location.pathname
  )
}

type BundlePayload = {
  texts?: Partial<Record<string, string>>
  images?: Partial<Record<string, unknown>>
  links?: SiteLinks
  navItems?: CmsNavItem[]
  pages?: CmsPageEntry[]
  faqItems?: CmsFaqItem[]
  processSteps3d?: CmsProcessStep[]
  processStepsLaser?: CmsProcessStep[]
  expectItems3d?: CmsExpectItem[]
  expectItemsLaser?: CmsExpectItem[]
  contactFormFields?: CmsContactField[]
  preview?: boolean
  role?: "admin" | "tester"
  error?: string
}

type BundleSetters = {
  setTexts: (v: SiteTexts) => void
  setImages: (v: SiteImages) => void
  setLinks: (v: SiteLinks) => void
  setNavItems: (v: CmsNavItem[]) => void
  setPages: (v: CmsPageEntry[]) => void
  setFaqItems: (v: CmsFaqItem[]) => void
  setProcessSteps3d: (v: CmsProcessStep[]) => void
  setProcessStepsLaser: (v: CmsProcessStep[]) => void
  setExpectItems3d: (v: CmsExpectItem[]) => void
  setExpectItemsLaser: (v: CmsExpectItem[]) => void
  setContactFormFields: (v: CmsContactField[]) => void
}

function applyBundle(data: BundlePayload | null, setters: BundleSetters) {
  const texts = mergeSiteTexts(data?.texts)
  setters.setTexts(texts)
  setters.setImages(mergeSiteImages(data?.images))
  setters.setLinks(mergeSiteLinks(data?.links))
  setters.setNavItems(mergeCmsNavItems(data?.navItems))
  setters.setPages(mergeCmsPages(data?.pages))
  setters.setFaqItems(mergeCmsFaqItems(data?.faqItems, texts))
  const lists = mergeCmsPageContentLists(data)
  setters.setProcessSteps3d(lists.processSteps3d)
  setters.setProcessStepsLaser(lists.processStepsLaser)
  setters.setExpectItems3d(lists.expectItems3d)
  setters.setExpectItemsLaser(lists.expectItemsLaser)
  setters.setContactFormFields(lists.contactFormFields)
}

export function SiteTextsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [texts, setTexts] = useState<SiteTexts>(mergeSiteTexts(null))
  const [images, setImages] = useState<SiteImages>(mergeSiteImages(null))
  const [links, setLinks] = useState<SiteLinks>(mergeSiteLinks(null))
  const [navItems, setNavItems] = useState<CmsNavItem[]>(mergeCmsNavItems(null))
  const [pages, setPages] = useState<CmsPageEntry[]>(mergeCmsPages(null))
  const [faqItems, setFaqItems] = useState<CmsFaqItem[]>(mergeCmsFaqItems(null))
  const [processSteps3d, setProcessSteps3d] = useState<CmsProcessStep[]>(
    () => getDefaultCmsPageContentLists().processSteps3d
  )
  const [processStepsLaser, setProcessStepsLaser] = useState<CmsProcessStep[]>(
    () => getDefaultCmsPageContentLists().processStepsLaser
  )
  const [expectItems3d, setExpectItems3d] = useState<CmsExpectItem[]>(
    () => getDefaultCmsPageContentLists().expectItems3d
  )
  const [expectItemsLaser, setExpectItemsLaser] = useState<CmsExpectItem[]>(
    () => getDefaultCmsPageContentLists().expectItemsLaser
  )
  const [contactFormFields, setContactFormFields] = useState<CmsContactField[]>(
    () => getDefaultCmsPageContentLists().contactFormFields
  )
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState(false)
  const [readonly, setReadonly] = useState(false)
  const [staffRole, setStaffRole] = useState<"admin" | "tester" | null>(null)

  const refresh = useCallback(async () => {
    const previewNow = readPreviewFromBrowser(pathname)
    const readonlyNow = readReadonlyFromBrowser(pathname)
    setPreview(previewNow)
    setReadonly(readonlyNow)

    const setters: BundleSetters = {
      setTexts,
      setImages,
      setLinks,
      setNavItems,
      setPages,
      setFaqItems,
      setProcessSteps3d,
      setProcessStepsLaser,
      setExpectItems3d,
      setExpectItemsLaser,
      setContactFormFields,
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
  }, [pathname])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    setReadonly(readReadonlyFromBrowser(pathname))
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

  const bundleSetters = useMemo<BundleSetters>(
    () => ({
      setTexts,
      setImages,
      setLinks,
      setNavItems,
      setPages,
      setFaqItems,
      setProcessSteps3d,
      setProcessStepsLaser,
      setExpectItems3d,
      setExpectItemsLaser,
      setContactFormFields,
    }),
    []
  )

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
    applyBundle(data, bundleSetters)
  }, [bundleSetters])

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
    applyBundle(data, bundleSetters)
  }, [bundleSetters])

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
    applyBundle(data, bundleSetters)
  }, [bundleSetters])

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

  const saveProcessSteps3d = useCallback(async (nextItems: CmsProcessStep[]) => {
    let previous: CmsProcessStep[] | null = null
    const next = sanitizeCmsProcessSteps(nextItems, getDefaultProcessSteps3d)
    setProcessSteps3d((prev) => {
      previous = prev
      return next
    })

    const res = await fetch("/api/admin/site-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ processSteps3d: next }),
    })
    const data = (await res.json().catch(() => null)) as BundlePayload | null
    if (!res.ok) {
      if (previous) setProcessSteps3d(previous)
      throw new Error(data?.error ?? "Prozessschritte konnten nicht gespeichert werden.")
    }
    setProcessSteps3d(
      sanitizeCmsProcessSteps(data?.processSteps3d ?? next, getDefaultProcessSteps3d)
    )
  }, [])

  const saveProcessStepsLaser = useCallback(async (nextItems: CmsProcessStep[]) => {
    let previous: CmsProcessStep[] | null = null
    const next = sanitizeCmsProcessSteps(nextItems, getDefaultProcessStepsLaser)
    setProcessStepsLaser((prev) => {
      previous = prev
      return next
    })

    const res = await fetch("/api/admin/site-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ processStepsLaser: next }),
    })
    const data = (await res.json().catch(() => null)) as BundlePayload | null
    if (!res.ok) {
      if (previous) setProcessStepsLaser(previous)
      throw new Error(data?.error ?? "Prozessschritte konnten nicht gespeichert werden.")
    }
    setProcessStepsLaser(
      sanitizeCmsProcessSteps(
        data?.processStepsLaser ?? next,
        getDefaultProcessStepsLaser
      )
    )
  }, [])

  const saveExpectItems3d = useCallback(async (nextItems: CmsExpectItem[]) => {
    let previous: CmsExpectItem[] | null = null
    const next = sanitizeCmsExpectItems(nextItems, getDefaultExpectItems3d)
    setExpectItems3d((prev) => {
      previous = prev
      return next
    })

    const res = await fetch("/api/admin/site-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ expectItems3d: next }),
    })
    const data = (await res.json().catch(() => null)) as BundlePayload | null
    if (!res.ok) {
      if (previous) setExpectItems3d(previous)
      throw new Error(data?.error ?? "Erwartungs-Einträge konnten nicht gespeichert werden.")
    }
    setExpectItems3d(
      sanitizeCmsExpectItems(data?.expectItems3d ?? next, getDefaultExpectItems3d)
    )
  }, [])

  const saveExpectItemsLaser = useCallback(async (nextItems: CmsExpectItem[]) => {
    let previous: CmsExpectItem[] | null = null
    const next = sanitizeCmsExpectItems(nextItems, getDefaultExpectItemsLaser)
    setExpectItemsLaser((prev) => {
      previous = prev
      return next
    })

    const res = await fetch("/api/admin/site-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ expectItemsLaser: next }),
    })
    const data = (await res.json().catch(() => null)) as BundlePayload | null
    if (!res.ok) {
      if (previous) setExpectItemsLaser(previous)
      throw new Error(data?.error ?? "Erwartungs-Einträge konnten nicht gespeichert werden.")
    }
    setExpectItemsLaser(
      sanitizeCmsExpectItems(
        data?.expectItemsLaser ?? next,
        getDefaultExpectItemsLaser
      )
    )
  }, [])

  const saveContactFormFields = useCallback(async (nextItems: CmsContactField[]) => {
    let previous: CmsContactField[] | null = null
    const next = sanitizeCmsContactFormFields(nextItems)
    setContactFormFields((prev) => {
      previous = prev
      return next
    })

    const res = await fetch("/api/admin/site-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ contactFormFields: next }),
    })
    const data = (await res.json().catch(() => null)) as BundlePayload | null
    if (!res.ok) {
      if (previous) setContactFormFields(previous)
      throw new Error(data?.error ?? "Kontaktfelder konnten nicht gespeichert werden.")
    }
    setContactFormFields(sanitizeCmsContactFormFields(data?.contactFormFields ?? next))
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
      processSteps3d,
      processStepsLaser,
      expectItems3d,
      expectItemsLaser,
      contactFormFields,
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
      saveProcessSteps3d,
      saveProcessStepsLaser,
      saveExpectItems3d,
      saveExpectItemsLaser,
      saveContactFormFields,
      updateNavItemLabel,
    }),
    [
      texts,
      images,
      links,
      navItems,
      pages,
      faqItems,
      processSteps3d,
      processStepsLaser,
      expectItems3d,
      expectItemsLaser,
      contactFormFields,
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
      saveProcessSteps3d,
      saveProcessStepsLaser,
      saveExpectItems3d,
      saveExpectItemsLaser,
      saveContactFormFields,
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
    const lists = getDefaultCmsPageContentLists()
    return {
      texts: mergeSiteTexts(null),
      images: mergeSiteImages(null),
      links: mergeSiteLinks(null),
      navItems: mergeCmsNavItems(null),
      pages: mergeCmsPages(null),
      faqItems: mergeCmsFaqItems(null),
      processSteps3d: lists.processSteps3d,
      processStepsLaser: lists.processStepsLaser,
      expectItems3d: lists.expectItems3d,
      expectItemsLaser: lists.expectItemsLaser,
      contactFormFields: lists.contactFormFields,
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
      saveProcessSteps3d: async () => {},
      saveProcessStepsLaser: async () => {},
      saveExpectItems3d: async () => {},
      saveExpectItemsLaser: async () => {},
      saveContactFormFields: async () => {},
      updateNavItemLabel: async () => {},
    }
  }
  return ctx
}
