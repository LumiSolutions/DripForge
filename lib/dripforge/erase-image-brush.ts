/** Pinsel/Radierer: macht Pixel in Pinselreichweite transparent. */

export function eraseImageBrushStroke(
  dataUrlOrHttp: string,
  strokes: Array<{ relX: number; relY: number; radiusRel: number }>
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
