/** Pixel-Engine für Freistellen (HD-Quelldaten, ohne UI). */

export type Rgba = { r: number; g: number; b: number; a: number }

export function cloneImageData(source: ImageData): ImageData {
  return new ImageData(
    new Uint8ClampedArray(source.data),
    source.width,
    source.height
  )
}

export function colorDistance(a: Rgba, b: Rgba): number {
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

export function samplePixel(
  data: ImageData,
  x: number,
  y: number
): Rgba | null {
  const px = Math.max(0, Math.min(data.width - 1, Math.floor(x)))
  const py = Math.max(0, Math.min(data.height - 1, Math.floor(y)))
  const i = (py * data.width + px) * 4
  return {
    r: data.data[i],
    g: data.data[i + 1],
    b: data.data[i + 2],
    a: data.data[i + 3],
  }
}

/** Farbtoleranz auf unskalierten HD-Daten (nicht auf Downsample). */
export function eraseByColorTolerance(
  working: ImageData,
  target: Rgba,
  tolerance: number
): void {
  const d = working.data
  const maxDist = Math.max(0, tolerance)
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue
    const dist = colorDistance(
      { r: d[i], g: d[i + 1], b: d[i + 2], a: d[i + 3] },
      target
    )
    if (dist <= maxDist) {
      d[i + 3] = 0
    }
  }
}

export function brushErase(
  working: ImageData,
  cx: number,
  cy: number,
  radius: number
): void {
  const r = Math.max(1, Math.round(radius))
  const r2 = r * r
  const x0 = Math.max(0, Math.floor(cx - r))
  const x1 = Math.min(working.width - 1, Math.ceil(cx + r))
  const y0 = Math.max(0, Math.floor(cy - r))
  const y1 = Math.min(working.height - 1, Math.ceil(cy + r))
  const d = working.data
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy > r2) continue
      const i = (y * working.width + x) * 4
      d[i + 3] = 0
    }
  }
}

/** Stellt Original-Pixel (inkl. Alpha) im Pinselradius wieder her. */
export function brushRestore(
  working: ImageData,
  original: ImageData,
  cx: number,
  cy: number,
  radius: number
): void {
  if (
    working.width !== original.width ||
    working.height !== original.height
  ) {
    return
  }
  const r = Math.max(1, Math.round(radius))
  const r2 = r * r
  const x0 = Math.max(0, Math.floor(cx - r))
  const x1 = Math.min(working.width - 1, Math.ceil(cx + r))
  const y0 = Math.max(0, Math.floor(cy - r))
  const y1 = Math.min(working.height - 1, Math.ceil(cy + r))
  const wd = working.data
  const od = original.data
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy > r2) continue
      const i = (y * working.width + x) * 4
      wd[i] = od[i]
      wd[i + 1] = od[i + 1]
      wd[i + 2] = od[i + 2]
      wd[i + 3] = od[i + 3]
    }
  }
}

/** Rosa Highlight-Overlay für Live-Vorschau der Maske (Alpha=0 → pink tint). */
export function buildMaskHighlightOverlay(working: ImageData): ImageData {
  const out = new ImageData(working.width, working.height)
  const s = working.data
  const d = out.data
  for (let i = 0; i < s.length; i += 4) {
    if (s[i + 3] < 16) {
      d[i] = 236
      d[i + 1] = 72
      d[i + 2] = 153
      d[i + 3] = 110
    } else {
      d[i + 3] = 0
    }
  }
  return out
}

export function imageDataToDataUrl(data: ImageData): string {
  const canvas = document.createElement("canvas")
  canvas.width = data.width
  canvas.height = data.height
  const ctx = canvas.getContext("2d")
  if (!ctx) return ""
  ctx.putImageData(data, 0, 0)
  return canvas.toDataURL("image/png")
}

export async function loadImageDataFromSrc(
  src: string,
  maxEdge = 2048
): Promise<{ original: ImageData; working: ImageData }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.crossOrigin = "anonymous"
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error("Bild laden fehlgeschlagen"))
    el.src = src
  })

  let w = img.naturalWidth || img.width
  let h = img.naturalHeight || img.height
  const scale = Math.min(1, maxEdge / Math.max(w, h))
  w = Math.max(1, Math.round(w * scale))
  h = Math.max(1, Math.round(h * scale))

  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("Canvas-Kontext fehlt")
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  const original = ctx.getImageData(0, 0, w, h)
  return { original, working: cloneImageData(original) }
}
