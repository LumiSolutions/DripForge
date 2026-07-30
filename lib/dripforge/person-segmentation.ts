/**
 * Browser-only Personen-Segmentierung via MediaPipe Selfie Segmentation (CDN).
 * Setzt alles ausserhalb der Person auf Alpha 0.
 */

type SelfieSegmentationLike = {
  setOptions: (opts: Record<string, unknown>) => void
  onResults: (cb: (results: { segmentationMask?: CanvasImageSource }) => void) => void
  initialize: () => Promise<void>
  send: (input: { image: HTMLCanvasElement | HTMLImageElement }) => Promise<void>
  close?: () => void
}

let selfieCtor: (new (config: {
  locateFile: (file: string) => string
}) => SelfieSegmentationLike) | null = null

async function loadSelfieSegmentationCtor(): Promise<
  NonNullable<typeof selfieCtor>
> {
  if (selfieCtor) return selfieCtor
  if (typeof window === "undefined") {
    throw new Error("Personen-Segmentierung nur im Browser verfügbar.")
  }

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-df-mediapipe-selfie]"
    )
    if (existing) {
      if ((window as unknown as { SelfieSegmentation?: unknown }).SelfieSegmentation) {
        resolve()
        return
      }
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () =>
        reject(new Error("MediaPipe-Script fehlgeschlagen"))
      )
      return
    }
    const script = document.createElement("script")
    script.src =
      "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js"
    script.async = true
    script.dataset.dfMediapipeSelfie = "1"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("MediaPipe-Script fehlgeschlagen"))
    document.head.appendChild(script)
  })

  const ctor = (window as unknown as { SelfieSegmentation?: typeof selfieCtor })
    .SelfieSegmentation
  if (!ctor) {
    throw new Error("SelfieSegmentation nicht geladen.")
  }
  selfieCtor = ctor
  return ctor
}

/**
 * Behält Personen (inkl. Mütze/Haare/Schultern) und setzt den Rest transparent.
 * Arbeitet auf dem übergebenen ImageData (HD).
 */
export async function applyPersonKeepMask(
  working: ImageData
): Promise<void> {
  const Ctor = await loadSelfieSegmentationCtor()
  const segmenter = new Ctor({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
  })

  segmenter.setOptions({
    modelSelection: 1,
    selfieMode: false,
  })

  const sourceCanvas = document.createElement("canvas")
  sourceCanvas.width = working.width
  sourceCanvas.height = working.height
  const sctx = sourceCanvas.getContext("2d")
  if (!sctx) throw new Error("Canvas fehlt")
  sctx.putImageData(working, 0, 0)

  const maskCanvas = document.createElement("canvas")
  maskCanvas.width = working.width
  maskCanvas.height = working.height
  const mctx = maskCanvas.getContext("2d", { willReadFrequently: true })
  if (!mctx) throw new Error("Mask-Canvas fehlt")

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("Personen-Segmentierung Timeout"))
    }, 20000)

    segmenter.onResults((results) => {
      window.clearTimeout(timeout)
      try {
        mctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
        if (results.segmentationMask) {
          mctx.drawImage(
            results.segmentationMask,
            0,
            0,
            maskCanvas.width,
            maskCanvas.height
          )
        }
        resolve()
      } catch (error) {
        reject(error)
      }
    })

    void segmenter
      .initialize()
      .then(() => segmenter.send({ image: sourceCanvas }))
      .catch(reject)
  })

  const mask = mctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)
  const wd = working.data
  const md = mask.data
  // MediaPipe mask: person ≈ hell/weiss; Hintergrund dunkel
  for (let i = 0; i < wd.length; i += 4) {
    const personScore = md[i] // R-Kanal der Maske
    if (personScore < 128) {
      wd[i + 3] = 0
    }
  }

  try {
    segmenter.close?.()
  } catch {
    /* ignore */
  }
}
