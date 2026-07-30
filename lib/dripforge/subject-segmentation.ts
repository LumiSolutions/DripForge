/**
 * Universelle Vordergrund-Freistellung (Browser).
 * Primär: @imgly/background-removal (ISNet Alpha-Matting, multi-subject).
 * Danach: Innenlöcher im Motiv schliessen (kein Körper-Ausschnitt).
 * Fallback: Edge-Aware Rand-Flood → MediaPipe Person.
 */

import { applyPersonKeepMask } from "@/lib/dripforge/person-segmentation"

function imageDataToBlob(data: ImageData): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = data.width
  canvas.height = data.height
  const ctx = canvas.getContext("2d")
  if (!ctx) return Promise.reject(new Error("Canvas fehlt"))
  ctx.putImageData(data, 0, 0)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error("Blob-Export fehlgeschlagen"))
      },
      "image/png"
    )
  })
}

async function blobToImageData(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("Canvas fehlt")
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/**
 * Schließt transparente Löcher *innerhalb* des Motivs, ohne den
 * Außen-Hintergrund zu füllen (Flood vom Bildrand).
 */
function fillInteriorAlphaHoles(
  working: ImageData,
  alphaThreshold = 28
): void {
  const { width, height, data } = working
  const n = width * height
  const exterior = new Uint8Array(n)
  const queue: number[] = []

  const isHoleCandidate = (i: number) => data[i * 4 + 3]! < alphaThreshold

  const enqueueIfTransparent = (i: number) => {
    if (exterior[i] || !isHoleCandidate(i)) return
    exterior[i] = 1
    queue.push(i)
  }

  for (let x = 0; x < width; x++) {
    enqueueIfTransparent(x)
    enqueueIfTransparent((height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    enqueueIfTransparent(y * width)
    enqueueIfTransparent(y * width + (width - 1))
  }

  while (queue.length > 0) {
    const i = queue.pop()!
    const x = i % width
    const y = (i / width) | 0
    if (x + 1 < width) enqueueIfTransparent(i + 1)
    if (x > 0) enqueueIfTransparent(i - 1)
    if (y + 1 < height) enqueueIfTransparent(i + width)
    if (y > 0) enqueueIfTransparent(i - width)
  }

  // Leichte morphologische Schließung: 1px Dilate auf Alpha, dann nur Innenlöcher füllen
  const alphaSnap = new Uint8ClampedArray(n)
  for (let i = 0; i < n; i++) alphaSnap[i] = data[i * 4 + 3]!

  for (let i = 0; i < n; i++) {
    if (!isHoleCandidate(i) || exterior[i]) continue

    // Farbe aus nächsten undurchsichtigen Nachbarn mitteln
    let r = 0
    let g = 0
    let b = 0
    let count = 0
    const x = i % width
    const y = (i / width) | 0
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const j = ny * width + nx
        if (alphaSnap[j]! >= alphaThreshold) {
          const o = j * 4
          r += data[o]!
          g += data[o + 1]!
          b += data[o + 2]!
          count++
        }
      }
    }
    const o = i * 4
    if (count > 0) {
      data[o] = Math.round(r / count)
      data[o + 1] = Math.round(g / count)
      data[o + 2] = Math.round(b / count)
      data[o + 3] = 255
    } else {
      data[o + 3] = 255
    }
  }
}

/** Weiche Kanten: Alpha gegen Nachbarn leicht glätten (kein Boxy-Look). */
function softenAlphaEdges(working: ImageData): void {
  const { width, height, data } = working
  const src = new Uint8ClampedArray(data)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const a = src[i * 4 + 3]!
      if (a === 0 || a === 255) continue
      let sum = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          sum += src[((y + dy) * width + (x + dx)) * 4 + 3]!
        }
      }
      data[i * 4 + 3] = Math.round(sum / 9)
    }
  }
}

async function applyImglyBackgroundRemoval(
  working: ImageData
): Promise<boolean> {
  const { removeBackground } = await import("@imgly/background-removal")
  const inputBlob = await imageDataToBlob(working)

  const run = (device: "gpu" | "cpu") =>
    removeBackground(inputBlob, {
      model: "isnet",
      device,
      output: { format: "image/png", quality: 0.95 },
    })

  let resultBlob: Blob
  try {
    resultBlob = await run("gpu")
  } catch {
    resultBlob = await run("cpu")
  }
  const result = await blobToImageData(resultBlob)

  if (result.width === working.width && result.height === working.height) {
    working.data.set(result.data)
    return true
  }

  const canvas = document.createElement("canvas")
  canvas.width = working.width
  canvas.height = working.height
  const ctx = canvas.getContext("2d")
  if (!ctx) return false
  const tmp = document.createElement("canvas")
  tmp.width = result.width
  tmp.height = result.height
  const tctx = tmp.getContext("2d")
  if (!tctx) return false
  tctx.putImageData(result, 0, 0)
  ctx.clearRect(0, 0, working.width, working.height)
  ctx.drawImage(tmp, 0, 0, working.width, working.height)
  const scaled = ctx.getImageData(0, 0, working.width, working.height)
  working.data.set(scaled.data)
  return true
}

/**
 * Behält das gesamte Vordergrund-Motiv (alle Subjekte) und setzt den Hintergrund transparent.
 */
export async function applySubjectKeepMask(working: ImageData): Promise<void> {
  try {
    const ok = await applyImglyBackgroundRemoval(working)
    if (ok) {
      fillInteriorAlphaHoles(working)
      softenAlphaEdges(working)
      return
    }
  } catch (error) {
    console.warn("imgly Background-Removal fehlgeschlagen:", error)
  }

  try {
    const { smartRemoveBackground } = await import(
      "@/lib/dripforge/smart-remove-background"
    )
    const canvas = document.createElement("canvas")
    canvas.width = working.width
    canvas.height = working.height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas fehlt")
    ctx.putImageData(working, 0, 0)
    const dataUrl = canvas.toDataURL("image/png")
    const out = await smartRemoveBackground(dataUrl, 42)
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error("Fallback-Bild laden fehlgeschlagen"))
      el.src = out.result
    })
    ctx.clearRect(0, 0, working.width, working.height)
    ctx.drawImage(img, 0, 0, working.width, working.height)
    const next = ctx.getImageData(0, 0, working.width, working.height)
    working.data.set(next.data)
    fillInteriorAlphaHoles(working)
    softenAlphaEdges(working)
    return
  } catch (error) {
    console.warn("Edge-Flood-Fallback fehlgeschlagen:", error)
  }

  try {
    await applyPersonKeepMask(working)
    fillInteriorAlphaHoles(working)
    return
  } catch (error) {
    console.warn("Personen-Fallback fehlgeschlagen:", error)
  }

  throw new Error(
    "Subjekt-/Vordergrund-Erkennung fehlgeschlagen. Bitte manuell freistellen."
  )
}

/** @deprecated */
export const applyPersonKeepMaskAlias = applySubjectKeepMask
