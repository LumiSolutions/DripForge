/**
 * Transparenter Produktions-Composite — alle Layer ohne Produkthintergrund.
 * Geometrie entspricht dem Combined-Mockup (1:1 zur Live-Vorschau).
 */

import {
  ensureLaserFontsReady,
  getLaserFontFamilyForCanvas,
  getLaserFontOption,
  getLaserPreviewBaseFontPx,
  type LaserFontId,
} from "@/lib/dripforge/laser-fonts"
import type { ElementLayout, ImageLayout } from "@/lib/dripforge/laser-design"
import type { LaserDesignLayer } from "@/lib/dripforge/laser-layers"
import {
  DEFAULT_EXPORT_SIZE,
  DEFAULT_REFERENCE_PREVIEW_WIDTH,
  PREVIEW_BASE_IMAGE_HEIGHT_PX,
  type CompositeMockupLayer,
} from "@/lib/dripforge/render-laser-composite-mockup"

export type ProductionLayerCaptureInput = {
  width?: number
  height?: number
  /** Bevorzugt: alle Designer-Layer */
  layers?: Array<LaserDesignLayer | CompositeMockupLayer>
  /** Legacy-Fallback (einzelnes Bild + Text) */
  textLayout?: ElementLayout
  imageLayout?: ImageLayout
  engravingText?: string
  fontId?: string
  referencePreviewWidth?: number
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Bild konnte nicht geladen werden."))
    img.src = src
  })
}

function applyCssLikeTransform(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  rotationDeg: number
) {
  ctx.translate(cx, cy)
  ctx.scale(sx || 1, sy || 1)
  ctx.rotate(((rotationDeg || 0) * Math.PI) / 180)
}

function resolveLayers(
  input: ProductionLayerCaptureInput
): CompositeMockupLayer[] {
  if (Array.isArray(input.layers) && input.layers.length > 0) {
    return input.layers.map((layer) => ({
      id: layer.id,
      kind: layer.kind,
      x: layer.x,
      y: layer.y,
      scale: layer.scale,
      scaleX: layer.scaleX,
      scaleY: layer.scaleY,
      rotation: layer.rotation,
      text: layer.text,
      fontId: layer.fontId,
      src: layer.src,
    }))
  }

  const legacy: CompositeMockupLayer[] = []
  if (input.imageLayout?.src) {
    legacy.push({
      kind: "image",
      x: input.imageLayout.x,
      y: input.imageLayout.y,
      scale: input.imageLayout.scale,
      rotation: input.imageLayout.rotation,
      src: input.imageLayout.src,
    })
  }
  const text = (input.engravingText ?? "").trim()
  if (text && input.textLayout) {
    legacy.push({
      kind: "text",
      x: input.textLayout.x,
      y: input.textLayout.y,
      scale: input.textLayout.scale,
      rotation: input.textLayout.rotation,
      text,
      fontId: input.fontId,
    })
  }
  return legacy
}

/**
 * Rendert alle platzierten Grafiken/Texte auf transparentem Canvas
 * (ohne Produkthintergrund). Ergebnis: production_layer.png als data-URL.
 */
export async function captureProductionLayerPng(
  input: ProductionLayerCaptureInput
): Promise<string | null> {
  if (typeof document === "undefined") return null

  const layers = resolveLayers(input)
  if (layers.length === 0) return null

  const size = Math.max(
    256,
    Math.round(input.width ?? input.height ?? DEFAULT_EXPORT_SIZE)
  )
  const refW = Math.max(
    120,
    Math.round(input.referencePreviewWidth ?? DEFAULT_REFERENCE_PREVIEW_WIDTH)
  )
  const scaleFactor = size / refW

  const textFontIds = layers
    .filter((l) => l.kind === "text" && (l.text ?? "").trim())
    .map((l) => (l.fontId as LaserFontId) || "modern")
  await ensureLaserFontsReady(textFontIds)

  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  ctx.clearRect(0, 0, size, size)

  for (const layer of layers) {
    const cx = (layer.x / 100) * size
    const cy = (layer.y / 100) * size
    const sx = Number.isFinite(layer.scaleX)
      ? (layer.scaleX as number)
      : layer.scale
    const sy = Number.isFinite(layer.scaleY)
      ? (layer.scaleY as number)
      : layer.scale

    if (layer.kind === "image" && layer.src) {
      try {
        const img = await loadImage(layer.src)
        const iw = img.naturalWidth || img.width
        const ih = img.naturalHeight || img.height
        if (iw <= 0 || ih <= 0) continue
        const baseH = PREVIEW_BASE_IMAGE_HEIGHT_PX * scaleFactor
        const baseW = baseH * (iw / ih)
        ctx.save()
        applyCssLikeTransform(ctx, cx, cy, sx || 1, sy || 1, layer.rotation || 0)
        ctx.drawImage(img, -baseW / 2, -baseH / 2, baseW, baseH)
        ctx.restore()
      } catch (error) {
        console.warn(
          "Produktions-Layer: Bild konnte nicht gezeichnet werden.",
          error
        )
      }
      continue
    }

    if (layer.kind === "text") {
      const text = (layer.text ?? "").trim()
      if (!text) continue
      const fontId = (layer.fontId as LaserFontId) || "modern"
      const fontFamily = getLaserFontFamilyForCanvas(fontId)
      const opt = getLaserFontOption(fontId)
      const weight =
        fontId === "kalligrafie" || fontId === "schwungvoll"
          ? "400"
          : typeof opt.canvasStyle?.fontWeight === "number" ||
              typeof opt.canvasStyle?.fontWeight === "string"
            ? String(opt.canvasStyle.fontWeight)
            : "700"
      const fontPx = getLaserPreviewBaseFontPx(fontId) * scaleFactor
      const uppercase = opt.canvasStyle?.textTransform === "uppercase"

      ctx.save()
      applyCssLikeTransform(ctx, cx, cy, sx || 1, sy || 1, layer.rotation || 0)
      ctx.font = `${weight} ${fontPx}px ${fontFamily}`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillStyle = "#111111"
      const lines = text.split("\n").map((l) => (uppercase ? l.toUpperCase() : l))
      const lineHeight = fontPx * 1.25
      const startY = -((lines.length - 1) * lineHeight) / 2
      lines.forEach((line, i) => {
        ctx.fillText(line, 0, startY + i * lineHeight)
      })
      ctx.restore()
    }
  }

  try {
    const dataUrl = canvas.toDataURL("image/png")
    if (!dataUrl || dataUrl === "data:,") return null
    return dataUrl
  } catch (error) {
    console.warn("Produktions-Layer: Export fehlgeschlagen.", error)
    return null
  }
}
