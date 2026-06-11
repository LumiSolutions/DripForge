"use client"

import { useEffect, useState } from "react"
import type { PublicAiCategory } from "@/app/api/settings/ai/route"

export type AiPublicSettings = {
  enabled: boolean
  categories: PublicAiCategory[]
}

const DEFAULT: AiPublicSettings = { enabled: false, categories: [] }

export function useAiPublicSettings(): AiPublicSettings {
  const [settings, setSettings] = useState<AiPublicSettings>(DEFAULT)

  useEffect(() => {
    void fetch("/api/settings/ai", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.enabled === "boolean") {
          setSettings({
            enabled: data.enabled,
            categories: Array.isArray(data.categories) ? data.categories : [],
          })
        }
      })
      .catch(() => {
        console.warn("KI-Einstellungen konnten nicht geladen werden.")
      })
  }, [])

  return settings
}
