"use client"

import { ImpressumPageContent } from "@/components/dripforge/views/impressum-page-content"

export function PageImpressum({
  setCurrentView: _setCurrentView,
}: {
  setCurrentView: (view: string) => void
}) {
  return <ImpressumPageContent />
}
