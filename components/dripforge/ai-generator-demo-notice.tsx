"use client"

import type { ThreeDGeneratorPublicStatus } from "@/lib/ai/three-d-generator-config"
import type { Generate3dResult } from "@/lib/ai/generate-3d-provider"

/** Browser-Konsole (nur localhost / development). */
export function logThreeDGeneratorClientDevHint(
  status: Pick<
    ThreeDGeneratorPublicStatus,
    "envKey" | "envUrlKey" | "provider" | "defaultApiUrl"
  >
): void {
  if (process.env.NODE_ENV !== "development") return

  console.warn(
    `[DripForge KI] ${status.envKey} fehlt — Demo-Modell wird angezeigt.\n` +
      `Trage den Key in der Projekt-Root in .env.local ein:\n\n` +
      `${status.envKey}=dein-api-key\n` +
      `# Optional (Standard: ${status.provider}):\n` +
      `# ${status.envUrlKey}=${status.defaultApiUrl}\n\n` +
      `Dev-Server danach neu starten (npm run dev).\n` +
      `Azure Live: README.md → «3D-KI-Generator (Azure)»`
  )
}

export function AiGeneratorDemoNotice({
  message,
  status,
}: {
  message: string
  status: ThreeDGeneratorPublicStatus | null
}) {
  return (
    <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
      <p>{message}</p>
      {status?.demoMode && (
        <details className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-left text-xs">
          <summary className="cursor-pointer font-medium text-amber-900 dark:text-amber-100">
            Admin-Hinweis: 3D-KI-Anbieter &amp; Konfiguration
          </summary>
          <ul className="mt-2 list-inside list-disc space-y-1 text-amber-900/90 dark:text-amber-100/90">
            <li>
              Im Code hinterlegt: <strong>{status.provider}</strong> (
              <code className="text-[11px]">{status.defaultApiUrl}</code>)
            </li>
            <li>
              Implementierung: <code className="text-[11px]">{status.codeReference}</code>
            </li>
            <li>
              Alternativen per <code className="text-[11px]">{status.envUrlKey}</code>:{" "}
              {status.alternatives.join(", ")}
            </li>
            <li>
              Lokal: <code className="text-[11px]">{status.envKey}</code> in{" "}
              <code className="text-[11px]">.env.local</code> (Projekt-Root)
            </li>
            <li>
              Live (dripforge.ch): Azure App Settings — siehe{" "}
              <code className="text-[11px]">README.md</code>
            </li>
          </ul>
        </details>
      )}
    </div>
  )
}

export function handleGenerate3dResponse(
  data: Generate3dResult,
  status: ThreeDGeneratorPublicStatus | null
): void {
  if (data.provider === "simulation" || data.demoMode) {
    logThreeDGeneratorClientDevHint(
      status ?? {
        envKey: data.generatorStatus?.envKey ?? "THREE_D_GENERATOR_API_KEY",
        envUrlKey: "THREE_D_GENERATOR_API_URL",
        provider: data.generatorStatus?.provider ?? "Meshy AI",
        defaultApiUrl:
          data.generatorStatus?.defaultApiUrl ??
          "https://api.meshy.ai/openapi/v2/text-to-3d",
      }
    )
  }
}
