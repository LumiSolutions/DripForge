"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Redo2,
  Rocket,
  Save,
  Undo2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { adminPortalPath } from "@/lib/admin/admin-portal-path"
import { cmsPreviewHref } from "@/lib/admin/cms-preview-pages"
import {
  CMS_HISTORY_MESSAGE_SOURCE,
  isCmsHistoryIframeEvent,
  type CmsHistoryParentCommand,
} from "@/lib/admin/cms-edit-history"
import {
  mergeCmsPages,
  resolveCmsEditorPages,
  type CmsPageEntry,
} from "@/lib/admin/site-nav"
import { cn } from "@/lib/utils"

export function AdminInContextEditor() {
  const [pages, setPages] = useState<CmsPageEntry[]>(mergeCmsPages(null))
  const [selectedPath, setSelectedPath] = useState("/")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [iframeKey, setIframeKey] = useState(0)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [guardOpen, setGuardOpen] = useState(false)
  const [pendingPath, setPendingPath] = useState<string | null>(null)
  const [guardBusy, setGuardBusy] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty

  const editorPages = useMemo(() => resolveCmsEditorPages(pages), [pages])

  const iframeSrc = useMemo(() => cmsPreviewHref(selectedPath), [selectedPath])

  const postToIframe = useCallback((command: CmsHistoryParentCommand["type"]) => {
    const win = iframeRef.current?.contentWindow
    if (!win) return
    const payload: CmsHistoryParentCommand = {
      source: CMS_HISTORY_MESSAGE_SOURCE,
      type: command,
    }
    win.postMessage(payload, "*")
  }, [])

  const loadPages = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/site-config", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      const nextPages = mergeCmsPages(data.pages)
      setPages(nextPages)
      const all = resolveCmsEditorPages(nextPages)
      setSelectedPath((current) => {
        if (all.some((page) => page.path === current)) return current
        return all[0]?.path ?? "/"
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Seiten konnten nicht geladen werden.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPages()
  }, [loadPages])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isCmsHistoryIframeEvent(event.data)) return
      setCanUndo(event.data.canUndo)
      setCanRedo(event.data.canRedo)
      setDirty(event.data.dirty)
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey
      if (!mod) return
      const key = event.key.toLowerCase()
      if (key === "z" && !event.shiftKey) {
        event.preventDefault()
        postToIframe("undo")
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault()
        postToIframe("redo")
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [postToIframe])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [])

  const selectPage = (path: string) => {
    setSelectedPath(path)
    setMessage(null)
    setError(null)
    setCanUndo(false)
    setCanRedo(false)
    setDirty(false)
  }

  const requestSelectPage = (path: string) => {
    if (path === selectedPath) return
    if (dirty || canUndo) {
      setPendingPath(path)
      setGuardOpen(true)
      return
    }
    selectPage(path)
  }

  const closeGuard = () => {
    setGuardOpen(false)
    setPendingPath(null)
    setGuardBusy(false)
  }

  const saveAndSwitch = async () => {
    if (!pendingPath) return
    setGuardBusy(true)
    postToIframe("save-all")
    await new Promise((resolve) => window.setTimeout(resolve, 450))
    setDirty(false)
    setCanUndo(false)
    setCanRedo(false)
    const next = pendingPath
    setGuardOpen(false)
    setPendingPath(null)
    setGuardBusy(false)
    selectPage(next)
  }

  const discardAndSwitch = async () => {
    if (!pendingPath) return
    setGuardBusy(true)
    postToIframe("discard")
    await new Promise((resolve) => window.setTimeout(resolve, 450))
    setDirty(false)
    setCanUndo(false)
    setCanRedo(false)
    const next = pendingPath
    setGuardOpen(false)
    setPendingPath(null)
    setGuardBusy(false)
    selectPage(next)
  }

  const publishLive = async () => {
    if (
      !window.confirm(
        "Staging-Inhalte wirklich live veröffentlichen? Besucher sehen danach sofort diese Version."
      )
    ) {
      return
    }
    setPublishing(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch("/api/admin/site-config/publish", {
        method: "POST",
        credentials: "include",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Veröffentlichen fehlgeschlagen")
      setMessage("Live veröffentlicht.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Veröffentlichen fehlgeschlagen")
    } finally {
      setPublishing(false)
    }
  }

  const markSaved = () => {
    setSaving(true)
    setError(null)
    setMessage(
      "Inline-Edits speichern automatisch in Staging. Vorschau wird aktualisiert…"
    )
    postToIframe("mark-saved")
    setDirty(false)
    setCanUndo(false)
    setCanRedo(false)
    setIframeKey((k) => k + 1)
    window.setTimeout(() => {
      setSaving(false)
      setMessage("Staging ist aktuell — mit «Live veröffentlichen» freigeben.")
    }, 500)
  }

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 py-16", adminUi.muted)}>
        <Loader2 className="h-5 w-5 animate-spin" />
        In-Context Editor wird geladen…
      </div>
    )
  }

  return (
    <div className="-mx-2 flex h-[calc(100dvh-6rem)] flex-col gap-3 sm:-mx-0">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/80 px-3 py-2 shadow-sm">
        <Button type="button" size="sm" variant="ghost" asChild>
          <Link href={adminPortalPath("/edit")}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            CMS
          </Link>
        </Button>

        <label className="flex min-w-[12rem] flex-1 items-center gap-2 text-sm sm:max-w-xs">
          <span className={cn("shrink-0 text-xs font-medium uppercase", adminUi.muted)}>
            Seite
          </span>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={selectedPath}
            onChange={(e) => requestSelectPage(e.target.value)}
          >
            {editorPages.map((page) => (
              <option key={page.id} value={page.path}>
                {page.title}
              </option>
            ))}
          </select>
        </label>

        <div className="flex max-w-full flex-wrap gap-1.5 overflow-x-auto">
          {editorPages.map((page) => (
            <button
              key={page.id}
              type="button"
              onClick={() => requestSelectPage(page.path)}
              className={cn(
                "hidden rounded-md px-2 py-1 text-xs font-medium transition lg:inline-flex",
                selectedPath === page.path
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {page.title}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-md border border-border/60 bg-background p-0.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 px-0"
              disabled={!canUndo || saving || publishing}
              title="Rückgängig (Ctrl+Z)"
              aria-label="Rückgängig"
              onClick={() => postToIframe("undo")}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 px-0"
              disabled={!canRedo || saving || publishing}
              title="Wiederholen (Ctrl+Y)"
              aria-label="Wiederholen"
              onClick={() => postToIframe("redo")}
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={markSaved}
            disabled={saving || publishing}
          >
            {saving ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1 h-3.5 w-3.5" />
            )}
            Speichern
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-500"
            onClick={() => void publishLive()}
            disabled={publishing || saving}
          >
            {publishing ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Rocket className="mr-1 h-3.5 w-3.5" />
            )}
            Live veröffentlichen
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href={iframeSrc} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              Neues Fenster
            </Link>
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href={adminPortalPath("/test/preview")}>
              Test-Vorschau
            </Link>
          </Button>
        </div>
      </div>

      {(message || error) && (
        <p
          className={cn(
            "text-xs font-medium",
            error ? "text-red-600 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"
          )}
        >
          {error ?? message}
        </p>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border/60 bg-background shadow-inner">
        <iframe
          ref={iframeRef}
          key={`${iframeKey}:${iframeSrc}`}
          title="In-Context Storefront Preview"
          src={iframeSrc}
          className="h-full w-full border-0 bg-background"
          onLoad={() => postToIframe("ping")}
        />
      </div>

      <AlertDialog
        open={guardOpen}
        onOpenChange={(open) => {
          if (!open && !guardBusy) closeGuard()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ungespeicherte Änderungen</AlertDialogTitle>
            <AlertDialogDescription>
              Ungespeicherte Änderungen. Möchtest du vor dem Wechseln speichern?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={guardBusy}
              onClick={closeGuard}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={guardBusy}
              onClick={() => void discardAndSwitch()}
            >
              Verwerfen
            </Button>
            <Button
              type="button"
              disabled={guardBusy}
              onClick={() => void saveAndSwitch()}
            >
              {guardBusy ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Speichern & Wechseln
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
