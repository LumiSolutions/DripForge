import type { CartItem } from "@/lib/dripforge/types"
import { ensureLaserLayers, type LaserDesignLayer } from "@/lib/dripforge/laser-layers"
import {
  DEFAULT_EXPORT_SIZE,
  DEFAULT_REFERENCE_PREVIEW_WIDTH,
  renderLaserCompositeMockup,
} from "@/lib/dripforge/render-laser-composite-mockup"
import { captureLaserPreviewMockup } from "@/lib/dripforge/capture-leitbild"

function isUsableMockup(src: string | null | undefined): src is string {
  return (
    typeof src === "string" &&
    src.length > 64 &&
    (src.startsWith("data:image/") || /^https?:\/\//i.test(src) || src.startsWith("/"))
  )
}

/**
 * Combined Mockup: bevorzugt exakten Live-Vorschau-Snapshot (html2canvas),
 * Fallback: programmatischer Export mit Preview-Breiten-Skalierung.
 */
export async function buildLaserCombinedMockup(args: {
  layers: LaserDesignLayer[]
  backgroundUrl?: string | null
  previewRoot?: HTMLElement | null
}): Promise<string | undefined> {
  // Fonts vor jedem Export laden (html2canvas + programmatisch)
  const { ensureLaserFontsReady } = await import("@/lib/dripforge/laser-fonts")
  const textIds = args.layers
    .filter((l) => l.kind === "text" && (l.text ?? "").trim())
    .map((l) => l.fontId)
    .filter(Boolean) as import("@/lib/dripforge/laser-fonts").LaserFontId[]
  await ensureLaserFontsReady(textIds)

  const hasImageLayers = args.layers.some(
    (l) => l.kind === "image" && Boolean(l.src?.trim())
  )
  const refW =
    args.previewRoot?.getBoundingClientRect().width ||
    DEFAULT_REFERENCE_PREVIEW_WIDTH

  // Bei Bild-Layern zuerst programmatisch rendern — html2canvas kann Data-URLs /
  // frisch gemountete Bilder verpassen und nur den Produkt-Hintergrund speichern.
  let programmatic: string | undefined
  try {
    const composite = await renderLaserCompositeMockup({
      backgroundUrl: args.backgroundUrl ?? null,
      layers: args.layers,
      size: DEFAULT_EXPORT_SIZE,
      referencePreviewWidth: refW,
    })
    if (composite) programmatic = composite
  } catch (err) {
    console.warn("Composite-Mockup-Render fehlgeschlagen:", err)
  }

  if (hasImageLayers && programmatic) {
    return programmatic
  }

  if (args.previewRoot) {
    try {
      const snap = await captureLaserPreviewMockup(args.previewRoot)
      if (snap) return snap
    } catch (err) {
      console.warn("html2canvas-Mockup fehlgeschlagen, programmatischer Fallback:", err)
    }
  }

  return programmatic
}

/**
 * Vor Checkout: fehlende Mockups aus Layer-Daten erzeugen.
 * Vorhandene gute Live-Captures werden NICHT überschrieben (1:1-Qualität).
 */
export async function ensureCartLaserMockups(
  items: CartItem[]
): Promise<CartItem[]> {
  const next: CartItem[] = []
  for (const item of items) {
    if (item.type !== "laser") {
      next.push(item)
      continue
    }

    const existing =
      (isUsableMockup(item.previewMockup) && item.previewMockup) ||
      (isUsableMockup(item.leitbild) && item.leitbild) ||
      null

    // Gutes Captures aus dem Konfigurator beibehalten
    if (existing) {
      next.push({
        ...item,
        previewMockup: existing,
        leitbild: existing,
      })
      continue
    }

    const details = item.customDetails
    const layerRaw = details?.layoutCoordinates?.layers
    const layers: LaserDesignLayer[] = Array.isArray(layerRaw)
      ? (layerRaw as LaserDesignLayer[])
      : ensureLaserLayers({
          engravingText: details?.engravingText ?? details?.userText ?? "",
          selectedFont: (details?.userFont as never) ?? undefined,
          imageLayout: {
            x: details?.layoutCoordinates?.imagePosition?.x ?? 50,
            y: details?.layoutCoordinates?.imagePosition?.y ?? 38,
            scale: details?.layoutCoordinates?.imagePosition?.scale ?? 1,
            rotation: details?.layoutCoordinates?.imagePosition?.rotation ?? 0,
            src: details?.uploadedImage ?? null,
          },
        })

    const backgroundUrl = details?.productBackgroundUrl ?? null

    if (
      layers.some(
        (l) =>
          (l.kind === "image" && l.src) ||
          (l.kind === "text" && (l.text ?? "").trim())
      )
    ) {
      const mockup = await buildLaserCombinedMockup({
        layers,
        backgroundUrl,
      })
      if (mockup) {
        next.push({
          ...item,
          previewMockup: mockup,
          leitbild: mockup,
        })
        continue
      }
    }

    next.push(item)
  }
  return next
}
