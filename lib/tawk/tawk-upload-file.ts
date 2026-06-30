import {
  emitVisitorFileUpload,
  loadTawkBridge,
  subscribeTawkFileUpload,
  waitForTawkBridgeReady,
} from "@/lib/tawk/tawk-bridge"
import { waitForTawkSocketReady, getTawkVisitorSessionKey } from "@/lib/tawk/tawk-session-key"
import type { TawkApi, TawkUploadResult } from "@/lib/tawk/tawk-types"

const MAX_FILE_BYTES = 52_428_800

type UploadHandleResponse = {
  handle?: string
}

type UploadResultResponse = {
  success?: boolean
  name?: string
  filename?: string
  mimeType?: string
  extension?: string
  size?: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function buildUploadUrl(sessionKey: string, handle: string): string {
  return (
    "https://upload.tawk.to/upload/visitor-chat/visitor" +
    `?handle=${encodeURIComponent(handle)}` +
    `&visitorSessionId=${encodeURIComponent(sessionKey)}`
  )
}

function toPublicFileUrl(data: UploadResultResponse): string | undefined {
  const name = data.name ?? data.filename
  if (typeof name === "string" && name.trim()) {
    return `https://tawkto.link/${name.trim()}`
  }
  return undefined
}

function xhrGetJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("GET", url, true)
    xhr.withCredentials = true

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 400) {
        reject(new Error(`Upload-Handle fehlgeschlagen (HTTP ${xhr.status}).`))
        return
      }

      try {
        resolve(JSON.parse(xhr.responseText) as T)
      } catch {
        reject(new Error("Upload-Handle: Ungültige JSON-Antwort."))
      }
    }

    xhr.onerror = () => reject(new Error("Upload-Handle: Netzwerkfehler."))
    xhr.send()
  })
}

function xhrPostFormData(url: string, formData: FormData): Promise<UploadResultResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", url, true)
    xhr.withCredentials = true

    xhr.onload = () => {
      console.log("[Tawk Upload] HTTP", xhr.status, xhr.responseText)

      if (xhr.status < 200 || xhr.status >= 400) {
        reject(
          new Error(
            `Tawk-Upload abgelehnt (HTTP ${xhr.status}): ${xhr.responseText || "Keine Antwort"}`
          )
        )
        return
      }

      try {
        const data = JSON.parse(xhr.responseText) as UploadResultResponse | boolean
        if (data === true) {
          reject(new Error("Tawk-Upload abgelehnt (Server antwortete mit true)."))
          return
        }

        if (data && typeof data === "object" && data.success === false) {
          reject(new Error(`Tawk-Upload abgelehnt: ${JSON.stringify(data)}`))
          return
        }

        resolve((data ?? {}) as UploadResultResponse)
      } catch {
        reject(new Error("Tawk-Upload: Ungültige JSON-Antwort vom Server."))
      }
    }

    xhr.onerror = () => reject(new Error("Tawk-Upload: Netzwerkfehler beim POST."))
    xhr.send(formData)
  })
}

async function fetchUploadHandle(): Promise<string> {
  const data = await xhrGetJson<UploadHandleResponse>(
    `https://upload.tawk.to/upload/handle?_t=${Date.now()}`
  )

  if (!data.handle) {
    throw new Error("Upload-Handle fehlt in der Tawk-Antwort.")
  }

  return data.handle
}

async function postVisitorFile(
  file: File,
  sessionKey: string,
  handle: string
): Promise<UploadResultResponse> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Datei ist größer als 50 MB.")
  }

  const formData = new FormData()
  formData.append("upload", file, file.name || "upload")

  return xhrPostFormData(buildUploadUrl(sessionKey, handle), formData)
}

function waitForTawkFileUploadConfirmation(timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false

    const finish = (error?: unknown, url?: string) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      unsubscribe()

      if (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
        return
      }

      if (!url) {
        reject(new Error("Tawk onFileUpload ohne URL."))
        return
      }

      resolve(url)
    }

    const timeoutId = window.setTimeout(() => {
      finish(new Error("Upload-Timeout: Tawk onFileUpload nicht empfangen."))
    }, timeoutMs)

    const unsubscribe = subscribeTawkFileUpload((url) => {
      finish(undefined, url)
    })
  })
}

async function ensureTawkUploadReady(api: TawkApi): Promise<void> {
  await waitForTawkBridgeReady(api)
  api.start?.()
  api.maximize?.()
  await sleep(400)
  await waitForTawkSocketReady()
}

async function uploadViaTawkEndpoint(file: File): Promise<TawkUploadResult> {
  const api = await loadTawkBridge()
  await ensureTawkUploadReady(api)

  const sessionKey = getTawkVisitorSessionKey()
  if (!sessionKey) {
    throw new Error("Tawk visitorSessionId fehlt nach Widget-Load.")
  }

  const uploadConfirmation = waitForTawkFileUploadConfirmation(45_000)
  const handle = await fetchUploadHandle()
  const uploadResponse = await postVisitorFile(file, sessionKey, handle)
  const responseUrl = toPublicFileUrl(uploadResponse)

  console.log("[Tawk Upload] Handle:", handle, "Session:", sessionKey, "Response:", uploadResponse)

  try {
    const confirmedUrl = await uploadConfirmation
    return { success: true, url: confirmedUrl }
  } catch (confirmationError) {
    if (responseUrl && uploadResponse.success !== false) {
      console.warn("[Tawk Upload] onFileUpload ausgeblieben, nutze Server-URL.", confirmationError)
      emitVisitorFileUpload(responseUrl)
      return { success: true, url: responseUrl }
    }

    throw confirmationError
  }
}

function reportUploadError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  console.error("[Tawk Upload] Fehler:", error)
  if (typeof window !== "undefined") {
    window.alert(`Tawk Upload fehlgeschlagen:\n${message}`)
  }
}

export function installTawkUploadFilePolyfill(api: TawkApi): void {
  const taggedApi = api as TawkApi & { __dripforgeUploadPolyfill?: boolean }
  if (taggedApi.__dripforgeUploadPolyfill) return
  taggedApi.__dripforgeUploadPolyfill = true

  api.uploadFile = (file: File, callback?: (error?: unknown, result?: TawkUploadResult) => void) => {
    void uploadViaTawkEndpoint(file)
      .then((result) => {
        console.log("[Tawk Upload] Erfolg:", result.url)
        callback?.(undefined, result)
      })
      .catch((error) => {
        reportUploadError(error)
        callback?.(error)
      })
  }
}

export async function uploadTawkVisitorFile(file: File): Promise<TawkUploadResult> {
  await loadTawkBridge()

  const api = window.Tawk_API
  if (!api || typeof api.uploadFile !== "function") {
    const error = new Error("Tawk uploadFile ist nicht verfügbar (Widget nicht geladen).")
    reportUploadError(error)
    throw error
  }

  return await new Promise<TawkUploadResult>((resolve, reject) => {
    api.uploadFile!(file, (error, result) => {
      if (error) {
        reject(error instanceof Error ? error : new Error("Upload fehlgeschlagen"))
        return
      }

      if (!result?.success || !result.url) {
        reject(new Error("Tawk Upload ohne bestätigte Bild-URL abgeschlossen."))
        return
      }

      resolve(result)
    })
  })
}
