import { getLaserFontFamily } from "@/lib/dripforge/laser-fonts"
import type { ElementLayout, ImageLayout } from "@/lib/dripforge/laser-design"

export type ProductionLayerCaptureInput = {
  width?: number
  height?: number
  textLayout: ElementLayout
  imageLayout: ImageLayout
  engravingText: string
  fontId: string
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

/**
 * Rendert nur Text + Bild auf transparentem Canvas (ohne Produkthintergrund).
 * Ergebnis: production_layer.png als data:image/png;base64,…
 */
export async function captureProductionLayerPng(
  input: ProductionLayerCaptureInput
): Promise<string | null> {
  if (typeof document === "undefined") return null

  const width = Math.max(256, Math.round(input.width ?? 1024))
  const height = Math.max(256, Math.round(input.height ?? 1024))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  ctx.clearRect(0, 0, width, height)

  const { imageLayout, textLayout, engravingText, fontId } = input

  if (imageLayout.src) {
    try {
      const img = await loadImage(imageLayout.src)
      const cx = (imageLayout.x / 100) * width
      const cy = (imageLayout.y / 100) * height
      const base = Math.min(width, height) * 0.42
      const drawW = base * imageLayout.scale
      const drawH = (img.naturalHeight / Math.max(1, img.naturalWidth)) * drawW
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(((imageLayout.rotation || 0) * Math.PI) / 180)
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH)
      ctx.restore()
    } catch (error) {
      console.warn("Produktions-Layer: Bild konnte nicht gezeichnet werden.", error)
    }
  }

  const text = engravingText.trim()
  if (text) {
    const cx = (textLayout.x / 100) * width
    const cy = (textLayout.y / 100) * height
    const fontPx = Math.max(12, Math.round(Math.min(width, height) * 0.055 * textLayout.scale))
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(((textLayout.rotation || 0) * Math.PI) / 180)
    ctx.fillStyle = "#111111"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.font = `700 ${fontPx}px ${getLaserFontFamily(fontId as import("@/lib/dripforge/laser-fonts").LaserFontId)}, sans-serif`
    const lines = text.split(/\n/)
    const lineHeight = fontPx * 1.15
    const startY = -((lines.length - 1) * lineHeight) / 2
    lines.forEach((line, i) => {
      ctx.fillText(line, 0, startY + i * lineHeight)
    })
    ctx.restore()
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
