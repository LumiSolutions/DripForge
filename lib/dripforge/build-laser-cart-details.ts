import type { CartItem } from "@/lib/dripforge/types"
import {
  ensureLaserLayers,
  serializeLayersForOrder,
  type LaserDesignerState,
} from "@/lib/dripforge/laser-layers"

type LaserCartDetails = NonNullable<CartItem["customDetails"]>

/**
 * Baut Laser-customDetails inkl. Multi-Layer und aller Bild-Data-URLs für den Warenkorb.
 * Data-URLs bleiben im Cart bis zum Order-Upload.
 */
export function buildLaserCartCustomDetails(
  state: LaserDesignerState,
  base: Partial<LaserCartDetails> = {}
): LaserCartDetails {
  const layers = ensureLaserLayers(state)
  const imageSrcs = layers
    .filter((l) => l.kind === "image" && typeof l.src === "string" && l.src.trim())
    .map((l) => l.src!.trim())

  const primaryImage = imageSrcs[0] ?? state.imageLayout.src ?? null
  const textJoined = layers
    .filter((l) => l.kind === "text")
    .map((l) => (l.text ?? "").trim())
    .filter(Boolean)
    .join("\n\n")

  const engravingText =
    textJoined || state.engravingText.trim() || undefined

  return {
    ...base,
    userText: engravingText,
    engravingText,
    userFont: state.selectedFont,
    uploadedImage: primaryImage,
    uploadedImages: imageSrcs.length > 0 ? imageSrcs : undefined,
    hasText: Boolean(engravingText),
    hasImage: imageSrcs.length > 0 || Boolean(primaryImage),
    productBackgroundUrl:
      base.productBackgroundUrl ?? null,
    layoutCoordinates: {
      textPosition: {
        x: state.textLayout.x,
        y: state.textLayout.y,
        scale: state.textLayout.scale,
        rotation: state.textLayout.rotation,
      },
      imagePosition: {
        x: state.imageLayout.x,
        y: state.imageLayout.y,
        scale: state.imageLayout.scale,
        rotation: state.imageLayout.rotation,
      },
      // Keep data-URL src for order upload; serialize strips only when building persisted snapshot without uploads
      layers: layers.map((layer) =>
        layer.kind === "text"
          ? {
              id: layer.id,
              kind: "text" as const,
              x: layer.x,
              y: layer.y,
              scale: layer.scale,
              scaleX: layer.scaleX ?? layer.scale,
              scaleY: layer.scaleY ?? layer.scale,
              rotation: layer.rotation,
              text: layer.text ?? "",
              fontId: layer.fontId,
            }
          : {
              id: layer.id,
              kind: "image" as const,
              x: layer.x,
              y: layer.y,
              scale: layer.scale,
              scaleX: layer.scaleX ?? layer.scale,
              scaleY: layer.scaleY ?? layer.scale,
              rotation: layer.rotation,
              src: layer.src ?? null,
              hasImage: Boolean(layer.src),
            }
      ),
    },
  }
}

export function laserDesignHasContent(state: LaserDesignerState): boolean {
  const layers = ensureLaserLayers(state)
  if (
    layers.some(
      (l) =>
        (l.kind === "text" && (l.text ?? "").trim().length > 0) ||
        (l.kind === "image" && Boolean(l.src))
    )
  ) {
    return true
  }
  return (
    state.engravingText.trim().length > 0 || Boolean(state.imageLayout.src)
  )
}

/** Persistenz-sichere Layer ohne Data-URLs (nach Azure-Upload). */
export { serializeLayersForOrder }
