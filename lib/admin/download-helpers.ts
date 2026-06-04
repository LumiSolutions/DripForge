"use client"

import { sanitizeFilename } from "@/lib/admin/sanitize-filename"

export { sanitizeFilename }

function triggerDownload(filename: string, href: string) {
  const link = document.createElement("a")
  link.href = href
  link.download = filename
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function downloadDataUrl(filename: string, dataUrl: string) {
  triggerDownload(filename, dataUrl)
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  triggerDownload(filename, url)
  URL.revokeObjectURL(url)
}

