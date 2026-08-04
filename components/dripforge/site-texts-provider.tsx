"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import {
  CMS_CANCEL_EDITING_EVENT,
  CMS_EDITING_EVENT,
  CMS_HISTORY_MESSAGE_SOURCE,
  CMS_SAVE_ALL_EVENT,
  isCmsHistoryParentCommand,
  type CmsHistoryIframeEvent,
} from "@/lib/admin/cms-edit-history"

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
  canUndo: boolean
  canRedo: boolean
  undo: () => Promise<void>
  redo: () => Promise<void>
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

const HISTORY_LIMIT = 40

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
  const [undoStack, setUndoStack] = useState<SiteTexts[]>([])
  const [redoStack, setRedoStack] = useState<SiteTexts[]>([])
  const [editingCount, setEditingCount] = useState(0)
  const textsRef = useRef(texts)
  textsRef.current = texts
  const baselineTextsRef = useRef<SiteTexts | null>(null)
  const undoStackRef = useRef(undoStack)
  undoStackRef.current = undoStack
  const redoStackRef = useRef(redoStack)
  redoStackRef.current = redoStack
  const editingCountRef = useRef(editingCount)
  editingCountRef.current = editingCount

  const pushTextHistory = useCallback((snapshot: SiteTexts) => {
    setUndoStack((prev) => [...prev.slice(-(HISTORY_LIMIT - 1)), snapshot])
    setRedoStack([])
  }, [])

  const persistFullTexts = useCallback(
    async (next: SiteTexts) => {
      const res = await fetch("/api/admin/site-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ texts: next }),
      })
      const data = (await res.json().catch(() => null)) as BundlePayload | null
      if (!res.ok) {
        throw new Error(data?.error ?? "Textverlauf konnte nicht gespeichert werden.")
      }
      applyBundle(data, {
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
      })
    },
    []
  )

  const undo = useCallback(async () => {
    const previous = undoStack[undoStack.length - 1]
    if (!previous) return
    const current = textsRef.current
    setUndoStack((s) => s.slice(0, -1))
    setRedoStack((s) => [...s, current])
    setTexts(previous)
    try {
      await persistFullTexts(previous)
    } catch (err) {
      setUndoStack((s) => [...s, previous])
      setRedoStack((s) => s.slice(0, -1))
      setTexts(current)
      throw err
    }
  }, [undoStack, persistFullTexts])

  const redo = useCallback(async () => {
    const next = redoStack[redoStack.length - 1]
    if (!next) return
    const current = textsRef.current
    setRedoStack((s) => s.slice(0, -1))
    setUndoStack((s) => [...s, current])
    setTexts(next)
    try {
      await persistFullTexts(next)
    } catch (err) {
      setRedoStack((s) => [...s, next])
      setUndoStack((s) => s.slice(0, -1))
      setTexts(current)
      throw err
    }
  }, [redoStack, persistFullTexts])

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
      // Baseline nach (Re-)Load: Verwerfen stellt diesen Stand wieder her.
      queueMicrotask(() => {
        baselineTextsRef.current = textsRef.current
        setUndoStack([])
        setRedoStack([])
      })
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
    if (previousTexts && previousTexts[key] !== value) {
      pushTextHistory(previousTexts)
    }

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
  }, [bundleSetters, pushTextHistory])

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
  const canUndo = undoStack.length > 0
  const canRedo = redoStack.length > 0
  const mediaLibrary = useMemo(() => collectSiteImageLibrary(images), [images])

  useEffect(() => {
    if (!canInlineEdit) return
    const onEditing = (event: Event) => {
      const detail = (event as CustomEvent<{ active?: boolean }>).detail
      if (typeof detail?.active !== "boolean") return
      setEditingCount((count) =>
        Math.max(0, count + (detail.active ? 1 : -1))
      )
    }
    window.addEventListener(CMS_EDITING_EVENT, onEditing)
    return () => window.removeEventListener(CMS_EDITING_EVENT, onEditing)
  }, [canInlineEdit])

  // Keyboard-Shortcuts + Parent-Iframe-Kommunikation für Undo/Redo / Dirty-Guard
  useEffect(() => {
    if (!canInlineEdit) return

    const publishState = () => {
      if (typeof window === "undefined" || window.parent === window) return
      const dirty =
        undoStackRef.current.length > 0 || editingCountRef.current > 0
      const payload: CmsHistoryIframeEvent = {
        source: CMS_HISTORY_MESSAGE_SOURCE,
        type: "state",
        canUndo: undoStackRef.current.length > 0,
        canRedo: redoStackRef.current.length > 0,
        dirty,
      }
      window.parent.postMessage(payload, "*")
    }
    publishState()

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      const isEditable =
        target?.isContentEditable ||
        tag === "input" ||
        tag === "textarea" ||
        tag === "select"
      // Während Tippen: natives Undo; Seitenverlauf über Toolbar / nach Speichern
      if (isEditable) return

      const mod = event.metaKey || event.ctrlKey
      if (!mod) return
      const key = event.key.toLowerCase()
      if (key === "z" && !event.shiftKey) {
        if (undoStackRef.current.length === 0) return
        event.preventDefault()
        void undo()
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        if (redoStackRef.current.length === 0) return
        event.preventDefault()
        void redo()
      }
    }

    const markSaved = () => {
      baselineTextsRef.current = textsRef.current
      setUndoStack([])
      setRedoStack([])
      window.dispatchEvent(new CustomEvent(CMS_CANCEL_EDITING_EVENT))
      setEditingCount(0)
      queueMicrotask(publishState)
    }

    const discardSession = async () => {
      window.dispatchEvent(new CustomEvent(CMS_CANCEL_EDITING_EVENT))
      setEditingCount(0)
      const baseline = baselineTextsRef.current
      if (baseline) {
        try {
          await persistFullTexts(baseline)
        } catch (err) {
          console.warn("CMS discard: Baseline konnte nicht wiederhergestellt werden.", err)
        }
      } else {
        await refresh()
      }
      setUndoStack([])
      setRedoStack([])
      baselineTextsRef.current = textsRef.current
      queueMicrotask(publishState)
    }

    const onMessage = (event: MessageEvent) => {
      if (!isCmsHistoryParentCommand(event.data)) return
      if (event.data.type === "ping") {
        publishState()
        return
      }
      if (event.data.type === "undo") void undo()
      if (event.data.type === "redo") void redo()
      if (event.data.type === "save-all") {
        window.dispatchEvent(new CustomEvent(CMS_SAVE_ALL_EVENT))
        window.setTimeout(markSaved, 350)
        return
      }
      if (event.data.type === "mark-saved") {
        markSaved()
        return
      }
      if (event.data.type === "discard") {
        void discardSession()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("message", onMessage)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("message", onMessage)
    }
  }, [
    canInlineEdit,
    undo,
    redo,
    persistFullTexts,
    refresh,
    undoStack.length,
    redoStack.length,
    editingCount,
  ])

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
      canUndo,
      canRedo,
      undo,
      redo,
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
      canUndo,
      canRedo,
      undo,
      redo,
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
      canUndo: false,
      canRedo: false,
      undo: async () => {},
      redo: async () => {},
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
