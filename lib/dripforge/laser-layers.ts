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
  /** Gemeinsame Gruppen-ID — transformiert gemeinsam (geladenes Design) */
  groupId?: string | null
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
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
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
  // Immer frische Defaults — nie Scale/Rotation eines bestehenden Layers übernehmen,
  // ausser sie wurden explizit im partial gesetzt.
  const scale =
    typeof partial?.scale === "number" && Number.isFinite(partial.scale)
      ? partial.scale
      : DEFAULT_IMAGE_LAYOUT.scale
  return {
    id: partial?.id ?? newId("img"),
    kind: "image",
    x:
      typeof partial?.x === "number" && Number.isFinite(partial.x)
        ? partial.x
        : DEFAULT_IMAGE_LAYOUT.x,
    y:
      typeof partial?.y === "number" && Number.isFinite(partial.y)
        ? partial.y
        : DEFAULT_IMAGE_LAYOUT.y,
    scale,
    scaleX:
      typeof partial?.scaleX === "number" && Number.isFinite(partial.scaleX)
        ? partial.scaleX
        : scale,
    scaleY:
      typeof partial?.scaleY === "number" && Number.isFinite(partial.scaleY)
        ? partial.scaleY
        : scale,
    rotation:
      typeof partial?.rotation === "number" && Number.isFinite(partial.rotation)
        ? partial.rotation
        : DEFAULT_IMAGE_LAYOUT.rotation,
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
    const layers: LaserDesignLayer[] = state.layers.map((layer) =>
      layer.kind === "text"
        ? {
            ...layer,
            text: layer.text ?? "",
            fontId: layer.fontId ?? state.selectedFont ?? DEFAULT_LASER_FONT_ID,
            groupId: layer.groupId ?? null,
          }
        : {
            ...layer,
            src: layer.src ?? null,
            groupId: layer.groupId ?? null,
          }
    )

    // Compat: Bild nur in imageLayout, aber Layers-Array ohne src → nachziehen
    const imageLayout = state.imageLayout
    const layoutSrc = imageLayout?.src?.trim()
    if (
      layoutSrc &&
      !layers.some((l) => l.kind === "image" && Boolean(l.src?.trim()))
    ) {
      layers.push(
        createImageLayer({
          x: imageLayout?.x,
          y: imageLayout?.y,
          scale: imageLayout?.scale,
          scaleX: imageLayout?.scaleX,
          scaleY: imageLayout?.scaleY,
          rotation: imageLayout?.rotation,
          src: layoutSrc,
        })
      )
    }

    return layers
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

export function createLayerGroupId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `grp-${crypto.randomUUID()}`
  }
  return `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Weist allen Layern dieselbe groupId zu (z. B. beim Laden eines Designs). */
export function assignLayersToGroup(
  layers: LaserDesignLayer[],
  groupId?: string
): LaserDesignLayer[] {
  if (layers.length === 0) return layers
  const id = groupId ?? createLayerGroupId()
  return layers.map((layer) => ({ ...layer, groupId: id }))
}

export function ungroupLayers(
  layers: LaserDesignLayer[],
  groupId: string | null | undefined
): LaserDesignLayer[] {
  if (!groupId) return layers
  return layers.map((layer) =>
    layer.groupId === groupId ? { ...layer, groupId: null } : layer
  )
}

export function getLayerGroupMembers(
  layers: LaserDesignLayer[],
  layerId: string
): LaserDesignLayer[] {
  const target = layers.find((l) => l.id === layerId)
  if (!target?.groupId) {
    return target ? [target] : []
  }
  return layers.filter((l) => l.groupId === target.groupId)
}

function groupCentroid(members: LaserDesignLayer[]): { x: number; y: number } {
  if (members.length === 0) return { x: 50, y: 50 }
  const x = members.reduce((sum, m) => sum + m.x, 0) / members.length
  const y = members.reduce((sum, m) => sum + m.y, 0) / members.length
  return { x, y }
}

function rotateAround(
  x: number,
  y: number,
  cx: number,
  cy: number,
  deltaDeg: number
): { x: number; y: number } {
  const rad = (deltaDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = x - cx
  const dy = y - cy
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  }
}

/**
 * Wendet ein Layout-Patch auf ein Layer an — bei groupId auf die ganze Gruppe
 * (relative Abstände bleiben erhalten).
 */
export function applyLayoutPatchToLayerOrGroup(
  layers: LaserDesignLayer[],
  layerId: string,
  patch: Partial<ElementLayout>
): LaserDesignLayer[] {
  const target = layers.find((l) => l.id === layerId)
  if (!target) return layers

  if (!target.groupId) {
    return updateLayerById(layers, layerId, {
      ...layerToElementLayout(target),
      ...patch,
    })
  }

  const members = layers.filter((l) => l.groupId === target.groupId)
  if (members.length <= 1) {
    return updateLayerById(layers, layerId, {
      ...layerToElementLayout(target),
      ...patch,
    })
  }

  const dx = patch.x !== undefined ? patch.x - target.x : 0
  const dy = patch.y !== undefined ? patch.y - target.y : 0

  const startSx = target.scaleX ?? target.scale
  const startSy = target.scaleY ?? target.scale
  const nextSx =
    patch.scaleX !== undefined
      ? patch.scaleX
      : patch.scale !== undefined
        ? patch.scale
        : startSx
  const nextSy =
    patch.scaleY !== undefined
      ? patch.scaleY
      : patch.scale !== undefined
        ? patch.scale
        : startSy
  const ratioX = startSx !== 0 ? nextSx / startSx : 1
  const ratioY = startSy !== 0 ? nextSy / startSy : 1
  const scaleChanged =
    patch.scale !== undefined ||
    patch.scaleX !== undefined ||
    patch.scaleY !== undefined

  const rotDelta =
    patch.rotation !== undefined
      ? patch.rotation - target.rotation
      : 0

  const centroid = groupCentroid(members)

  return layers.map((layer) => {
    if (layer.groupId !== target.groupId) return layer

    let x = layer.x + dx
    let y = layer.y + dy
    let scale = layer.scale
    let scaleX = layer.scaleX ?? layer.scale
    let scaleY = layer.scaleY ?? layer.scale
    let rotation = layer.rotation

    if (scaleChanged) {
      x = centroid.x + (x - centroid.x) * ratioX
      y = centroid.y + (y - centroid.y) * ratioY
      scaleX = scaleX * ratioX
      scaleY = scaleY * ratioY
      scale = (scaleX + scaleY) / 2
    }

    if (rotDelta !== 0) {
      const rotated = rotateAround(x, y, centroid.x, centroid.y, rotDelta)
      x = rotated.x
      y = rotated.y
      rotation = layer.rotation + rotDelta
    }

    return {
      ...layer,
      x,
      y,
      scale,
      scaleX,
      scaleY,
      rotation,
    }
  })
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
  groupId?: string | null
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
        groupId: layer.groupId ?? null,
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
      groupId: layer.groupId ?? null,
    }
  })
}
