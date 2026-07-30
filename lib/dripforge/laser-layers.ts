import {
  DEFAULT_IMAGE_LAYOUT,
  DEFAULT_LASER_FONT_ID,
  DEFAULT_TEXT_LAYOUT,
  type ElementLayout,
  type ImageLayout,
  type LaserFontId,
} from "@/lib/dripforge/laser-design"

export type LaserDesignLayerKind = "text" | "image"

export type LaserDesignLayer = {
  id: string
  kind: LaserDesignLayerKind
  x: number
  y: number
  scale: number
  scaleX?: number
  scaleY?: number
  rotation: number
  /** Textinhalt (nur kind=text) */
  text?: string
  fontId?: LaserFontId
  /** Bild-Data-URL oder HTTP-URL (nur kind=image) */
  src?: string | null
}

export type LaserDesignerState = {
  selectedVariant: string
  selectedFont: LaserFontId
  engravingText: string
  textLayout: ElementLayout
  imageLayout: ImageLayout
  layers: LaserDesignLayer[]
  activeLayerId: string | null
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function createTextLayer(
  partial?: Partial<LaserDesignLayer> & { text?: string; fontId?: LaserFontId }
): LaserDesignLayer {
  const scale = partial?.scale ?? DEFAULT_TEXT_LAYOUT.scale
  return {
    id: partial?.id ?? newId("text"),
    kind: "text",
    x: partial?.x ?? DEFAULT_TEXT_LAYOUT.x,
    y: partial?.y ?? DEFAULT_TEXT_LAYOUT.y,
    scale,
    scaleX: partial?.scaleX ?? scale,
    scaleY: partial?.scaleY ?? scale,
    rotation: partial?.rotation ?? DEFAULT_TEXT_LAYOUT.rotation,
    text: partial?.text ?? "",
    fontId: partial?.fontId ?? DEFAULT_LASER_FONT_ID,
  }
}

export function createImageLayer(
  partial?: Partial<LaserDesignLayer> & { src?: string | null }
): LaserDesignLayer {
  const scale = partial?.scale ?? DEFAULT_IMAGE_LAYOUT.scale
  return {
    id: partial?.id ?? newId("img"),
    kind: "image",
    x: partial?.x ?? DEFAULT_IMAGE_LAYOUT.x,
    y: partial?.y ?? DEFAULT_IMAGE_LAYOUT.y + (partial?.src ? 0 : 0),
    scale,
    scaleX: partial?.scaleX ?? scale,
    scaleY: partial?.scaleY ?? scale,
    rotation: partial?.rotation ?? DEFAULT_IMAGE_LAYOUT.rotation,
    src: partial?.src ?? null,
  }
}

export function layerToElementLayout(layer: LaserDesignLayer): ElementLayout {
  const scale = layer.scale
  return {
    x: layer.x,
    y: layer.y,
    scale,
    scaleX: layer.scaleX ?? scale,
    scaleY: layer.scaleY ?? scale,
    rotation: layer.rotation,
  }
}

export function patchLayerLayout(
  layer: LaserDesignLayer,
  patch: Partial<ElementLayout>
): LaserDesignLayer {
  return {
    ...layer,
    ...patch,
  }
}

/** Baut Layers aus Legacy-Feldern, falls noch kein Layer-Array vorhanden. */
export function ensureLaserLayers(
  state: {
    layers?: LaserDesignLayer[] | null
    engravingText?: string
    selectedFont?: LaserFontId
    textLayout?: ElementLayout
    imageLayout?: ImageLayout
  }
): LaserDesignLayer[] {
  if (Array.isArray(state.layers) && state.layers.length > 0) {
    return state.layers.map((layer) =>
      layer.kind === "text"
        ? {
            ...layer,
            text: layer.text ?? "",
            fontId: layer.fontId ?? state.selectedFont ?? DEFAULT_LASER_FONT_ID,
          }
        : {
            ...layer,
            src: layer.src ?? null,
          }
    )
  }

  const layers: LaserDesignLayer[] = []
  const text = state.engravingText?.trim() ?? ""
  const textLayout = state.textLayout ?? DEFAULT_TEXT_LAYOUT
  if (text) {
    layers.push(
      createTextLayer({
        ...textLayout,
        text: state.engravingText ?? "",
        fontId: state.selectedFont ?? DEFAULT_LASER_FONT_ID,
      })
    )
  }

  const imageLayout = state.imageLayout ?? DEFAULT_IMAGE_LAYOUT
  if (imageLayout.src) {
    layers.push(
      createImageLayer({
        ...imageLayout,
        src: imageLayout.src,
      })
    )
  }

  return layers
}

export function deriveCompatFromLayers(
  layers: LaserDesignLayer[],
  fallbackFont: LaserFontId = DEFAULT_LASER_FONT_ID
): {
  engravingText: string
  selectedFont: LaserFontId
  textLayout: ElementLayout
  imageLayout: ImageLayout
} {
  const textLayers = layers.filter((l) => l.kind === "text")
  const imageLayers = layers.filter((l) => l.kind === "image" && l.src)

  const primaryText = textLayers[0]
  const primaryImage = imageLayers[0]

  return {
    engravingText: textLayers.map((l) => l.text ?? "").join("\n\n"),
    selectedFont: primaryText?.fontId ?? fallbackFont,
    textLayout: primaryText
      ? layerToElementLayout(primaryText)
      : { ...DEFAULT_TEXT_LAYOUT },
    imageLayout: primaryImage
      ? {
          ...layerToElementLayout(primaryImage),
          src: primaryImage.src ?? null,
        }
      : { ...DEFAULT_IMAGE_LAYOUT },
  }
}

export function findLayer(
  layers: LaserDesignLayer[],
  id: string | null | undefined
): LaserDesignLayer | null {
  if (!id) return null
  return layers.find((l) => l.id === id) ?? null
}

export function updateLayerById(
  layers: LaserDesignLayer[],
  id: string,
  patch: Partial<LaserDesignLayer>
): LaserDesignLayer[] {
  return layers.map((layer) =>
    layer.id === id ? { ...layer, ...patch } : layer
  )
}

export function removeLayerById(
  layers: LaserDesignLayer[],
  id: string
): LaserDesignLayer[] {
  return layers.filter((layer) => layer.id !== id)
}

/** Offset für neu hinzugefügte Elemente, damit sie sich nicht überdecken. */
export function nextLayerOffset(index: number): { x: number; y: number } {
  const step = (index % 5) * 4
  return {
    x: Math.min(70, 42 + step),
    y: Math.min(70, 40 + step),
  }
}

export type SerializedLaserLayer = {
  id: string
  kind: LaserDesignLayerKind
  x: number
  y: number
  scale: number
  scaleX?: number
  scaleY?: number
  rotation: number
  text?: string
  fontId?: string
  src?: string | null
  hasImage?: boolean
}

export function serializeLayersForOrder(
  layers: LaserDesignLayer[]
): SerializedLaserLayer[] {
  return layers.map((layer) => {
    if (layer.kind === "text") {
      return {
        id: layer.id,
        kind: "text",
        x: layer.x,
        y: layer.y,
        scale: layer.scale,
        scaleX: layer.scaleX ?? layer.scale,
        scaleY: layer.scaleY ?? layer.scale,
        rotation: layer.rotation,
        text: layer.text ?? "",
        fontId: layer.fontId,
      }
    }
    return {
      id: layer.id,
      kind: "image",
      x: layer.x,
      y: layer.y,
      scale: layer.scale,
      scaleX: layer.scaleX ?? layer.scale,
      scaleY: layer.scaleY ?? layer.scale,
      rotation: layer.rotation,
      src: layer.src?.startsWith("data:") ? null : layer.src ?? null,
      hasImage: Boolean(layer.src),
    }
  })
}
