"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Coins, Loader2, Sparkles, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import type { Generate3dResult } from "@/lib/ai/generate-3d-provider"
import type { ThreeDGeneratorPublicStatus } from "@/lib/ai/three-d-generator-config"
import {
  AiGeneratorDemoNotice,
  handleGenerate3dResponse,
} from "@/components/dripforge/ai-generator-demo-notice"
import { useCustomerAiCredits } from "@/hooks/use-customer-ai-credits"
import { cn } from "@/lib/utils"

const Product3DPreview = dynamic(
  () =>
    import("@/components/dripforge/shared/product-3d-preview").then(
      (m) => m.Product3DPreview
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-square items-center justify-center rounded-xl border border-border/50 bg-secondary/30 text-sm text-muted-foreground">
        3D-Viewer wird geladen…
      </div>
    ),
  }
)

export function PageAiConfigurator({
  setCurrentView,
}: {
  setCurrentView?: (view: string) => void
}) {
  const [prompt, setPrompt] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Generate3dResult | null>(null)
  const [generatorStatus, setGeneratorStatus] =
    useState<ThreeDGeneratorPublicStatus | null>(null)
  const { loggedIn, loading: creditsLoading, aiCredits, refresh } =
    useCustomerAiCredits()

  const canGenerate = loggedIn && aiCredits > 0 && !generating
  const noCredits = loggedIn && aiCredits === 0

  useEffect(() => {
    void fetch("/api/generate-3d/status", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.demoMode === "boolean") {
          setGeneratorStatus(data as ThreeDGeneratorPublicStatus)
        }
      })
      .catch(() => {
        /* Demo-Hinweis optional */
      })
  }, [])

  const simulateProgress = useCallback(() => {
    setProgress(8)
    const interval = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return prev
        return prev + Math.random() * 12
      })
    }, 400)
    return () => window.clearInterval(interval)
  }, [])

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Bitte beschreibe dein Wunschmodell.")
      return
    }

    setGenerating(true)
    setError(null)
    setResult(null)
    const stopProgress = simulateProgress()

    try {
      const form = new FormData()
      form.append("prompt", prompt.trim())
      form.append("categoryId", "lampen")
      if (imageFile) form.append("image", imageFile)

      const res = await fetch("/api/generate-3d", {
        method: "POST",
        body: form,
        credentials: "include",
        cache: "no-store",
      })
      const data = (await res.json()) as Generate3dResult & {
        error?: string
        remainingAiCredits?: number
      }
      if (!res.ok) throw new Error(data.error ?? "Generierung fehlgeschlagen.")

      setProgress(100)
      setResult(data)
      if (typeof data.remainingAiCredits === "number") {
        await refresh()
      }
      handleGenerate3dResponse(data, generatorStatus)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Generierung fehlgeschlagen."
      )
    } finally {
      stopProgress()
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-10 pb-16 pt-10">
      <section className="mx-auto max-w-4xl px-4 text-center">
        <Badge variant="outline" className="mb-4 border-primary/30 bg-primary/10 text-primary">
          <Sparkles className="mr-1 h-3 w-3" />
          KI-Konfigurator · Phase 1
        </Badge>
        <h1 className="text-3xl font-bold md:text-4xl">
          Text-to-3D &amp; Image-to-3D
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Beschreibe dein Wunschmodell — unsere KI berücksichtigt automatisch die
          technischen Vorgaben für Lampen (Aussparungen, Bauraum Bambu X1C).
        </p>
        {setCurrentView && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-4"
            onClick={() => setCurrentView("shop")}
          >
            ← Zurück zum Shop
          </Button>
        )}

        <div className="mx-auto mt-6 inline-flex flex-col items-center gap-2">
          {creditsLoading ? (
            <p className="text-sm text-muted-foreground">Guthaben wird geladen…</p>
          ) : loggedIn ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-200">
              <Coins className="h-4 w-4 text-violet-400" />
              Verfügbare KI-Generierungen:{" "}
              <span className="text-base font-bold text-violet-300">{aiCredits}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              <Link href="/konto/login" className="font-medium text-primary hover:underline">
                Anmelden
              </Link>
              , um KI-Credits zu nutzen (1 Willkommens-Credit bei Registrierung).
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 lg:grid-cols-2">
        <Card className="border-border/50 bg-card/60">
          <CardContent className="space-y-5 p-6">
            <div className="space-y-2">
              <Label htmlFor="ai-prompt">Beschreibe dein Wunschmodell…</Label>
              <Textarea
                id="ai-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                placeholder="z. B. Minimalistische Tischlampe mit organischen Kurven, flache Standfläche, Kabelführung hinten."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-image">Referenzbild (optional)</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="ai-image"
                  type="file"
                  accept="image/*"
                  className="cursor-pointer"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                />
                {imageFile && (
                  <span className="truncate text-xs text-muted-foreground">
                    {imageFile.name}
                  </span>
                )}
              </div>
            </div>

            {generating && (
              <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  KI generiert dein 3D-Modell, bitte warten…
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {Math.round(progress)} % — Technische Vorgaben werden angewendet
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            {noCredits && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                Du hast keine KI-Credits mehr. Kaufe etwas im Shop oder lade dein
                Guthaben auf.
                {setCurrentView ? (
                  <Button
                    type="button"
                    variant="link"
                    className="mt-1 h-auto p-0 text-amber-900 dark:text-amber-100"
                    onClick={() => setCurrentView("shop")}
                  >
                    Zum Shop →
                  </Button>
                ) : (
                  <Link
                    href="/?view=shop"
                    className="mt-1 block font-medium underline underline-offset-2"
                  >
                    Zum Shop →
                  </Link>
                )}
              </div>
            )}

            {generatorStatus?.demoMode && !result && (
              <AiGeneratorDemoNotice
                message="Demo-Modus: Es wird ein Beispiel-3D-Modell angezeigt, bis der API-Key konfiguriert ist."
                status={generatorStatus}
              />
            )}

            {result?.message && (
              <AiGeneratorDemoNotice
                message={result.message}
                status={generatorStatus}
              />
            )}

            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={!canGenerate}
              onClick={() => void handleGenerate()}
            >
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              3D-Modell generieren
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Live-Vorschau</h2>
          {result?.modelUrl ? (
            <Product3DPreview
              modelUrl={result.modelUrl}
              className="aspect-square w-full overflow-hidden rounded-xl border border-border/50"
            />
          ) : (
            <div
              className={cn(
                "flex aspect-square items-center justify-center rounded-xl border border-dashed border-border/60",
                "bg-muted/20 text-sm text-muted-foreground"
              )}
            >
              Noch kein Modell — starte die Generierung links.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
