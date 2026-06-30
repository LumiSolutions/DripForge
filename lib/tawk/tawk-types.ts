export type TawkChatRole = "visitor" | "admin"

export type TawkUiMessage = {
  id: string
  role: TawkChatRole
  content: string
  createdAt: string
}

export type TawkMessageCallback = (message: unknown) => void

export type TawkApi = {
  hideWidget?: () => void
  showWidget?: () => void
  start?: () => void
  onLoad?: () => void
  onBeforeLoad?: () => void
  onChatMessageAgent?: TawkMessageCallback
  onChatMessageVisitor?: TawkMessageCallback
  onChatMessageReceived?: TawkMessageCallback
  sendMessage?: (message: string, callback?: (error?: unknown) => void) => void
}

declare global {
  interface Window {
    Tawk_API?: TawkApi
    Tawk_LoadStart?: Date
  }
}

export {}
