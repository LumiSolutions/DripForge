import {
  type AiCategoryConfig,
  type AiCutoutSpec,
  type AiPrintVolumeMm,
} from "@/lib/ai/ai-settings-types"
import {
  getThreeDGeneratorApiUrl,
  isThreeDGeneratorConfigured,
  logThreeDGeneratorDevHint,
  THREE_D_GENERATOR_ENV_KEY,
  THREE_D_GENERATOR_PROVIDER,
} from "@/lib/ai/three-d-generator-config"

export type Generate3dRequest = {
  userPrompt: string
  categoryId: string
  referenceImageBase64?: string | null
  referenceImageMimeType?: string | null
}

export type Generate3dConstraints = {
  categoryId: string
  categoryName: string
  systemPrompt: string
  maxPrintSizeMm: AiPrintVolumeMm
  cutouts: AiCutoutSpec[]
  combinedPrompt: string
}

export type Generate3dResult = {
  generationId: string
  status: "simulated" | "completed" | "pending"
  modelUrl: string
  modelFormat: "glb"
  constraintsApplied: Generate3dConstraints
  provider: "simulation" | "external"
  message?: string
  demoMode?: boolean
  remainingAiCredits?: number
  generatorStatus?: {
    provider: string
    defaultApiUrl: string
    envKey: string
  }
}

function formatCutout(cutout: AiCutoutSpec): string {
  const dims: string[] = []
  if (cutout.diameterMm != null) dims.push(`Ø ${cutout.diameterMm} mm`)
  if (cutout.widthMm != null) dims.push(`Breite ${cutout.widthMm} mm`)
  if (cutout.heightMm != null) dims.push(`Höhe ${cutout.heightMm} mm`)
  if (cutout.depthMm != null) dims.push(`Tiefe ${cutout.depthMm} mm`)
  const dimText = dims.length > 0 ? dims.join(", ") : "Maße gemäss Spezifikation"
  const notes = cutout.notes ? ` — ${cutout.notes}` : ""
  return `- ${cutout.label}: ${dimText}${notes}`
}

export function buildConstrainedGenerationPrompt(
  userPrompt: string,
  category: AiCategoryConfig
): Generate3dConstraints {
  const { maxPrintSizeMm } = category
  const cutoutBlock =
    category.cutouts.length > 0
      ? category.cutouts.map(formatCutout).join("\n")
      : "- Keine zusätzlichen festen Aussparungen definiert."

  const restrictionBlock = `
STRIKTE TECHNISCHE RESTRIKTIONEN (NICHT VERLETZEN):
- Maximale Druckgrösse (Bambu Lab X1C): ${maxPrintSizeMm.x} × ${maxPrintSizeMm.y} × ${maxPrintSizeMm.z} mm (X × Y × Z)
- Feste Aussparungen / Bohrungen:
${cutoutBlock}
- Modell muss ohne Überhänge > 45° druckbar sein oder Stützstrukturen vermeiden.
- Alle Aussparungen müssen als durchgehende Volumina modelliert werden.`

  const combinedPrompt = `${category.systemPrompt.trim()}

${restrictionBlock}

KUNDENWUNSCH:
${userPrompt.trim()}`

  return {
    categoryId: category.id,
    categoryName: category.name,
    systemPrompt: category.systemPrompt,
    maxPrintSizeMm,
    cutouts: category.cutouts,
    combinedPrompt,
  }
}

/** Demo-GLB bis externe Generator-API angebunden ist. */
export const SIMULATED_MODEL_URL =
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb"

export function isExternal3dGeneratorConfigured(): boolean {
  return isThreeDGeneratorConfigured()
}

export async function callExternal3dGenerator(
  constraints: Generate3dConstraints,
  referenceImageBase64?: string | null
): Promise<{ modelUrl: string } | null> {
  const apiKey = process.env[THREE_D_GENERATOR_ENV_KEY]?.trim()
  const apiUrl = getThreeDGeneratorApiUrl()

  if (!apiKey || !isExternal3dGeneratorConfigured()) {
    logThreeDGeneratorDevHint("callExternal3dGenerator")
    return null
  }

  // Vorbereitet für Meshy (Standard) — URL über THREE_D_GENERATOR_API_URL auf Tripo3D/Luma umstellbar.
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: constraints.combinedPrompt,
        negative_prompt: "floating geometry, non-manifold mesh, oversized model",
        image_url: referenceImageBase64
          ? `data:image/png;base64,${referenceImageBase64}`
          : undefined,
        constraints: {
          max_dimensions_mm: constraints.maxPrintSizeMm,
          cutouts: constraints.cutouts,
        },
      }),
    })

    if (!response.ok) {
      console.warn("3D-Generator API: Antwort nicht OK.", response.status)
      return null
    }

    const data = (await response.json()) as { model_url?: string; modelUrl?: string }
    const modelUrl = data.model_url ?? data.modelUrl
    if (modelUrl && typeof modelUrl === "string") {
      return { modelUrl }
    }
  } catch (error) {
    console.warn("3D-Generator API: Aufruf fehlgeschlagen, Simulation wird genutzt.", error)
  }

  return null
}

export async function generate3dModel(
  input: Generate3dRequest,
  category: AiCategoryConfig
): Promise<Generate3dResult> {
  const constraints = buildConstrainedGenerationPrompt(input.userPrompt, category)
  const generationId = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  const external = await callExternal3dGenerator(
    constraints,
    input.referenceImageBase64
  )

  if (external?.modelUrl) {
    return {
      generationId,
      status: "completed",
      modelUrl: external.modelUrl,
      modelFormat: "glb",
      constraintsApplied: constraints,
      provider: "external",
    }
  }

  return {
    generationId,
    status: "simulated",
    modelUrl: SIMULATED_MODEL_URL,
    modelFormat: "glb",
    constraintsApplied: constraints,
    provider: "simulation",
    message:
      `${THREE_D_GENERATOR_ENV_KEY} nicht gesetzt — Demo-Modell zur Vorschau geladen. Technische Vorgaben wurden für die spätere Generierung vorbereitet.`,
    demoMode: true,
    generatorStatus: {
      provider: THREE_D_GENERATOR_PROVIDER.primary,
      defaultApiUrl: THREE_D_GENERATOR_PROVIDER.defaultApiUrl,
      envKey: THREE_D_GENERATOR_ENV_KEY,
    },
  }
}
