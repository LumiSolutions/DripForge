"use client"

import { useEffect, useRef } from "react"

const DEFAULT_MESSAGE =
  "Du hast ungespeicherte Änderungen. Möchtest du die Seite wirklich verlassen?"

/**
 * Warnt bei Navigation/Reload, wenn `isDirty` true ist.
 * - beforeunload für Tab-Schliessen / Reload
 * - intercepts same-origin <a> clicks (capture) with window.confirm
 */
export function useUnsavedChangesGuard(
  isDirty: boolean,
  message: string = DEFAULT_MESSAGE
) {
  const dirtyRef = useRef(isDirty)
  dirtyRef.current = isDirty
  const messageRef = useRef(message)
  messageRef.current = message

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      event.preventDefault()
      event.returnValue = messageRef.current
      return messageRef.current
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!dirtyRef.current) return
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return
      if (anchor.target === "_blank") return

      const ok = window.confirm(messageRef.current)
      if (!ok) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])
}
