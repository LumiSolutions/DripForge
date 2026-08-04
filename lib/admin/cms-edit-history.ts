/** postMessage-Protokoll zwischen In-Context-Toolbar (Parent) und Storefront-Iframe. */
export const CMS_HISTORY_MESSAGE_SOURCE = "dripforge-cms-history" as const

/** CustomEvent: Inline-Editor (Popover / Legal-Titel) öffnet oder schliesst. */
export const CMS_EDITING_EVENT = "dripforge-cms-editing" as const

/** CustomEvent: Offene Draft-Editoren sollen speichern. */
export const CMS_SAVE_ALL_EVENT = "dripforge-cms-save-all" as const

/** CustomEvent: Offene Draft-Editoren abbrechen. */
export const CMS_CANCEL_EDITING_EVENT = "dripforge-cms-cancel-editing" as const

export type CmsHistoryParentCommand =
  | { source: typeof CMS_HISTORY_MESSAGE_SOURCE; type: "undo" }
  | { source: typeof CMS_HISTORY_MESSAGE_SOURCE; type: "redo" }
  | { source: typeof CMS_HISTORY_MESSAGE_SOURCE; type: "ping" }
  | { source: typeof CMS_HISTORY_MESSAGE_SOURCE; type: "mark-saved" }
  | { source: typeof CMS_HISTORY_MESSAGE_SOURCE; type: "discard" }
  | { source: typeof CMS_HISTORY_MESSAGE_SOURCE; type: "save-all" }

export type CmsHistoryIframeEvent = {
  source: typeof CMS_HISTORY_MESSAGE_SOURCE
  type: "state"
  canUndo: boolean
  canRedo: boolean
  dirty: boolean
}

export function reportCmsInlineEditing(active: boolean) {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent(CMS_EDITING_EVENT, { detail: { active } })
  )
}

export function isCmsHistoryParentCommand(
  data: unknown
): data is CmsHistoryParentCommand {
  if (!data || typeof data !== "object") return false
  const msg = data as Record<string, unknown>
  return (
    msg.source === CMS_HISTORY_MESSAGE_SOURCE &&
    (msg.type === "undo" ||
      msg.type === "redo" ||
      msg.type === "ping" ||
      msg.type === "mark-saved" ||
      msg.type === "discard" ||
      msg.type === "save-all")
  )
}

export function isCmsHistoryIframeEvent(
  data: unknown
): data is CmsHistoryIframeEvent {
  if (!data || typeof data !== "object") return false
  const msg = data as Record<string, unknown>
  if (
    msg.source !== CMS_HISTORY_MESSAGE_SOURCE ||
    msg.type !== "state" ||
    typeof msg.canUndo !== "boolean" ||
    typeof msg.canRedo !== "boolean"
  ) {
    return false
  }
  // Ältere Iframes ohne dirty: aus canUndo ableiten
  if (typeof msg.dirty !== "boolean") {
    ;(msg as { dirty: boolean }).dirty = msg.canUndo
  }
  return true
}
