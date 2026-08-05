/**
 * Komprimiert Data-URL-Vorschaubilder für localStorage und speichert
 * Originale optional in IndexedDB (Refresh-sicher).
 */

import type { CartItem } from "@/lib/dripforge/types"

const IDB_NAME = "dripforge-cart-previews"
const IDB_STORE = "previews"
const IDB_VERSION = 1

function openPreviewDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE)
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function putCartPreview(
  itemId: string,
  field: "leitbild" | "previewMockup",
  dataUrl: string
): Promise<void> {
  if (!itemId || !dataUrl.startsWith("data:")) return
  const db = await openPreviewDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readwrite")
      tx.objectStore(IDB_STORE).put(dataUrl, `${itemId}:${field}`)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
  db.close()
}

export async function getCartPreview(
  itemId: string,
  field: "leitbild" | "previewMockup"
): Promise<string | null> {
  const db = await openPreviewDb()
  if (!db) return null
  const value = await new Promise<string | null>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readonly")
      const req = tx.objectStore(IDB_STORE).get(`${itemId}:${field}`)
      req.onsuccess = () => {
        const v = req.result
        resolve(typeof v === "string" && v.startsWith("data:") ? v : null)
      }
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  db.close()
  return value
}

export async function clearAllCartPreviews(): Promise<void> {
  const db = await openPreviewDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readwrite")
      tx.objectStore(IDB_STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
  db.close()
}

/** Shrink a data-URL image for localStorage (JPEG, max edge). */
export async function compressPreviewDataUrl(
  dataUrl: string,
  maxEdge = 480,
  quality = 0.62
): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) return dataUrl
  if (typeof document === "undefined") return dataUrl

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height, 1))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement("canvas")
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          resolve(dataUrl)
          return
        }
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL("image/jpeg", quality))
      } catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export async function persistItemPreviews(item: CartItem): Promise<CartItem> {
  const next = { ...item }
  // Zuerst IndexedDB (Originale), dann komprimieren für localStorage —
  // sonst kann QuotaExceeded die Data-URLs strippen bevor IDB fertig ist.
  const idbPuts: Promise<void>[] = []
  if (typeof next.leitbild === "string" && next.leitbild.startsWith("data:")) {
    idbPuts.push(putCartPreview(next.id, "leitbild", next.leitbild))
  }
  if (
    typeof next.previewMockup === "string" &&
    next.previewMockup.startsWith("data:")
  ) {
    idbPuts.push(putCartPreview(next.id, "previewMockup", next.previewMockup))
  }
  await Promise.all(idbPuts)

  if (typeof next.leitbild === "string" && next.leitbild.startsWith("data:")) {
    next.leitbild = await compressPreviewDataUrl(next.leitbild)
  }
  if (
    typeof next.previewMockup === "string" &&
    next.previewMockup.startsWith("data:")
  ) {
    next.previewMockup = await compressPreviewDataUrl(next.previewMockup)
  }
  // Produktionslayer nie in localStorage — zu gross
  if (
    typeof next.productionLayer === "string" &&
    next.productionLayer.startsWith("data:")
  ) {
    delete next.productionLayer
  }
  return next
}

/** Stellt fehlende Previews nach Refresh aus IndexedDB wieder her. */
export async function restoreCartItemPreviews(
  items: CartItem[]
): Promise<CartItem[]> {
  if (!items.length) return items
  let changed = false
  const next = await Promise.all(
    items.map(async (item) => {
      let leitbild = item.leitbild
      let previewMockup = item.previewMockup
      if (!leitbild) {
        const restored = await getCartPreview(item.id, "leitbild")
        if (restored) {
          leitbild = restored
          changed = true
        }
      }
      if (!previewMockup) {
        const restored = await getCartPreview(item.id, "previewMockup")
        if (restored) {
          previewMockup = restored
          changed = true
        }
      }
      if (leitbild === item.leitbild && previewMockup === item.previewMockup) {
        return item
      }
      return { ...item, leitbild, previewMockup }
    })
  )
  return changed ? next : items
}

/** Katalog-/Hintergrund-Fallback für leere Vorschaubilder. */
export function resolveCartPreviewSrc(item: CartItem): string | undefined {
  return (
    item.leitbild ||
    item.previewMockup ||
    item.customDetails?.productBackgroundUrl ||
    undefined
  )
}
