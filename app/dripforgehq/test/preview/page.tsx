import type { Metadata } from "next"
import { AdminTestStagingPreviewGate } from "@/components/admin/admin-test-staging-preview-gate"

export const metadata: Metadata = {
  title: "Staging-Vorschau | DripForge HQ",
  robots: { index: false, follow: false },
}

/**
 * Reine Staging-Vorschau unter /dripforgehq/test/preview.
 * Liegt bewusst ausserhalb von (portal)/AdminShell, damit Admin- und Tester-Sessions
 * die Vorschau ohne Edit-Overlays nutzen können.
 */
export default function DripforgeHqTestPreviewPage() {
  return <AdminTestStagingPreviewGate />
}
