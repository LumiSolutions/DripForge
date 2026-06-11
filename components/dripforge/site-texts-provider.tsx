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
import {
  DEFAULT_SITE_TEXTS,
  mergeSiteTexts,
  type SiteTextKey,
  type SiteTexts,
} from "@/lib/admin/site-texts"

type SiteTextsContextValue = {
  texts: SiteTexts
  loading: boolean
  t: (key: SiteTextKey) => string
  refresh: () => Promise<void>
}

const SiteTextsContext = createContext<SiteTextsContextValue | null>(null)

export function SiteTextsProvider({ children }: { children: ReactNode }) {
  const [texts, setTexts] = useState<SiteTexts>(mergeSiteTexts(null))
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/site-texts", { cache: "no-store" })
      const data = (await res.json().catch(() => null)) as {
        texts?: Partial<Record<string, string>>
      } | null
      setTexts(mergeSiteTexts(data?.texts))
    } catch (error) {
      console.warn("Site-Texts: Laden fehlgeschlagen, Fallback wird genutzt.", error)
      setTexts(mergeSiteTexts(null))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo<SiteTextsContextValue>(
    () => ({
      texts,
      loading,
      t: (key) => texts[key] ?? DEFAULT_SITE_TEXTS[key],
      refresh,
    }),
    [texts, loading, refresh]
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
      t: (key) => DEFAULT_SITE_TEXTS[key],
      refresh: async () => {},
    }
  }
  return ctx
}
