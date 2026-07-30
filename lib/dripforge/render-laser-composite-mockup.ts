/**
 * Programmatisches Composite-Mockup: Produkt-Hintergrund + alle Laser-Layer
 * (Bilder/Texte inkl. Position, Scale, Rotation) → PNG Data-URL.
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

const DEFAULT_SIZE = 900
/** Entspricht Live-Vorschau max-h-32 bei scale=1 */
const BASE_IMAGE_HEIGHT_PX = 128
/** Entspricht ca. clamp(0.875rem, 3.5vw, 1.25rem) auf Desktop */
const BASE_TEXT_FONT_PX = 20

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
 * Rendert das kombinierte Endprodukt-Mockup für Cockpit/Admin.
 */
export async function renderLaserCompositeMockup(args: {
  backgroundUrl?: string | null
  layers: CompositeMockupLayer[]
  size?: number
}): Promise<string | null> {
  if (typeof window === "undefined") return null

  const size = Math.max(256, Math.round(args.size ?? DEFAULT_SIZE))
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
      // Material-Fallback ohne Hintergrund
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

  const scaleFactor = size / 400

  for (const layer of args.layers) {
    const cx = (layer.x / 100) * size
    const cy = (layer.y / 100) * size
    const sx = Number.isFinite(layer.scaleX) ? (layer.scaleX as number) : layer.scale
    const sy = Number.isFinite(layer.scaleY) ? (layer.scaleY as number) : layer.scale
    const rotationRad = ((layer.rotation || 0) * Math.PI) / 180

    if (layer.kind === "image" && layer.src) {
      try {
        const img = await loadImage(layer.src)
        const iw = img.naturalWidth || img.width
        const ih = img.naturalHeight || img.height
        if (iw <= 0 || ih <= 0) continue
        const baseH = BASE_IMAGE_HEIGHT_PX * scaleFactor
        const baseW = baseH * (iw / ih)
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(rotationRad)
        ctx.scale(sx || 1, sy || 1)
        ctx.globalAlpha = 0.92
        ctx.filter = "grayscale(1)"
        ctx.drawImage(img, -baseW / 2, -baseH / 2, baseW, baseH)
        ctx.filter = "none"
        ctx.restore()
      } catch {
        // Layer überspringen
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
      const fontPx = BASE_TEXT_FONT_PX * scaleFactor

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(rotationRad)
      ctx.scale(sx || 1, sy || 1)
      ctx.font = `${weight} ${fontPx}px ${fontFamily}`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillStyle = "rgba(255,255,255,0.92)"
      ctx.shadowColor = "rgba(0,0,0,0.8)"
      ctx.shadowBlur = 8
      const lines = text.split("\n")
      const lineHeight = fontPx * 1.25
      const startY = -((lines.length - 1) * lineHeight) / 2
      lines.forEach((line, i) => {
        ctx.fillText(line, 0, startY + i * lineHeight)
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
