"use client"

let visitorSessionKey: string | null = null
let sessionCaptureInstalled = false

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function readSessionKeyFromUrl(url: string): string | null {
  const match = url.match(/[?&]k=([^&]+)/)
  if (!match?.[1]) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

function rememberSessionKey(key: string | null | undefined): void {
  if (key && key.trim()) visitorSessionKey = key.trim()
}

function installRegisterResponseCapture(): void {
  const xhrOpen = XMLHttpRequest.prototype.open
  const xhrSend = XMLHttpRequest.prototype.send

  XMLHttpRequest.prototype.open = function openWithTawkCapture(
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ) {
    ;(this as XMLHttpRequest & { _tawkRequestUrl?: string })._tawkRequestUrl = String(url)
    return xhrOpen.call(this, method, url, async ?? true, username, password)
  }

  XMLHttpRequest.prototype.send = function sendWithTawkCapture(body?: Document | XMLHttpRequestBodyInit | null) {
    this.addEventListener("load", function onRegisterLoad(this: XMLHttpRequest) {
      const requestUrl = (this as XMLHttpRequest & { _tawkRequestUrl?: string })._tawkRequestUrl ?? ""
      if (!requestUrl.includes("tawk.to")) return

      try {
        const data = JSON.parse(this.responseText) as { sk?: string }
        rememberSessionKey(data.sk)
      } catch {
        /* ignore non-json responses */
      }
    })

    return xhrSend.call(this, body)
  }
}

export function installTawkSessionKeyCapture(): void {
  if (sessionCaptureInstalled || typeof window === "undefined") return
  sessionCaptureInstalled = true

  installRegisterResponseCapture()

  const OriginalWebSocket = window.WebSocket
  const WebSocketWithTawkSessionCapture = function WebSocketWithTawkSessionCapture(
    url: string | URL,
    protocols?: string | string[]
  ) {
    const urlString = typeof url === "string" ? url : url.toString()
    if (urlString.includes("tawk.to")) {
      rememberSessionKey(readSessionKeyFromUrl(urlString))
    }

    return new OriginalWebSocket(url, protocols)
  } as unknown as typeof WebSocket

  WebSocketWithTawkSessionCapture.prototype = OriginalWebSocket.prototype
  window.WebSocket = WebSocketWithTawkSessionCapture
}

export function getTawkVisitorSessionKey(): string | null {
  return visitorSessionKey
}

export async function waitForTawkVisitorSessionKey(timeoutMs = 20_000): Promise<string> {
  const started = Date.now()
  while (!visitorSessionKey && Date.now() - started < timeoutMs) {
    await sleep(100)
  }

  if (!visitorSessionKey) {
    throw new Error("Tawk-Session ist noch nicht bereit (visitorSessionId fehlt).")
  }

  return visitorSessionKey
}

export async function waitForTawkSocketReady(delayMs = 1_500): Promise<void> {
  await waitForTawkVisitorSessionKey()
  await sleep(delayMs)
}
