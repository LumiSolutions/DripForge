/** Entfernt helle Hintergründe (Color-Keying) für Gravur-Vorschauen. */

/**
 * Setzt Alpha auf 0 für Pixel mit R,G,B jeweils > threshold (Standard 240).
 * Ergebnis ist immer PNG (mit Transparenz).
 */
export function removeLightImageBackground(
  dataUrlOrHttp: string,
  threshold = 240
): Promise<string> {
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
        resolve(canvas.toDataURL("image/png"))
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Pixel-Verarbeitung fehlgeschlagen."))
      }
    }
    img.onerror = () => reject(new Error("Bild konnte nicht geladen werden."))
    img.src = dataUrlOrHttp
  })
}
