import { loadTawkBridge } from "@/lib/tawk/tawk-bridge"

function normalizeUploadLink(link: unknown): string | null {
  if (typeof link === "string" && link.trim()) return link.trim()
  if (link && typeof link === "object") {
    const record = link as Record<string, unknown>
    if (typeof record.url === "string" && record.url.trim()) return record.url.trim()
    if (typeof record.link === "string" && record.link.trim()) return record.link.trim()
  }
  return null
}

export async function uploadTawkVisitorFile(file: File): Promise<string | undefined> {
  const api = await loadTawkBridge()
  api.start?.()

  const uploadFile = api.uploadFile
  if (typeof uploadFile !== "function") {
    throw new Error("Tawk uploadFile ist nicht verfügbar.")
  }

  return await new Promise<string | undefined>((resolve, reject) => {
    let settled = false
    const previousOnFileUpload = api.onFileUpload

    const finish = (link?: string, error?: unknown) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      api.onFileUpload = previousOnFileUpload

      if (error) {
        reject(error instanceof Error ? error : new Error("Upload fehlgeschlagen"))
        return
      }

      resolve(link)
    }

    const timeoutId = window.setTimeout(() => finish(undefined), 30_000)

    api.onFileUpload = (link) => {
      previousOnFileUpload?.(link)
      const url = normalizeUploadLink(link)
      if (url) finish(url)
    }

    try {
      uploadFile.call(api, file, (error, link) => {
        if (error) {
          finish(undefined, error)
          return
        }

        const url = normalizeUploadLink(link)
        if (url) finish(url)
      })
    } catch (error) {
      finish(undefined, error)
    }
  })
}
