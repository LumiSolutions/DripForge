/**
 * Universelle Multi-Objekt Vordergrund-Segmentierung (Browser).
 * COCO-SSD erkennt ALLE Subjekte; Maske = Union gepolsterter Boxen +
 * Rand-FloodFill (Pixel-Toleranz) und Trim innerhalb der Boxen — keine Ellipse.
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
  "tv",
  "laptop",
  "cell phone",
  "book",
  "clock",
  "vase",
  "sports ball",
  "frisbee",
  "skateboard",
  "teddy bear",
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

type ScoredPrediction = {
  prediction: CocoPrediction
  rank: number
}

/** Alle relevanten Detections (Multi-Objekt), nicht nur das Top-1. */
function pickAllSubjects(
  predictions: CocoPrediction[],
  imgW: number,
  imgH: number
): CocoPrediction[] {
  const area = imgW * imgH
  if (area <= 0) return []

  const scored: ScoredPrediction[] = predictions
    .filter((p) => p.score >= 0.32)
    .map((p) => {
      const [, , bw, bh] = p.bbox
      const boxArea = Math.max(0, bw) * Math.max(0, bh)
      const areaRatio = boxArea / area
      if (areaRatio < 0.004 || areaRatio > 0.96) {
        return { prediction: p, rank: -1 }
      }
      const priorityBoost = PRIORITY_CLASSES.has(p.class) ? 1.4 : 1
      return {
        prediction: p,
        rank: p.score * Math.sqrt(Math.max(0.01, areaRatio)) * priorityBoost,
      }
    })
    .filter((s) => s.rank > 0)
    .sort((a, b) => b.rank - a.rank)

  if (scored.length === 0) return []

  // Nimm alle Priority-Klassen + weitere starke Treffer (bis 8)
  const selected: CocoPrediction[] = []
  for (const item of scored) {
    if (selected.length >= 8) break
    const isPriority = PRIORITY_CLASSES.has(item.prediction.class)
    if (isPriority || item.prediction.score >= 0.45 || selected.length === 0) {
      selected.push(item.prediction)
    }
  }
  return selected
}

function expandBBox(
  bbox: [number, number, number, number],
  padRatio: number,
  width: number,
  height: number
): { x0: number; y0: number; x1: number; y1: number } {
  const [bx, by, bw, bh] = bbox
  const padX = bw * padRatio
  const padY = bh * padRatio
  return {
    x0: Math.max(0, Math.floor(bx - padX)),
    y0: Math.max(0, Math.floor(by - padY)),
    x1: Math.min(width - 1, Math.ceil(bx + bw + padX)),
    y1: Math.min(height - 1, Math.ceil(by + bh + padY)),
  }
}

/** Harte Rechteck-Union (keine Ellipse). 1 = Subjekt-Region. */
function buildMultiRectKeepMask(
  width: number,
  height: number,
  boxes: CocoPrediction[],
  padRatio = 0.07
): Uint8Array {
  const keep = new Uint8Array(width * height)
  for (const pred of boxes) {
    const { x0, y0, x1, y1 } = expandBBox(pred.bbox, padRatio, width, height)
    for (let y = y0; y <= y1; y++) {
      const row = y * width
      for (let x = x0; x <= x1; x++) {
        keep[row + x] = 1
      }
    }
  }
  return keep
}

function colorDist2(
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

/**
 * FloodFill vom Bildrand: entfernt Hintergrund ausserhalb der Keep-Rechtecke.
 */
function floodRemoveOutsideKeep(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  keep: Uint8Array,
  tolerance = 38
): void {
  const visited = new Uint8Array(width * height)
  const queue: number[] = []
  const tol2 = tolerance * tolerance

  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const idx = y * width + x
    if (visited[idx] || keep[idx]) return
    visited[idx] = 1
    queue.push(idx)
  }

  const step = Math.max(1, Math.floor(Math.min(width, height) / 100))
  for (let x = 0; x < width; x += step) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y += step) {
    push(0, y)
    push(width - 1, y)
  }

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
      if (visited[n] || keep[n]) continue
      if (colorDist2(data, n * 4, r, g, b) > tol2) continue
      visited[n] = 1
      queue.push(n)
    }
  }

  for (let idx = 0; idx < width * height; idx++) {
    if (visited[idx]) data[idx * 4 + 3] = 0
  }
}

/**
 * Innerhalb jeder Detection-Box: Flood von den Box-Rändern nach innen
 * (Pixel-Toleranz) → trimmt Hintergrund in der Box, folgt Konturen besser als Ellipse.
 */
function trimBackgroundInsideBoxes(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  boxes: CocoPrediction[],
  tolerance = 36
): void {
  const tol2 = tolerance * tolerance
  const globalVisited = new Uint8Array(width * height)

  for (const pred of boxes) {
    const { x0, y0, x1, y1 } = expandBBox(pred.bbox, 0.04, width, height)
    const queue: number[] = []
    const pushEdge = (x: number, y: number) => {
      if (x < x0 || y < y0 || x > x1 || y > y1) return
      const idx = y * width + x
      if (globalVisited[idx]) return
      globalVisited[idx] = 1
      queue.push(idx)
    }

    for (let x = x0; x <= x1; x++) {
      pushEdge(x, y0)
      pushEdge(x, y1)
    }
    for (let y = y0; y <= y1; y++) {
      pushEdge(x0, y)
      pushEdge(x1, y)
    }

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
        x > x0 ? idx - 1 : -1,
        x < x1 ? idx + 1 : -1,
        y > y0 ? idx - width : -1,
        y < y1 ? idx + width : -1,
      ]
      for (const n of neighbors) {
        if (n < 0 || n >= width * height) continue
        if (globalVisited[n]) continue
        const nx = n % width
        const ny = (n / width) | 0
        if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue
        if (colorDist2(data, n * 4, r, g, b) > tol2) continue
        globalVisited[n] = 1
        queue.push(n)
      }
    }
  }

  // Nur Pixel, die vom Box-Rand erreichbar waren (= Hintergrund-ähnliche Zonen)
  // und nicht tief im Motiv-Zentrum liegen, werden transparent.
  for (const pred of boxes) {
    const { x0, y0, x1, y1 } = expandBBox(pred.bbox, 0.04, width, height)
    const cx = (x0 + x1) / 2
    const cy = (y0 + y1) / 2
    const rx = Math.max(1, (x1 - x0) * 0.22)
    const ry = Math.max(1, (y1 - y0) * 0.22)
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const idx = y * width + x
        if (!globalVisited[idx]) continue
        const dx = (x - cx) / rx
        const dy = (y - cy) / ry
        // Kern der Box schützen (echte Kontur bleibt)
        if (dx * dx + dy * dy < 1) continue
        data[idx * 4 + 3] = 0
      }
    }
  }
}

async function applyCocoMultiSubjectMask(working: ImageData): Promise<boolean> {
  const model = await loadCocoModel()
  const canvas = document.createElement("canvas")
  canvas.width = working.width
  canvas.height = working.height
  const ctx = canvas.getContext("2d")
  if (!ctx) return false
  ctx.putImageData(working, 0, 0)

  const predictions = await model.detect(canvas, 20)
  const subjects = pickAllSubjects(predictions, working.width, working.height)
  if (subjects.length === 0) return false

  const keep = buildMultiRectKeepMask(
    working.width,
    working.height,
    subjects,
    0.08
  )

  // 1) Alles ausserhalb der Union transparent (Rand-Flood)
  floodRemoveOutsideKeep(
    working.data,
    working.width,
    working.height,
    keep,
    40
  )

  // 2) Hintergrund innerhalb der Boxen entlang Konturen trimmen
  trimBackgroundInsideBoxes(
    working.data,
    working.width,
    working.height,
    subjects,
    34
  )

  return true
}

/**
 * Behält ALLE erkannten Vordergrund-Objekte und setzt den Rest transparent.
 */
export async function applySubjectKeepMask(working: ImageData): Promise<void> {
  try {
    const ok = await applyCocoMultiSubjectMask(working)
    if (ok) return
  } catch (error) {
    console.warn("COCO-SSD Multi-Subjekt-Maske fehlgeschlagen:", error)
  }

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
