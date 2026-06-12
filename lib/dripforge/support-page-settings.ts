export type SupportPageSettings = {
  showSupportOnMainSite: boolean
  showSupportOnCountdownPage: boolean
}

function resolveSupportFlag(value: unknown, legacyFallback: boolean): boolean {
  if (value === true) return true
  if (value === false) return false
  return legacyFallback
}

export function buildSupportPageSettings(
  input?: {
    showSupportOnMainSite?: unknown
    showSupportOnCountdownPage?: unknown
    /** @deprecated Legacy-Feld — wird bei fehlenden neuen Flags als Fallback genutzt */
    isSupportPageActive?: unknown
  } | null
): SupportPageSettings {
  const legacy = input?.isSupportPageActive === true

  return {
    showSupportOnMainSite: resolveSupportFlag(
      input?.showSupportOnMainSite,
      legacy
    ),
    showSupportOnCountdownPage: resolveSupportFlag(
      input?.showSupportOnCountdownPage,
      legacy
    ),
  }
}
