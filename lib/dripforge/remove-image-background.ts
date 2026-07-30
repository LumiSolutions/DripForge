/** Entfernt helle Hintergründe bzw. eine per Pipette gewählte Farbe (Color-Keying). */

function loadImageToCanvas(
  dataUrlOrHttp: string
): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Hintergrund entfernen nur im Browser möglich."))
      return
    }

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        const width = img.naturalWidth || img.width
        const height = img.naturalHeight || img.height
        if (width <= 0 || height <= 0) {
          reject(new Error("Bild hat keine gültige Grösse."))
          return
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (!ctx) {
          reject(new Error("Canvas-Kontext nicht verfügbar."))
          return
        }
        ctx.drawImage(img, 0, 0)
        resolve({ canvas, ctx })
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Pixel-Verarbeitung fehlgeschlagen."))
      }
    }
    img.onerror = () => reject(new Error("Bild konnte nicht geladen werden."))
    img.src = dataUrlOrHttp
  })
}

/**
 * Setzt Alpha auf 0 für Pixel mit R,G,B jeweils > threshold (Standard 240).
 * Ergebnis ist immer PNG (mit Transparenz).
 */
export function removeLightImageBackground(
  dataUrlOrHttp: string,
  threshold = 240
): Promise<string> {
  return loadImageToCanvas(dataUrlOrHttp).then(({ canvas, ctx }) => {
    const { width, height } = canvas
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data
    const t = Math.max(0, Math.min(255, threshold))
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      if (r > t && g > t && b > t) {
        data[i + 3] = 0
      }
    }
    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL("image/png")
  })
}

export type RgbColor = { r: number; g: number; b: number }

/**
 * Macht Pixel transparent, deren Farbe nahe an targetRgb liegt.
 * @param tolerance 0–255 (euklidische Distanz in RGB; typisch 20–80)
 */
export function removeColorNearBackground(
  dataUrlOrHttp: string,
  targetRgb: RgbColor,
  tolerance = 40
): Promise<string> {
  return loadImageToCanvas(dataUrlOrHttp).then(({ canvas, ctx }) => {
    const { width, height } = canvas
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data
    const tol = Math.max(0, Math.min(255, tolerance))
    const tolSq = tol * tol
    const tr = targetRgb.r
    const tg = targetRgb.g
    const tb = targetRgb.b

    for (let i = 0; i < data.length; i += 4) {
      const dr = data[i] - tr
      const dg = data[i + 1] - tg
      const db = data[i + 2] - tb
      if (dr * dr + dg * dg + db * db <= tolSq) {
        data[i + 3] = 0
      }
    }
    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL("image/png")
  })
}

/** Liest die RGB-Farbe an relativen Koordinaten (0–1) aus einem Bild. */
export function sampleImageColorAt(
  dataUrlOrHttp: string,
  relX: number,
  relY: number
): Promise<RgbColor> {
  return loadImageToCanvas(dataUrlOrHttp).then(({ canvas, ctx }) => {
    const x = Math.max(
      0,
      Math.min(canvas.width - 1, Math.floor(relX * canvas.width))
    )
    const y = Math.max(
      0,
      Math.min(canvas.height - 1, Math.floor(relY * canvas.height))
    )
    const pixel = ctx.getImageData(x, y, 1, 1).data
    return { r: pixel[0], g: pixel[1], b: pixel[2] }
  })
}
