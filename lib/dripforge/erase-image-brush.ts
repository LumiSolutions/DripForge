/** Pinsel/Radierer + Lasso: macht Pixel transparent. */

export type BrushPoint = { relX: number; relY: number; radiusRel: number }

/** Bresenham-ähnliche Interpolation zwischen zwei Relativpunkten. */
export function interpolateBrushPoints(
  from: { relX: number; relY: number },
  to: { relX: number; relY: number },
  radiusRel: number,
  stepRel = 0.008
): BrushPoint[] {
  const dx = to.relX - from.relX
  const dy = to.relY - from.relY
  const dist = Math.hypot(dx, dy)
  if (dist < 1e-6) {
    return [{ relX: to.relX, relY: to.relY, radiusRel }]
  }
  const steps = Math.max(1, Math.ceil(dist / Math.max(0.002, stepRel)))
  const points: BrushPoint[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    points.push({
      relX: from.relX + dx * t,
      relY: from.relY + dy * t,
      radiusRel,
    })
  }
  return points
}

export function eraseImageBrushStroke(
  dataUrlOrHttp: string,
  strokes: BrushPoint[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Radierer nur im Browser möglich."))
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

        for (const stroke of strokes) {
          const cx = stroke.relX * width
          const cy = stroke.relY * height
          const radius = Math.max(
            1,
            stroke.radiusRel * Math.min(width, height)
          )
          ctx.save()
          ctx.globalCompositeOperation = "destination-out"
          ctx.beginPath()
          ctx.arc(cx, cy, radius, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }

        resolve(canvas.toDataURL("image/png"))
      } catch (error) {
        reject(
          error instanceof Error ? error : new Error("Radierer fehlgeschlagen.")
        )
      }
    }
    img.onerror = () => reject(new Error("Bild konnte nicht geladen werden."))
    img.src = dataUrlOrHttp
  })
}

/** Freihand-Lasso: alles innerhalb des Polygons wird transparent. */
export function eraseImageLassoRegion(
  dataUrlOrHttp: string,
  polygonRel: Array<{ relX: number; relY: number }>
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Lasso nur im Browser möglich."))
      return
    }
    if (polygonRel.length < 3) {
      reject(new Error("Lasso braucht mindestens 3 Punkte."))
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

        ctx.save()
        ctx.beginPath()
        polygonRel.forEach((p, i) => {
          const x = p.relX * width
          const y = p.relY * height
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.closePath()
        ctx.globalCompositeOperation = "destination-out"
        ctx.fill()
        ctx.restore()

        resolve(canvas.toDataURL("image/png"))
      } catch (error) {
        reject(
          error instanceof Error ? error : new Error("Lasso fehlgeschlagen.")
        )
      }
    }
    img.onerror = () => reject(new Error("Bild konnte nicht geladen werden."))
    img.src = dataUrlOrHttp
  })
}

/** Einfacher Crop anhand relativer Bounds (0–1). */
export function cropImageToRelRect(
  dataUrlOrHttp: string,
  rect: { x: number; y: number; w: number; h: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Zuschneiden nur im Browser möglich."))
      return
    }
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width
        const height = img.naturalHeight || img.height
        const sx = Math.max(0, Math.min(width - 1, Math.floor(rect.x * width)))
        const sy = Math.max(0, Math.min(height - 1, Math.floor(rect.y * height)))
        const sw = Math.max(
          1,
          Math.min(width - sx, Math.floor(rect.w * width))
        )
        const sh = Math.max(
          1,
          Math.min(height - sy, Math.floor(rect.h * height))
        )
        const canvas = document.createElement("canvas")
        canvas.width = sw
        canvas.height = sh
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Canvas-Kontext nicht verfügbar."))
          return
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
        resolve(canvas.toDataURL("image/png"))
      } catch (error) {
        reject(
          error instanceof Error ? error : new Error("Zuschneiden fehlgeschlagen.")
        )
      }
    }
    img.onerror = () => reject(new Error("Bild konnte nicht geladen werden."))
    img.src = dataUrlOrHttp
  })
}
