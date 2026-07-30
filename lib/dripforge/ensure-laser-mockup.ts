import type { CartItem } from "@/lib/dripforge/types"
import { ensureLaserLayers, type LaserDesignLayer } from "@/lib/dripforge/laser-layers"
import { renderLaserCompositeMockup } from "@/lib/dripforge/render-laser-composite-mockup"
import { captureLaserPreviewMockup } from "@/lib/dripforge/capture-leitbild"

/**
 * Stellt sicher, dass ein Laser-Cart-Item ein Combined Composite Mockup hat
 * (Produkt-Hintergrund + alle Layer). Fallback: html2canvas der Live-Vorschau.
 */
export async function buildLaserCombinedMockup(args: {
  layers: LaserDesignLayer[]
  backgroundUrl?: string | null
  previewRoot?: HTMLElement | null
}): Promise<string | undefined> {
  try {
    const composite = await renderLaserCompositeMockup({
      backgroundUrl: args.backgroundUrl ?? null,
      layers: args.layers,
      size: 900,
    })
    if (composite) return composite
  } catch (err) {
    console.warn("Composite-Mockup-Render fehlgeschlagen:", err)
  }

  if (args.previewRoot) {
    try {
      const snap = await captureLaserPreviewMockup(args.previewRoot)
      if (snap) return snap
    } catch (err) {
      console.warn("html2canvas-Mockup-Fallback fehlgeschlagen:", err)
    }
  }

  return undefined
}

/** Vor Checkout: fehlende/ungenügende Mockups aus Layer-Daten neu erzeugen. */
export async function ensureCartLaserMockups(
  items: CartItem[]
): Promise<CartItem[]> {
  const next: CartItem[] = []
  for (const item of items) {
    if (item.type !== "laser") {
      next.push(item)
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

    const backgroundUrl =
      details?.productBackgroundUrl ??
      null

    // Immer neu rendern wenn Layer vorhanden — zuverlässigeres Combined Mockup
    if (layers.some((l) => (l.kind === "image" && l.src) || (l.kind === "text" && (l.text ?? "").trim()))) {
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
