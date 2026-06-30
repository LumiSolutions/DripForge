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
  type SiteTextKey,
  type SiteTexts,
} from "@/lib/admin/site-texts"
import {
  enableSiteConfigPreviewInSession,
  isSiteConfigPreviewEnabled,
  SITE_CONFIG_PREVIEW_PARAM,
} from "@/lib/admin/site-config"

type SiteTextsContextValue = {
  texts: SiteTexts
  loading: boolean
  preview: boolean
  t: (key: SiteTextKey) => string
  refresh: () => Promise<void>
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
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState(false)

  const refresh = useCallback(async () => {
    const previewNow = readPreviewFromBrowser()
    setPreview(previewNow)

    try {
      const query = previewNow ? `?${SITE_CONFIG_PREVIEW_PARAM}=true` : ""
      const res = await fetch(`/api/site-texts${query}`, { cache: "no-store" })
      const data = (await res.json().catch(() => null)) as {
        texts?: Partial<Record<string, string>>
        preview?: boolean
      } | null
      setTexts(mergeSiteTexts(data?.texts))
      if (typeof data?.preview === "boolean") {
        setPreview(data.preview)
      }
    } catch (error) {
      console.warn("Site-Texts: Laden fehlgeschlagen, Fallback wird genutzt.", error)
      setTexts(mergeSiteTexts(null))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, pathname])

  const value = useMemo<SiteTextsContextValue>(
    () => ({
      texts,
      loading,
      preview,
      t: (key) => texts[key] ?? DEFAULT_SITE_TEXTS[key],
      refresh,
    }),
    [texts, loading, preview, refresh]
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
      loading: false,
      preview: false,
      t: (key) => DEFAULT_SITE_TEXTS[key],
      refresh: async () => {},
    }
  }
  return ctx
}
