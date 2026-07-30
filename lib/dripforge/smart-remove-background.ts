/**
 * Intelligente Auswahl / Freistellen:
 * - Additive Multi-Click Magic-Wand (Seeds)
 * - Sobel-Kanten-Stop gegen Überlaufen ins Motiv
 * - Auto-Hintergrund vom Rand / Personen-Mitte beibehalten
 */

export type SmartRemoveResult = {
  result: string
  previewHighlight: string
  /** Binärmaske (1 = entfernen), für additive Updates */
  mask?: Uint8Array
  width?: number
  height?: number
}

export type SmartSeed = { relX: number; relY: number }

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

/** Sobel-Gradientenstärke pro Pixel (0–~1448). */
function computeSobelMagnitude(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Float32Array {
  const gray = new Float32Array(width * height)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  const mag = new Float32Array(width * height)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const gx =
        -gray[i - width - 1] +
        gray[i - width + 1] -
        2 * gray[i - 1] +
        2 * gray[i + 1] -
        gray[i + width - 1] +
        gray[i + width + 1]
      const gy =
        -gray[i - width - 1] -
        2 * gray[i - width] -
        gray[i - width + 1] +
        gray[i + width - 1] +
        2 * gray[i + width] +
        gray[i + width + 1]
      mag[i] = Math.hypot(gx, gy)
    }
  }
  return mag
}

function colorDistSq(
  data: Uint8ClampedArray,
  i: number,
  r: number,
  g: number,
  b: number
) {
  const dr = data[i] - r
  const dg = data[i + 1] - g
  const db = data[i + 2] - b
  return dr * dr + dg * dg + db * db
}

function floodFromSeeds(args: {
  data: Uint8ClampedArray
  width: number
  height: number
  seeds: Array<{ x: number; y: number }>
  tolerance: number
  edgeMag: Float32Array
  edgeThreshold: number
  existingMask?: Uint8Array | null
}): Uint8Array {
  const { data, width, height, seeds, tolerance, edgeMag, edgeThreshold } =
    args
  const tolSq = tolerance * tolerance
  const mask = args.existingMask
    ? new Uint8Array(args.existingMask)
    : new Uint8Array(width * height)
  const visited = new Uint8Array(width * height)
  const queue: number[] = []

  for (const seed of seeds) {
    const sx = Math.max(0, Math.min(width - 1, seed.x))
    const sy = Math.max(0, Math.min(height - 1, seed.y))
    const sIdx = sy * width + sx
    const si = sIdx * 4
    const sr = data[si]
    const sg = data[si + 1]
    const sb = data[si + 2]

    // Lokaler Flood nur für diesen Seed
    const localVisited = new Uint8Array(width * height)
    queue.length = 0
    queue.push(sIdx)
    localVisited[sIdx] = 1

    while (queue.length > 0) {
      const idx = queue.pop()!
      mask[idx] = 1
      visited[idx] = 1
      const x = idx % width
      const y = (idx / width) | 0
      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ] as const
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const nIdx = ny * width + nx
        if (localVisited[nIdx]) continue
        // Kanten-Stop: starke Kante nicht überqueren
        if (edgeMag[nIdx] >= edgeThreshold) {
          localVisited[nIdx] = 1
          continue
        }
        const ni = nIdx * 4
        if (data[ni + 3] === 0) {
          localVisited[nIdx] = 1
          mask[nIdx] = 1
          queue.push(nIdx)
          continue
        }
        if (colorDistSq(data, ni, sr, sg, sb) <= tolSq) {
          localVisited[nIdx] = 1
          queue.push(nIdx)
        } else {
          localVisited[nIdx] = 1
        }
      }
    }
  }

  return mask
}

function buildOutputs(
  canvas: HTMLCanvasElement,
  data: Uint8ClampedArray,
  mask: Uint8Array,
  width: number,
  height: number
): SmartRemoveResult {
  const resultCanvas = document.createElement("canvas")
  resultCanvas.width = width
  resultCanvas.height = height
  const resultCtx = resultCanvas.getContext("2d")
  if (!resultCtx) throw new Error("Canvas-Kontext nicht verfügbar.")
  resultCtx.putImageData(
    new ImageData(new Uint8ClampedArray(data), width, height),
    0,
    0
  )
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
    previewData.data[i] = Math.min(
      255,
      Math.round(previewData.data[i] * 0.35 + 200)
    )
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
    mask,
    width,
    height,
  }
}

function edgeThresholdForTolerance(tolerance: number): number {
  // Höhere Toleranz → etwas weichere Kanten-Schwelle
  return Math.max(40, 140 - tolerance * 0.55)
}

/**
 * Additive Multi-Click-Auswahl: Seeds (rel 0–1) werden kumulativ freigestellt.
 * Edge-Stop verhindert Überlaufen in scharf konturierte Motive.
 */
export async function smartRemoveFromSeeds(
  dataUrlOrHttp: string,
  seeds: SmartSeed[],
  tolerance = 45,
  existingMask?: Uint8Array | null
): Promise<SmartRemoveResult> {
  const { canvas, ctx } = await loadImageToCanvas(dataUrlOrHttp)
  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const tol = Math.max(5, Math.min(180, Math.round(tolerance)))
  const edgeMag = computeSobelMagnitude(data, width, height)
  const edgeThr = edgeThresholdForTolerance(tol)

  const pixelSeeds = seeds.map((s) => ({
    x: Math.round(Math.min(1, Math.max(0, s.relX)) * (width - 1)),
    y: Math.round(Math.min(1, Math.max(0, s.relY)) * (height - 1)),
  }))

  const mask = floodFromSeeds({
    data,
    width,
    height,
    seeds: pixelSeeds,
    tolerance: tol,
    edgeMag,
    edgeThreshold: edgeThr,
    existingMask:
      existingMask && existingMask.length === width * height
        ? existingMask
        : null,
  })

  return buildOutputs(canvas, data, mask, width, height)
}

/**
 * Auto: Hintergrund vom Bildrand (mit Kanten-Stop).
 * Behält typischerweise zentrierte Motive/Personen.
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
  const edgeMag = computeSobelMagnitude(data, width, height)
  const edgeThr = edgeThresholdForTolerance(tol)

  // Seeds entlang des Rands (dichte Samples)
  const seeds: Array<{ x: number; y: number }> = []
  const step = Math.max(1, Math.floor(Math.min(width, height) / 80))
  for (let x = 0; x < width; x += step) {
    seeds.push({ x, y: 0 }, { x, y: height - 1 })
  }
  for (let y = 0; y < height; y += step) {
    seeds.push({ x: 0, y }, { x: width - 1, y })
  }

  const mask = floodFromSeeds({
    data,
    width,
    height,
    seeds,
    tolerance: tol,
    edgeMag,
    edgeThreshold: edgeThr,
  })

  return buildOutputs(canvas, data, mask, width, height)
}

/**
 * „Personen beibehalten“: Auto-Hintergrund vom Rand entfernen
 * (zentrierte Vordergründe bleiben dank Edge-Stop erhalten).
 */
export async function smartKeepSubjectRemoveBackground(
  dataUrlOrHttp: string,
  tolerance = 40
): Promise<SmartRemoveResult> {
  return smartRemoveBackground(dataUrlOrHttp, tolerance)
}
