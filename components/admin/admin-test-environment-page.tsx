"use client"

import Link from "next/link"
import {
  Eye,
  FlaskConical,
  MousePointerClick,
  Rocket,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import { adminPortalPath } from "@/lib/admin/admin-portal-path"
import { cmsPreviewHref } from "@/lib/admin/cms-preview-pages"
import { cn } from "@/lib/utils"

export function AdminTestEnvironmentPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className={cn("text-2xl font-bold", adminUi.heading)}>Test-Umgebung</h1>
        <p className={cn("mt-2 text-sm", adminUi.muted)}>
          Die Test-Umgebung zeigt Staging-Inhalte (Texte, Bilder, Navigation) bevor sie live
          gehen. Tester und Admins öffnen die Storefront mit{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">?preview=true</code>.
        </p>
      </div>

      <Card className={adminUi.card}>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <FlaskConical className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <p className={cn("font-medium", adminUi.heading)}>So funktioniert Staging</p>
              <ul className={cn("mt-2 list-disc space-y-1 pl-5 text-sm", adminUi.muted)}>
                <li>Änderungen werden zuerst als Entwurf gespeichert.</li>
                <li>Tester sehen den Entwurf über die Test-Vorschau.</li>
                <li>
                  Erst «Live veröffentlichen» übernimmt Staging in die Production-Website.
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button type="button" size="lg" asChild>
          <Link href="/test/preview" target="_blank" rel="noopener noreferrer">
            <Eye className="mr-2 h-4 w-4" />
            Test-Vorschau öffnen
          </Link>
        </Button>
        <Button type="button" size="lg" variant="secondary" asChild>
          <Link href={cmsPreviewHref("/")} target="_blank" rel="noopener noreferrer">
            <Eye className="mr-2 h-4 w-4" />
            Staging Home (?preview=true)
          </Link>
        </Button>
        <Button type="button" size="lg" variant="outline" asChild>
          <Link href={adminPortalPath("/edit/preview")}>
            <MousePointerClick className="mr-2 h-4 w-4" />
            In-Context Editor
          </Link>
        </Button>
        <Button type="button" size="lg" variant="outline" asChild>
          <Link href={adminPortalPath("/edit")}>
            <Rocket className="mr-2 h-4 w-4" />
            Website bearbeiten / Publish
          </Link>
        </Button>
      </div>

      <Card className={adminUi.card}>
        <CardContent className="space-y-2 p-5 text-sm">
          <p className={cn("font-medium", adminUi.heading)}>Tester-Einstieg</p>
          <p className={adminUi.muted}>
            Öffentliche Einstiegs-URL für Tester:{" "}
            <Link href="/test/preview" className="underline underline-offset-2">
              /test/preview
            </Link>
            . Die bisherige Route{" "}
            <Link href="/vorschau" className="underline underline-offset-2">
              /vorschau
            </Link>{" "}
            bleibt kompatibel (leitet ebenfalls in die Staging-Vorschau).
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
