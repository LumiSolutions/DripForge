/** Intelligente Hintergrund-Entfernung (Magic-Wand vom Bildrand). */

export type SmartRemoveResult = {
  /** Freigestelltes PNG */
  result: string
  /** Vorschau mit magenta Masken-Highlight auf dem Original */
  previewHighlight: string
}

function loadImageToCanvas(
  dataUrlOrHttp: string
): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Smart-Remove nur im Browser möglich."))
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
        reject(
          error instanceof Error
            ? error
            : new Error("Pixel-Verarbeitung fehlgeschlagen.")
        )
      }
    }
    img.onerror = () => reject(new Error("Bild konnte nicht geladen werden."))
    img.src = dataUrlOrHttp
  })
}

/**
 * Flood-Fill vom Bildrand gegen die typische Randfarbe.
 * Toleranz steuert, wie aggressiv der Hintergrund entfernt wird.
 */
export async function smartRemoveBackground(
  dataUrlOrHttp: string,
  tolerance = 45
): Promise<SmartRemoveResult> {
  const { canvas, ctx } = await loadImageToCanvas(dataUrlOrHttp)
  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const tol = Math.max(5, Math.min(180, Math.round(tolerance)))
  const tolSq = tol * tol

  // Typische Hintergrundfarbe aus Rand-Samples
  let sr = 0
  let sg = 0
  let sb = 0
  let sc = 0
  const stepX = Math.max(1, Math.floor(width / 60))
  const stepY = Math.max(1, Math.floor(height / 60))
  for (let x = 0; x < width; x += stepX) {
    for (const y of [0, height - 1]) {
      const i = (y * width + x) * 4
      sr += data[i]
      sg += data[i + 1]
      sb += data[i + 2]
      sc++
    }
  }
  for (let y = 0; y < height; y += stepY) {
    for (const x of [0, width - 1]) {
      const i = (y * width + x) * 4
      sr += data[i]
      sg += data[i + 1]
      sb += data[i + 2]
      sc++
    }
  }
  const br = sc > 0 ? Math.round(sr / sc) : 255
  const bg = sc > 0 ? Math.round(sg / sc) : 255
  const bb = sc > 0 ? Math.round(sb / sc) : 255

  const nearBg = (i: number) => {
    const dr = data[i] - br
    const dg = data[i + 1] - bg
    const db = data[i + 2] - bb
    return dr * dr + dg * dg + db * db <= tolSq
  }

  const visited = new Uint8Array(width * height)
  const mask = new Uint8Array(width * height)
  const queue: number[] = []

  const tryEnqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const idx = y * width + x
    if (visited[idx]) return
    const i = idx * 4
    if (data[i + 3] === 0 || nearBg(i)) {
      visited[idx] = 1
      queue.push(idx)
    }
  }

  for (let x = 0; x < width; x++) {
    tryEnqueue(x, 0)
    tryEnqueue(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    tryEnqueue(0, y)
    tryEnqueue(width - 1, y)
  }

  while (queue.length > 0) {
    const idx = queue.pop()!
    mask[idx] = 1
    const x = idx % width
    const y = (idx / width) | 0
    tryEnqueue(x - 1, y)
    tryEnqueue(x + 1, y)
    tryEnqueue(x, y - 1)
    tryEnqueue(x, y + 1)
  }

  const resultCanvas = document.createElement("canvas")
  resultCanvas.width = width
  resultCanvas.height = height
  const resultCtx = resultCanvas.getContext("2d")
  if (!resultCtx) throw new Error("Canvas-Kontext nicht verfügbar.")
  resultCtx.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0)
  const resultData = resultCtx.getImageData(0, 0, width, height)
  for (let idx = 0; idx < width * height; idx++) {
    if (mask[idx]) resultData.data[idx * 4 + 3] = 0
  }
  resultCtx.putImageData(resultData, 0, 0)

  const previewCanvas = document.createElement("canvas")
  previewCanvas.width = width
  previewCanvas.height = height
  const previewCtx = previewCanvas.getContext("2d")
  if (!previewCtx) throw new Error("Canvas-Kontext nicht verfügbar.")
  previewCtx.drawImage(canvas, 0, 0)
  const previewData = previewCtx.getImageData(0, 0, width, height)
  for (let idx = 0; idx < width * height; idx++) {
    if (!mask[idx]) continue
    const i = idx * 4
    previewData.data[i] = Math.min(255, Math.round(previewData.data[i] * 0.35 + 200))
    previewData.data[i + 1] = Math.round(previewData.data[i + 1] * 0.25)
    previewData.data[i + 2] = Math.min(
      255,
      Math.round(previewData.data[i + 2] * 0.35 + 180)
    )
    previewData.data[i + 3] = 220
  }
  previewCtx.putImageData(previewData, 0, 0)

  return {
    result: resultCanvas.toDataURL("image/png"),
    previewHighlight: previewCanvas.toDataURL("image/png"),
  }
}
