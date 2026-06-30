import type { TawkApi } from "@/lib/tawk/tawk-types"

const TAWK_HOST_ID = "tawk-hidden-host"

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function getTawkIframes(): HTMLIFrameElement[] {
  return Array.from(document.querySelectorAll("iframe")).filter((iframe) => {
    const title = iframe.title?.toLowerCase() ?? ""
    const src = iframe.src?.toLowerCase() ?? ""
    return title.includes("tawk") || title.includes("chat widget") || src.includes("tawk")
  })
}

function buildPostMessagePayloads(text: string): unknown[] {
  return [
    { action: "sendMessage", message: text },
    { event: "send-message", message: text },
    { event: "chat:sendMessage", data: { message: text } },
    { cmd: "sendChatMessage", message: text },
    { name: "visitor-message", message: text },
    { type: "submit-message", text },
    { method: "sendMessage", args: [text] },
    JSON.stringify({ method: "sendMessage", args: [text] }),
  ]
}

function postMessageToTawkIframes(text: string): void {
  const payloads = buildPostMessagePayloads(text)
  for (const iframe of getTawkIframes()) {
    if (!iframe.contentWindow) continue
    for (const payload of payloads) {
      try {
        iframe.contentWindow.postMessage(payload, "*")
      } catch {
        /* ignore cross-origin postMessage errors */
      }
    }
  }

  try {
    window.postMessage({ event: "tawk-send-message", message: text }, "*")
  } catch {
    /* ignore */
  }
}

function trySameOriginInputInjection(text: string): boolean {
  const host = document.getElementById(TAWK_HOST_ID)
  const roots = [host, document.getElementById("tawk-bubble-container"), document.body].filter(
    Boolean
  ) as HTMLElement[]

  for (const root of roots) {
    const fields = root.querySelectorAll<HTMLElement>(
      "textarea, input[type='text'], [contenteditable='true'], [role='textbox']"
    )

    for (const field of fields) {
      if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) {
        field.value = text
        field.dispatchEvent(new Event("input", { bubbles: true }))
        field.dispatchEvent(new Event("change", { bubbles: true }))
        field.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true })
        )
        field.dispatchEvent(
          new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true })
        )
        return true
      }

      if (field.isContentEditable) {
        field.textContent = text
        field.dispatchEvent(new Event("input", { bubbles: true }))
        field.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true })
        )
        return true
      }
    }

    const sendButtons = root.querySelectorAll<HTMLElement>(
      "button[type='submit'], button[aria-label*='send' i], .tawk-button-send, .tawk-send-button"
    )
    for (const button of sendButtons) {
      button.click()
    }
  }

  return false
}

function tryInternalTawkWindowSend(text: string): boolean {
  const tawkWindow = (window as Window & { Tawk_Window?: Record<string, unknown> }).Tawk_Window
  if (!tawkWindow) return false

  const candidates = [
    tawkWindow.sendMessage,
    (tawkWindow as { chatManager?: { sendMessage?: (msg: string) => void } }).chatManager
      ?.sendMessage,
    (tawkWindow as { socket?: { emit?: (event: string, data: unknown) => void } }).socket?.emit,
  ]

  for (const candidate of candidates) {
    if (typeof candidate !== "function") continue
    try {
      if (candidate.length >= 2) {
        ;(candidate as (event: string, data: unknown) => void)("visitor-message", { message: text })
      } else {
        ;(candidate as (msg: string) => void)(text)
      }
      return true
    } catch {
      /* try next candidate */
    }
  }

  return false
}

function registerTawkHost(): void {
  if (document.getElementById(TAWK_HOST_ID)) return
  const host = document.createElement("div")
  host.id = TAWK_HOST_ID
  host.setAttribute("aria-hidden", "true")
  document.body.appendChild(host)
}

export function prepareTawkEmbeddedHost(api: TawkApi): void {
  registerTawkHost()
  ;(api as TawkApi & { embedded?: string }).embedded = TAWK_HOST_ID
}

export async function dispatchTawkVisitorMessage(api: TawkApi, text: string): Promise<void> {
  api.start?.()

  api.maximize?.()
  await sleep(350)

  postMessageToTawkIframes(text)
  trySameOriginInputInjection(text)
  tryInternalTawkWindowSend(text)

  await new Promise<void>((resolve) => {
    api.addEvent?.(
      "dripforge-webchat",
      { message: text, source: "custom-ui" },
      () => resolve()
    )
    window.setTimeout(resolve, 250)
  })

  api.minimize?.()
  api.hideWidget?.()
}
