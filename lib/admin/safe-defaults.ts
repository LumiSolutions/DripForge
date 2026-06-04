import { DEFAULT_CHECKOUT_RUNTIME_CONFIG } from "@/lib/dripforge/checkout-config"
import type { AdminSettings } from "@/lib/admin/types"
import {
  DEFAULT_COMPANY_SETTINGS,
  DEFAULT_LAUNCH_SETTINGS,
  DEFAULT_SERVICE_VISIBILITY,
} from "@/lib/admin/types"
import { normalizeServiceVisibility } from "@/lib/dripforge/service-visibility"

/** Sichere Standard-Einstellungen wenn Cosmos/Datei nicht erreichbar sind. */
export function buildDefaultAdminSettings(): AdminSettings {
  return {
    checkout: { ...DEFAULT_CHECKOUT_RUNTIME_CONFIG },
    company: { ...DEFAULT_COMPANY_SETTINGS },
    launch: { ...DEFAULT_LAUNCH_SETTINGS },
    services: { ...DEFAULT_SERVICE_VISIBILITY },
    updatedAt: new Date().toISOString(),
  }
}

export function getSafeServiceVisibility(
  input?: Partial<AdminSettings["services"]> | null
) {
  return normalizeServiceVisibility(input ?? DEFAULT_SERVICE_VISIBILITY)
}
