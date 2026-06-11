/** Umgebungsvariablen für den externen Text/Image-to-3D-Dienst. */
export const THREE_D_GENERATOR_ENV_KEY = "THREE_D_GENERATOR_API_KEY"
export const THREE_D_GENERATOR_ENV_URL = "THREE_D_GENERATOR_API_URL"

/**
 * Im Code hinterlegter Standard-Anbieter (Phase 1).
 * Request-Struktur in `callExternal3dGenerator()` — vollständige Anbindung Phase 2.
 */
export const THREE_D_GENERATOR_PROVIDER = {
  primary: "Meshy AI",
  defaultApiUrl: "https://api.meshy.ai/openapi/v2/text-to-3d",
  codePath: "lib/ai/generate-3d-provider.ts",
  codeFunction: "callExternal3dGenerator()",
  alternatives: ["Tripo3D", "Luma AI"] as const,
} as const

export type ThreeDGeneratorPublicStatus = {
  configured: boolean
  demoMode: boolean
  provider: string
  defaultApiUrl: string
  envKey: string
  envUrlKey: string
  codeReference: string
  alternatives: readonly string[]
}

export function getThreeDGeneratorApiUrl(): string {
  return (
    process.env[THREE_D_GENERATOR_ENV_URL]?.trim() ??
    THREE_D_GENERATOR_PROVIDER.defaultApiUrl
  )
}

export function isThreeDGeneratorConfigured(): boolean {
  const key = process.env[THREE_D_GENERATOR_ENV_KEY]?.trim() ?? ""
  if (!key) return false
  if (key.includes("placeholder")) return false
  return true
}

export function getThreeDGeneratorPublicStatus(): ThreeDGeneratorPublicStatus {
  const configured = isThreeDGeneratorConfigured()
  return {
    configured,
    demoMode: !configured,
    provider: THREE_D_GENERATOR_PROVIDER.primary,
    defaultApiUrl: THREE_D_GENERATOR_PROVIDER.defaultApiUrl,
    envKey: THREE_D_GENERATOR_ENV_KEY,
    envUrlKey: THREE_D_GENERATOR_ENV_URL,
    codeReference: `${THREE_D_GENERATOR_PROVIDER.codePath} → ${THREE_D_GENERATOR_PROVIDER.codeFunction}`,
    alternatives: THREE_D_GENERATOR_PROVIDER.alternatives,
  }
}

/** Entwicklungs-Hinweis (Server-Konsole), wenn kein API-Key gesetzt ist. */
export function logThreeDGeneratorDevHint(context = "Generate-3D"): void {
  if (process.env.NODE_ENV !== "development") return

  console.warn(
    `[DripForge ${context}] ${THREE_D_GENERATOR_ENV_KEY} ist nicht gesetzt — Demo-Modell wird geladen.\n` +
      `Trage den Key in der Projekt-Root in .env.local ein:\n\n` +
      `${THREE_D_GENERATOR_ENV_KEY}=dein-api-key-von-meshy\n` +
      `# Optional — anderer Anbieter (z. B. Tripo3D, Luma AI):\n` +
      `# ${THREE_D_GENERATOR_ENV_URL}=${THREE_D_GENERATOR_PROVIDER.defaultApiUrl}\n\n` +
      `Standard-Anbieter im Code: ${THREE_D_GENERATOR_PROVIDER.primary} (${THREE_D_GENERATOR_PROVIDER.defaultApiUrl})\n` +
      `Azure Live: README.md → «3D-KI-Generator (Azure)»`
  )
}
