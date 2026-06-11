import { normalizeSupportPageActive } from "@/lib/admin/safe-defaults"

export type SupportPageSettings = {
  isSupportPageActive: boolean
}

export function buildSupportPageSettings(input?: {
  isSupportPageActive?: unknown
} | null): SupportPageSettings {
  return {
    isSupportPageActive: normalizeSupportPageActive(input?.isSupportPageActive),
  }
}
