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
  maximize?: () => void
  minimize?: () => void
  start?: () => void
  onLoad?: () => void
  onBeforeLoad?: () => void
  onChatMessageAgent?: TawkMessageCallback
  onChatMessageVisitor?: TawkMessageCallback
  onChatMessageReceived?: TawkMessageCallback
  addEvent?: (
    eventName: string,
    metadata?: Record<string, unknown>,
    callback?: (error?: unknown) => void
  ) => void
  embedded?: string
}

declare global {
  interface Window {
    Tawk_API?: TawkApi
    Tawk_LoadStart?: Date
    Tawk_Window?: Record<string, unknown>
  }
}

export {}
