/**
 * Universelle Vordergrund-/Subjekt-Segmentierung (Browser).
 * Primär: COCO-SSD (Mensch, Tier, Gegenstand) + Masken-Verfeinerung.
 * Fallback: MediaPipe Selfie (Personen) bzw. Rand-Flood.
 */

import { applyPersonKeepMask } from "@/lib/dripforge/person-segmentation"

type CocoPrediction = {
  bbox: [number, number, number, number]
  class: string
  score: number
}

type CocoModel = {
  detect: (
    img: HTMLCanvasElement | HTMLImageElement,
    maxNumBoxes?: number
  ) => Promise<CocoPrediction[]>
}

declare global {
  interface Window {
    cocoSsd?: { load: () => Promise<CocoModel> }
    tf?: { ready: () => Promise<void> }
  }
}

const PRIORITY_CLASSES = new Set([
  "person",
  "dog",
  "cat",
  "bird",
  "horse",
  "sheep",
  "cow",
  "elephant",
  "bear",
  "zebra",
  "giraffe",
  "teddy bear",
  "backpack",
  "handbag",
  "suitcase",
  "bottle",
  "cup",
  "bowl",
  "banana",
  "apple",
  "sandwich",
  "orange",
  "broccoli",
  "carrot",
  "hot dog",
  "pizza",
  "donut",
  "cake",
  "chair",
  "couch",
  "potted plant",
  "bed",
  "dining table",
  "toilet",
  "tv",
  "laptop",
  "mouse",
  "remote",
  "keyboard",
  "cell phone",
  "microwave",
  "oven",
  "toaster",
  "sink",
  "refrigerator",
  "book",
  "clock",
  "vase",
  "scissors",
  "teddy bear",
  "hair drier",
  "toothbrush",
  "sports ball",
  "frisbee",
  "skateboard",
  "surfboard",
  "tennis racket",
  "kite",
  "baseball bat",
  "baseball glove",
])

let cocoModelPromise: Promise<CocoModel> | null = null

function loadScriptOnce(src: string, datasetKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-df-seg="${datasetKey}"]`
    )
    if (existing) {
      if (existing.dataset.loaded === "1") {
        resolve()
        return
      }
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () =>
        reject(new Error(`Script fehlgeschlagen: ${datasetKey}`))
      )
      return
    }
    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.dataset.dfSeg = datasetKey
    script.onload = () => {
      script.dataset.loaded = "1"
      resolve()
    }
    script.onerror = () =>
      reject(new Error(`Script fehlgeschlagen: ${datasetKey}`))
    document.head.appendChild(script)
  })
}

async function loadCocoModel(): Promise<CocoModel> {
  if (typeof window === "undefined") {
    throw new Error("Subjekt-Segmentierung nur im Browser verfügbar.")
  }
  if (!cocoModelPromise) {
    cocoModelPromise = (async () => {
      await loadScriptOnce(
        "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js",
        "tfjs"
      )
      if (window.tf?.ready) await window.tf.ready()
      await loadScriptOnce(
        "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js",
        "coco-ssd"
      )
      if (!window.cocoSsd?.load) {
        throw new Error("COCO-SSD nicht geladen.")
      }
      return window.cocoSsd.load()
    })()
  }
  return cocoModelPromise
}

function pickPrimarySubject(
  predictions: CocoPrediction[],
  imgW: number,
  imgH: number
): CocoPrediction | null {
  const area = imgW * imgH
  if (area <= 0) return null

  const scored = predictions
    .filter((p) => p.score >= 0.35)
    .map((p) => {
      const [, , bw, bh] = p.bbox
      const boxArea = Math.max(0, bw) * Math.max(0, bh)
      const areaRatio = boxArea / area
      const priorityBoost = PRIORITY_CLASSES.has(p.class) ? 1.35 : 1
      return {
        prediction: p,
        rank: p.score * Math.sqrt(Math.max(0.01, areaRatio)) * priorityBoost,
      }
    })
    .sort((a, b) => b.rank - a.rank)

  return scored[0]?.prediction ?? null
}

/**
 * Soft keep-mask aus Bounding-Box (ellipseartig, weicher Rand).
 * 1 = behalten, 0 = entfernen.
 */
function buildSoftBoxMask(
  width: number,
  height: number,
  bbox: [number, number, number, number],
  padRatio = 0.08
): Float32Array {
  const [bx, by, bw, bh] = bbox
  const padX = bw * padRatio
  const padY = bh * padRatio
  const x0 = bx - padX
  const y0 = by - padY
  const x1 = bx + bw + padX
  const y1 = by + bh + padY
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const rx = Math.max(1, (x1 - x0) / 2)
  const ry = Math.max(1, (y1 - y0) / 2)

  const mask = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = (x - cx) / rx
      const ny = (y - cy) / ry
      const d = Math.hypot(nx, ny)
      // Weicher Falloff ausserhalb der Ellipse
      if (d <= 0.92) mask[y * width + x] = 1
      else if (d >= 1.12) mask[y * width + x] = 0
      else mask[y * width + x] = 1 - (d - 0.92) / 0.2
    }
  }
  return mask
}

/**
 * Verfeinert Maske: Rand-Flood entfernt Hintergrund, schützt aber Subjekt-Kern.
 */
function refineWithBorderFlood(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  keepSoft: Float32Array,
  tolerance = 42
): void {
  const visited = new Uint8Array(width * height)
  const queue: number[] = []
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const idx = y * width + x
    if (visited[idx]) return
    // Subjekt-Kern nie als Hintergrund seed'en
    if (keepSoft[idx] > 0.72) return
    visited[idx] = 1
    queue.push(idx)
  }

  const step = Math.max(1, Math.floor(Math.min(width, height) / 90))
  for (let x = 0; x < width; x += step) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y += step) {
    push(0, y)
    push(width - 1, y)
  }

  const tol2 = tolerance * tolerance
  let qi = 0
  while (qi < queue.length) {
    const idx = queue[qi++]
    const i = idx * 4
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const x = idx % width
    const y = (idx / width) | 0
    const neighbors = [
      x > 0 ? idx - 1 : -1,
      x < width - 1 ? idx + 1 : -1,
      y > 0 ? idx - width : -1,
      y < height - 1 ? idx + width : -1,
    ]
    for (const n of neighbors) {
      if (n < 0 || n >= width * height) continue
      if (visited[n]) continue
      if (keepSoft[n] > 0.85) continue
      const ni = n * 4
      const dr = data[ni] - r
      const dg = data[ni + 1] - g
      const db = data[ni + 2] - b
      if (dr * dr + dg * dg + db * db > tol2) continue
      visited[n] = 1
      queue.push(n)
    }
  }

  for (let idx = 0; idx < width * height; idx++) {
    const keep = keepSoft[idx]
    if (visited[idx] && keep < 0.55) {
      data[idx * 4 + 3] = 0
    } else if (keep < 0.12) {
      data[idx * 4 + 3] = 0
    } else if (keep < 1) {
      data[idx * 4 + 3] = Math.round(data[idx * 4 + 3] * keep)
    }
  }
}

async function applyCocoSubjectMask(working: ImageData): Promise<boolean> {
  const model = await loadCocoModel()
  const canvas = document.createElement("canvas")
  canvas.width = working.width
  canvas.height = working.height
  const ctx = canvas.getContext("2d")
  if (!ctx) return false
  ctx.putImageData(working, 0, 0)

  const predictions = await model.detect(canvas, 12)
  const subject = pickPrimarySubject(
    predictions,
    working.width,
    working.height
  )
  if (!subject) return false

  const soft = buildSoftBoxMask(
    working.width,
    working.height,
    subject.bbox,
    0.1
  )
  refineWithBorderFlood(
    working.data,
    working.width,
    working.height,
    soft,
    40
  )
  return true
}

/**
 * Behält das Hauptmotiv (Mensch, Tier, Gegenstand) und setzt den Rest transparent.
 * Arbeitet auf unskalierten HD-ImageData.
 */
export async function applySubjectKeepMask(working: ImageData): Promise<void> {
  try {
    const ok = await applyCocoSubjectMask(working)
    if (ok) return
  } catch (error) {
    console.warn("COCO-SSD Subjekt-Maske fehlgeschlagen:", error)
  }

  // Fallback: Personen-Modell (hilft bei Portraits ohne COCO-Treffer)
  try {
    await applyPersonKeepMask(working)
    return
  } catch (error) {
    console.warn("Personen-Fallback fehlgeschlagen:", error)
  }

  throw new Error(
    "Subjekt-/Vordergrund-Erkennung fehlgeschlagen. Bitte manuell freistellen."
  )
}

/** @deprecated Nutze applySubjectKeepMask */
export const applyPersonKeepMaskAlias = applySubjectKeepMask
