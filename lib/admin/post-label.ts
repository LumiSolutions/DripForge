/** Platzhalter für Thermo-Etikettendruck (105×148 mm, Swiss Post). */

export const POST_LABEL_SIZE_MM = { width: 105, height: 148 } as const

/**
 * Bereitet den Post-Etikettendruck vor (PDF/ZPL-Export folgt).
 * Aktuell: Log-Hinweis und optionaler Platzhalter-Download.
 */
export async function handlePrintPostLabel(orderId: string): Promise<void> {
  console.info(
    `[Post-Label] Platzhalter — Etikett ${POST_LABEL_SIZE_MM.width}×${POST_LABEL_SIZE_MM.height}mm für Bestellung ${orderId}`
  )

  const placeholder = [
    "DripForge — Post-Etikett (Platzhalter)",
    `Bestellung: ${orderId}`,
    `Format: ${POST_LABEL_SIZE_MM.width} × ${POST_LABEL_SIZE_MM.height} mm`,
    "",
    "Integration für Thermodrucker (PDF/ZPL) folgt.",
  ].join("\n")

  const blob = new Blob([placeholder], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `post-etikett-${orderId.replace(/[^a-zA-Z0-9-_]/g, "_")}.txt`
  anchor.click()
  URL.revokeObjectURL(url)
}
