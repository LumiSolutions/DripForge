/**
 * Programmatisches Composite-Mockup — skaliert 1:1 relativ zur Live-Vorschau.
 *
 * Referenz: Live-Vorschau nutzt absolute CSS-Grössen (max-h-32 = 128px,
 * Font ~clamp 0.875–1.25rem) auf einem quadratischen Preview der Breite
 * `referencePreviewWidth`. Export skaliert alle Masse mit
 * `exportSize / referencePreviewWidth`.
 */

import {
  getLaserFontFamily,
  getLaserFontOption,
  type LaserFontId,
} from "@/lib/dripforge/laser-fonts"

export type CompositeMockupLayer = {
  id?: string
  kind: "text" | "image"
  x: number
  y: number
  scale: number
  scaleX?: number
  scaleY?: number
  rotation: number
  text?: string
  fontId?: string
  src?: string | null
}

/** Live-Vorschau: Tailwind max-h-32 */
export const PREVIEW_BASE_IMAGE_HEIGHT_PX = 128
/** Live-Vorschau: typische Canvas-Font (~1.25rem) */
export const PREVIEW_BASE_TEXT_FONT_PX = 20
/** Fallback wenn keine Preview-Breite gemessen werden kann */
export const DEFAULT_REFERENCE_PREVIEW_WIDTH = 420
export const DEFAULT_EXPORT_SIZE = 1200

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Composite-Mockup nur im Browser."))
      return
    }
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () =>
      reject(new Error("Bild für Composite-Mockup konnte nicht geladen werden."))
    img.src = src
  })
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  size: number
) {
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  if (iw <= 0 || ih <= 0) return
  const scale = Math.max(size / iw, size / ih)
  const dw = iw * scale
  const dh = ih * scale
  ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh)
}

/**
 * Entspricht CSS:
 * left/top % + transform: translate(-50%,-50%) scale(sx,sy) rotate(deg)
 * → Zentrum auf (x%, y%), dann Scale, dann Rotation ums Zentrum.
 */
function applyCssLikeTransform(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  rotationDeg: number
) {
  ctx.translate(cx, cy)
  // CSS left-to-right after translate(-50%): scale then rotate
  ctx.scale(sx || 1, sy || 1)
  ctx.rotate(((rotationDeg || 0) * Math.PI) / 180)
}

/**
 * Rendert das kombinierte Endprodukt-Mockup für Cockpit/Admin.
 * `referencePreviewWidth` = gemessene Live-Vorschau-Breite (px), damit
 * Font/Bild-Grössen proportional zum Screen-Preview bleiben.
 */
export async function renderLaserCompositeMockup(args: {
  backgroundUrl?: string | null
  layers: CompositeMockupLayer[]
  size?: number
  /** Breite der Live-Vorschau in CSS-Pixeln (für 1:1 Skalierung) */
  referencePreviewWidth?: number
}): Promise<string | null> {
  if (typeof window === "undefined") return null

  const size = Math.max(256, Math.round(args.size ?? DEFAULT_EXPORT_SIZE))
  const refW = Math.max(
    120,
    Math.round(args.referencePreviewWidth ?? DEFAULT_REFERENCE_PREVIEW_WIDTH)
  )
  const unit = size / refW

  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, size, size)

  if (args.backgroundUrl) {
    try {
      const bg = await loadImage(args.backgroundUrl)
      drawCover(ctx, bg, size)
    } catch {
      ctx.fillStyle = "#1e293b"
      ctx.fillRect(0, 0, size, size)
    }
  } else {
    const gradient = ctx.createLinearGradient(0, 0, size, size)
    gradient.addColorStop(0, "#64748b")
    gradient.addColorStop(0.5, "#334155")
    gradient.addColorStop(1, "#0f172a")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }

  for (const layer of args.layers) {
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
        // max-h-32 in Preview → proportional im Export
        const baseH = PREVIEW_BASE_IMAGE_HEIGHT_PX * unit
        const baseW = baseH * (iw / ih)
        ctx.save()
        applyCssLikeTransform(ctx, cx, cy, sx || 1, sy || 1, layer.rotation || 0)
        ctx.globalAlpha = 0.9
        ctx.filter = "grayscale(1)"
        ctx.drawImage(img, -baseW / 2, -baseH / 2, baseW, baseH)
        ctx.filter = "none"
        ctx.restore()
      } catch {
        /* skip */
      }
      continue
    }

    if (layer.kind === "text") {
      const text = (layer.text ?? "").trim()
      if (!text) continue
      const fontId = (layer.fontId as LaserFontId) || "modern"
      const fontFamily = getLaserFontFamily(fontId)
      const opt = getLaserFontOption(fontId)
      const weight =
        typeof opt.canvasStyle?.fontWeight === "number" ||
        typeof opt.canvasStyle?.fontWeight === "string"
          ? String(opt.canvasStyle.fontWeight)
          : "600"
      const fontPx = PREVIEW_BASE_TEXT_FONT_PX * unit
      const letterSpacing =
        typeof opt.canvasStyle?.letterSpacing === "string"
          ? opt.canvasStyle.letterSpacing
          : undefined
      const uppercase =
        opt.canvasStyle?.textTransform === "uppercase"

      ctx.save()
      applyCssLikeTransform(ctx, cx, cy, sx || 1, sy || 1, layer.rotation || 0)
      ctx.font = `${weight} ${fontPx}px ${fontFamily}`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillStyle = "rgba(255,255,255,0.9)"
      ctx.shadowColor = "rgba(0,0,0,0.8)"
      ctx.shadowBlur = 8 * unit
      const lines = text.split("\n").map((l) =>
        uppercase ? l.toUpperCase() : l
      )
      const lineHeight = fontPx * 1.25
      const startY = -((lines.length - 1) * lineHeight) / 2
      lines.forEach((line, i) => {
        const draw = line
        if (letterSpacing && letterSpacing !== "normal") {
          // einfache Annäherung: fillText reicht für Mockup
          ctx.fillText(draw, 0, startY + i * lineHeight)
        } else {
          ctx.fillText(draw, 0, startY + i * lineHeight)
        }
      })
      ctx.restore()
    }
  }

  try {
    return canvas.toDataURL("image/png")
  } catch {
    return null
  }
}
