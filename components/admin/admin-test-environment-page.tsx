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
import { cmsReadonlyPreviewHref } from "@/lib/admin/cms-preview-pages"
import { cn } from "@/lib/utils"

export function AdminTestEnvironmentPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className={cn("text-2xl font-bold", adminUi.heading)}>Test-Umgebung</h1>
        <p className={cn("mt-2 text-sm", adminUi.muted)}>
          Die Test-Umgebung zeigt Staging-Inhalte (Texte, Bilder, Navigation) bevor sie live
          gehen — ohne Bearbeitungswerkzeuge, wie für echte Endnutzer.
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
                <li>
                  Tester und Admins prüfen den Entwurf über die reine Staging-Vorschau
                  (ohne Edit-Overlays).
                </li>
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
          <Link href={adminPortalPath("/test/preview")}>
            <Eye className="mr-2 h-4 w-4" />
            Staging-Vorschau öffnen
          </Link>
        </Button>
        <Button type="button" size="lg" variant="secondary" asChild>
          <Link
            href={cmsReadonlyPreviewHref("/")}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Eye className="mr-2 h-4 w-4" />
            Vollbild Home (nur lesen)
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
          <p className={cn("font-medium", adminUi.heading)}>Einstiegs-URLs</p>
          <p className={adminUi.muted}>
            HQ-Vorschau:{" "}
            <Link
              href={adminPortalPath("/test/preview")}
              className="underline underline-offset-2"
            >
              /dripforgehq/test/preview
            </Link>
            . Öffentliche Tester-URL:{" "}
            <Link href="/test/preview" className="underline underline-offset-2">
              /test/preview
            </Link>{" "}
            (leitet in die read-only Staging-Vorschau). Legacy{" "}
            <Link href="/vorschau" className="underline underline-offset-2">
              /vorschau
            </Link>{" "}
            bleibt kompatibel.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
