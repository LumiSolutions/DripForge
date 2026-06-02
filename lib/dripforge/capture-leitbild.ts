import html2canvas from "html2canvas"

export const LEITBILD_3D_CANVAS_ATTR = "data-leitbild-3d-preview"
export const LEITBILD_LASER_PREVIEW_ATTR = "data-leitbild-laser-preview"

/** Wartet zwei Frames, damit WebGL/Layout vor dem Snapshot fertig gerendert ist. */
export function waitForPreviewPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve())
    })
  })
}

/**
 * Liest ein WebGL-/Canvas-Element als PNG-Base64 aus.
 * preserveDrawingBuffer: true am Renderer ist Pflicht, sonst schwarzes Bild.
 */
export function captureCanvasLeitbild(
  canvas: HTMLCanvasElement | null | undefined
): string | null {
  if (!canvas) {
    console.warn("Leitbild: Kein Canvas-Element gefunden.")
    return null
  }

  try {
    const leitbildUrl = canvas.toDataURL("image/png")
    if (!leitbildUrl || leitbildUrl === "data:,") {
      console.warn(
        "Leitbild: Canvas-Auslese lieferte ein leeres Bild. preserveDrawingBuffer pruefen."
      )
      return null
    }
    return leitbildUrl
  } catch (error) {
    console.warn("Leitbild: Canvas konnte nicht ausgelesen werden.", error)
    return null
  }
}

export function findLeitbildCanvas(root?: ParentNode | null): HTMLCanvasElement | null {
  if (root instanceof HTMLCanvasElement) return root
  if (root) {
    const nested = root.querySelector<HTMLCanvasElement>(
      `canvas[${LEITBILD_3D_CANVAS_ATTR}], canvas`
    )
    if (nested) return nested
  }
  return document.querySelector<HTMLCanvasElement>(
    `canvas[${LEITBILD_3D_CANVAS_ATTR}]`
  )
}

/** Laser-Vorschau (HTML) oder verschachteltes Canvas als PNG-Base64. */
export async function captureLaserPreviewLeitbild(
  previewRoot: HTMLElement | null | undefined
): Promise<string | null> {
  if (!previewRoot) {
    console.warn("Leitbild: Keine Laser-Vorschau gefunden.")
    return null
  }

  const nestedCanvas = previewRoot.querySelector("canvas")
  if (nestedCanvas) {
    return captureCanvasLeitbild(nestedCanvas)
  }

  try {
    const snapshot = await html2canvas(previewRoot, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      logging: false,
    })
    const leitbildUrl = snapshot.toDataURL("image/png")
    if (!leitbildUrl || leitbildUrl === "data:,") {
      console.warn("Leitbild: Laser-Vorschau konnte nicht gerendert werden.")
      return null
    }
    return leitbildUrl
  } catch (error) {
    console.warn("Leitbild: Laser-Snapshot fehlgeschlagen.", error)
    return null
  }
}

export async function capture3dPreviewLeitbild(
  canvasOrRoot: HTMLCanvasElement | HTMLElement | null | undefined
): Promise<string | null> {
  await waitForPreviewPaint()

  if (!canvasOrRoot) {
    console.warn("Leitbild: Keine 3D-Vorschau gefunden.")
    return null
  }

  if (canvasOrRoot instanceof HTMLCanvasElement) {
    return captureCanvasLeitbild(canvasOrRoot)
  }

  const canvas = findLeitbildCanvas(canvasOrRoot)
  return captureCanvasLeitbild(canvas)
}
