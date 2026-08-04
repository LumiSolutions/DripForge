/** postMessage-Protokoll zwischen In-Context-Toolbar (Parent) und Storefront-Iframe. */
export const CMS_HISTORY_MESSAGE_SOURCE = "dripforge-cms-history" as const

export type CmsHistoryParentCommand =
  | { source: typeof CMS_HISTORY_MESSAGE_SOURCE; type: "undo" }
  | { source: typeof CMS_HISTORY_MESSAGE_SOURCE; type: "redo" }
  | { source: typeof CMS_HISTORY_MESSAGE_SOURCE; type: "ping" }

export type CmsHistoryIframeEvent = {
  source: typeof CMS_HISTORY_MESSAGE_SOURCE
  type: "state"
  canUndo: boolean
  canRedo: boolean
}

export function isCmsHistoryParentCommand(
  data: unknown
): data is CmsHistoryParentCommand {
  if (!data || typeof data !== "object") return false
  const msg = data as Record<string, unknown>
  return (
    msg.source === CMS_HISTORY_MESSAGE_SOURCE &&
    (msg.type === "undo" || msg.type === "redo" || msg.type === "ping")
  )
}

export function isCmsHistoryIframeEvent(
  data: unknown
): data is CmsHistoryIframeEvent {
  if (!data || typeof data !== "object") return false
  const msg = data as Record<string, unknown>
  return (
    msg.source === CMS_HISTORY_MESSAGE_SOURCE &&
    msg.type === "state" &&
    typeof msg.canUndo === "boolean" &&
    typeof msg.canRedo === "boolean"
  )
}
