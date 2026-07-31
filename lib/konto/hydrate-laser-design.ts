import {
  createDefaultLaserDesignerState,
  type LaserDesignerState,
} from "@/components/dripforge/shared/laser-designer-studio"
import {
  DEFAULT_IMAGE_LAYOUT,
  DEFAULT_LASER_FONT_ID,
  DEFAULT_TEXT_LAYOUT,
  type LaserFontId,
} from "@/lib/dripforge/laser-design"
import {
  ensureLaserLayers,
  type LaserDesignLayer,
} from "@/lib/dripforge/laser-layers"
import type { LaserMaterial } from "@/lib/dripforge/types"

function asLayers(raw: unknown): LaserDesignLayer[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((layer): layer is LaserDesignLayer => {
    if (!layer || typeof layer !== "object") return false
    const kind = (layer as LaserDesignLayer).kind
    return kind === "text" || kind === "image"
  })
}

/** Hydriert LaserDesignerState aus gespeichertem Design-config / Order-config. */
export function hydrateLaserDesignerFromConfig(
  config: Record<string, unknown>,
  material: LaserMaterial,
  varianten: string[] = []
): LaserDesignerState {
  const base = createDefaultLaserDesignerState(material, varianten)

  const selectedVariant =
    (typeof config.selectedVariant === "string" && config.selectedVariant) ||
    (typeof config.materialVariant === "string" && config.materialVariant) ||
    (typeof config.variant === "string" && config.variant) ||
    base.selectedVariant

  const selectedFont = (
    typeof config.selectedFont === "string"
      ? config.selectedFont
      : typeof config.userFont === "string"
        ? config.userFont
        : DEFAULT_LASER_FONT_ID
  ) as LaserFontId

  const engravingText =
    (typeof config.engravingText === "string" && config.engravingText) ||
    (typeof config.userText === "string" && config.userText) ||
    ""

  const layoutCoords =
    config.layoutCoordinates && typeof config.layoutCoordinates === "object"
      ? (config.layoutCoordinates as Record<string, unknown>)
      : null

  const layersFromConfig = asLayers(
    Array.isArray(config.layers) ? config.layers : layoutCoords?.layers
  )

  const textLayout =
    config.textLayout && typeof config.textLayout === "object"
      ? { ...DEFAULT_TEXT_LAYOUT, ...(config.textLayout as object) }
      : layoutCoords?.textPosition && typeof layoutCoords.textPosition === "object"
        ? {
            ...DEFAULT_TEXT_LAYOUT,
            ...(layoutCoords.textPosition as object),
          }
        : { ...DEFAULT_TEXT_LAYOUT }

  const imageLayoutRaw =
    config.imageLayout && typeof config.imageLayout === "object"
      ? { ...DEFAULT_IMAGE_LAYOUT, ...(config.imageLayout as object) }
      : layoutCoords?.imagePosition && typeof layoutCoords.imagePosition === "object"
        ? {
            ...DEFAULT_IMAGE_LAYOUT,
            ...(layoutCoords.imagePosition as object),
          }
        : { ...DEFAULT_IMAGE_LAYOUT }

  const uploadedImage =
    typeof config.uploadedImage === "string"
      ? config.uploadedImage
      : typeof imageLayoutRaw.src === "string"
        ? imageLayoutRaw.src
        : null

  const imageLayout = {
    ...DEFAULT_IMAGE_LAYOUT,
    ...imageLayoutRaw,
    src: uploadedImage,
  }

  const draft: LaserDesignerState = {
    ...base,
    selectedVariant,
    selectedFont,
    engravingText,
    textLayout: {
      x: Number(textLayout.x) || DEFAULT_TEXT_LAYOUT.x,
      y: Number(textLayout.y) || DEFAULT_TEXT_LAYOUT.y,
      scale: Number(textLayout.scale) || DEFAULT_TEXT_LAYOUT.scale,
      scaleX: Number(textLayout.scaleX) || undefined,
      scaleY: Number(textLayout.scaleY) || undefined,
      rotation: Number(textLayout.rotation) || 0,
    },
    imageLayout,
    layers: layersFromConfig,
    activeLayerId: null,
  }

  return {
    ...draft,
    layers: ensureLaserLayers(draft),
  }
}
