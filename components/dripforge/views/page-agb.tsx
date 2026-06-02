"use client"

import { AgbPageContent } from "@/components/dripforge/views/agb-page-content"

export function PageAGB({
  setCurrentView: _setCurrentView,
}: {
  setCurrentView: (view: string) => void
}) {
  return <AgbPageContent />
}
