import html2canvas from "html2canvas"

export const LEITBILD_3D_CANVAS_ATTR = "data-leitbild-3d-preview"
export const LEITBILD_LASER_PREVIEW_ATTR = "data-leitbild-laser-preview"
/** Elemente mit diesem Attribut werden beim Mockup-Snapshot ausgeblendet. */
export const CAPTURE_HIDE_ATTR = "data-capture-hide"

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
        "Leitbild: Canvas-Auslese lieferte ein leeres Bild. preserveDrawingBuffer prüfen."
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
      `canvas[${LEITBILD_3D_CANVAS_ATTR}]`
    )
    if (nested) return nested
  }
  return document.querySelector<HTMLCanvasElement>(
    `canvas[${LEITBILD_3D_CANVAS_ATTR}]`
  )
}

function shouldHideForCapture(el: Element): boolean {
  return (
    el.hasAttribute(CAPTURE_HIDE_ATTR) ||
    Boolean(el.closest(`[${CAPTURE_HIDE_ATTR}]`))
  )
}

/** Laser-Vorschau (HTML) — immer Composite (Hintergrund + Layer), kein 3D-Canvas-Shortcut. */
export async function captureLaserPreviewLeitbild(
  previewRoot: HTMLElement | null | undefined
): Promise<string | null> {
  if (!previewRoot) {
    console.warn("Leitbild: Keine Laser-Vorschau gefunden.")
    return null
  }

  // Nur explizite 3D-Leitbild-Canvas — nie ein zufälliges nested canvas
  const marked3d = previewRoot.querySelector<HTMLCanvasElement>(
    `canvas[${LEITBILD_3D_CANVAS_ATTR}]`
  )
  if (marked3d) {
    return captureCanvasLeitbild(marked3d)
  }

  const hiddenNodes: { el: HTMLElement; visibility: string }[] = []
  previewRoot.querySelectorAll<HTMLElement>(`[${CAPTURE_HIDE_ATTR}]`).forEach((el) => {
    hiddenNodes.push({ el, visibility: el.style.visibility })
    el.style.visibility = "hidden"
  })

  try {
    await waitForPreviewPaint()
    const snapshot = await html2canvas(previewRoot, {
      backgroundColor: "#ffffff",
      scale: Math.min(3, Math.max(2, window.devicePixelRatio || 2)),
      useCORS: true,
      allowTaint: false,
      logging: false,
      ignoreElements: (element) => shouldHideForCapture(element),
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
  } finally {
    for (const { el, visibility } of hiddenNodes) {
      el.style.visibility = visibility
    }
  }
}

/**
 * Kombiniertes Laser-Mockup (Produkt-Hintergrund + alle Layer) als PNG-Data-URL.
 * Speichern unter previewMockup / preview_mockup_url.
 */
export async function captureLaserPreviewMockup(
  previewRoot: HTMLElement | null | undefined
): Promise<string | null> {
  return captureLaserPreviewLeitbild(previewRoot)
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
