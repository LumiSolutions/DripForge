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
import type { CompanySettings } from "@/lib/admin/types"
import {
  applyCompanyPlaceholders,
  companyMailtoHref,
  companyTelHref,
  normalizeCompanySettings,
} from "@/lib/dripforge/company-settings"

type CompanySettingsContextValue = {
  company: CompanySettings
  loading: boolean
  mailtoHref: string
  telHref: string | null
  /** Site-Text / Copy mit Firmendaten-Platzhaltern auflösen */
  withCompany: (text: string) => string
  refresh: () => Promise<void>
}

const CompanySettingsContext = createContext<CompanySettingsContextValue | null>(
  null
)

async function fetchCompanySettings(): Promise<CompanySettings> {
  const res = await fetch("/api/settings/company", { cache: "no-store" })
  if (!res.ok) return normalizeCompanySettings(null)
  const data = (await res.json()) as Partial<CompanySettings>
  return normalizeCompanySettings(data)
}

export function CompanySettingsProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<CompanySettings>(() =>
    normalizeCompanySettings(null)
  )
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const next = await fetchCompanySettings()
      setCompany(next)
    } catch {
      console.warn("Firmendaten konnten nicht geladen werden.")
      setCompany(normalizeCompanySettings(null))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initiale Firmendaten einmalig vom öffentlichen Settings-Endpoint laden.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount
    void refresh()
  }, [refresh])

  const value = useMemo<CompanySettingsContextValue>(
    () => ({
      company,
      loading,
      mailtoHref: companyMailtoHref(company),
      telHref: companyTelHref(company),
      withCompany: (text: string) => applyCompanyPlaceholders(text, company),
      refresh,
    }),
    [company, loading, refresh]
  )

  return (
    <CompanySettingsContext.Provider value={value}>
      {children}
    </CompanySettingsContext.Provider>
  )
}

export function useCompanySettings(): CompanySettingsContextValue {
  const ctx = useContext(CompanySettingsContext)
  if (!ctx) {
    const company = normalizeCompanySettings(null)
    return {
      company,
      loading: false,
      mailtoHref: companyMailtoHref(company),
      telHref: companyTelHref(company),
      withCompany: (text: string) => applyCompanyPlaceholders(text, company),
      refresh: async () => {},
    }
  }
  return ctx
}
