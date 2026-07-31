"use client"

import Link from "next/link"
import {
  Zap,
  Scissors,
  Stamp,
  CheckCircle2,
  Package,
  Layers,
  ArrowRight,
  Image as ImageIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { LaserProcessStep } from "@/components/dripforge/shared/laser-process-step"
import { laserMaterials } from "@/lib/dripforge/data"
import { SHOP_ROUTES } from "@/lib/dripforge/shop-routes"
import type { ServiceVisibilitySettings } from "@/lib/admin/types"
import {
  isLaserCapabilityVisible,
  type LaserCapabilityId,
} from "@/lib/dripforge/service-visibility"
import {
  DEFAULT_MANAGED_CATALOG,
  getEnabledCustomLaserCapabilities,
  type ManagedCatalogItem,
} from "@/lib/dripforge/managed-catalog"

export function PageLaser({
  setCurrentView,
  services,
  managedCatalog,
}: {
  setCurrentView: (view: string) => void
  services: ServiceVisibilitySettings
  managedCatalog?: ManagedCatalogItem[] | null
}) {
  const configuratorHref = SHOP_ROUTES.konfiguratorLaser
  const customCapabilities = getEnabledCustomLaserCapabilities(managedCatalog)
  const catalogByBuiltin = new Map(
    (managedCatalog ?? [])
      .filter((item) => item.builtinServiceKey)
      .map((item) => [item.builtinServiceKey!, item] as const)
  )

  const builtinVisibleCount = [
    services.lasergravur,
    services.laserschnitt,
    services.markierungAetzung,
  ].filter(Boolean).length
  const totalVisible = builtinVisibleCount + customCapabilities.length

  return (
    <div className="space-y-12 pb-12 md:space-y-24 md:pb-24">
      <section className="py-12 md:py-20">
        <div className="mx-auto max-w-7xl px-4">
          <Badge variant="outline" className="mb-6 border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
            <Zap className="mr-1 h-3 w-3" />
            Präzisions-Lasertechnologie
          </Badge>
          <h1 className="text-4xl font-bold md:text-5xl">
            <span className="text-foreground">Laser </span>
            <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">Gravur & Schnitt</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Präzision trifft Kunstfertigkeit. Unsere Lasertechnologie erzeugt atemberaubende Gravuren und 
            präzise Schnitte auf Holz, Acryl, Leder und mehr.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button
              asChild
              size="lg"
              className="bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
            >
              <Link href={configuratorHref} prefetch>
                Jetzt Gravur gestalten
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setCurrentView("shop")}>
              Produkte Entdecken
            </Button>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-10 md:py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-8 text-center md:mb-12">
            <h2 className="text-3xl font-bold md:text-4xl">
              <span className="text-foreground">Unsere </span>
              <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">Möglichkeiten</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Modernste Lasertechnologie für Gravieren, Schneiden und Markieren verschiedener Materialien.
            </p>
          </div>

          <div
            className={cn(
              "grid gap-6",
              totalVisible === 1
                ? "mx-auto max-w-md md:grid-cols-1"
                : totalVisible === 2
                  ? "md:grid-cols-2"
                  : "md:grid-cols-3"
            )}
          >
            {(
              [
                {
                  serviceId: "lasergravur" as LaserCapabilityId,
                  icon: Zap,
                  iconBg: "bg-cyan-500/20",
                  iconColor: "text-cyan-400",
                  title: "Lasergravur",
                  description:
                    "Hochpräzise Gravuren, die Oberflächen dauerhaft markieren. Perfekt für Logos, Text und filigrane Designs.",
                  features: [
                    "0.1mm Präzision",
                    "Variable Tiefenkontrolle",
                    "Fotogravur möglich",
                    "Vektor- & Rastermodus",
                  ],
                },
                {
                  serviceId: "laserschnitt" as LaserCapabilityId,
                  icon: Scissors,
                  iconBg: "bg-primary/20",
                  iconColor: "text-primary",
                  title: "Laserschnitt",
                  description:
                    "Saubere, präzise Schnitte durch verschiedene Materialien mit versiegelten Kanten. Keine mechanische Belastung.",
                  features: [
                    "Saubere Kanten",
                    "Komplexe Geometrien",
                    "Keine Materialverformung",
                    "Enge Toleranzen",
                  ],
                },
                {
                  serviceId: "markierungAetzung" as LaserCapabilityId,
                  icon: Stamp,
                  iconBg: "bg-purple-500/20",
                  iconColor: "text-purple-400",
                  title: "Markierung & Ätzung",
                  description:
                    "Oberflächenmarkierung für Metalle und beschichtete Materialien. Permanente Markierungen ohne tiefe Gravur.",
                  features: [
                    "Metallmarkierung",
                    "Eloxiertes Aluminium",
                    "Lackierte Oberflächen",
                    "Hoher Kontrast",
                  ],
                },
              ] as const
            )
              .filter((cap) => isLaserCapabilityVisible(cap.serviceId, services))
              .map((cap) => {
                const catalogItem = catalogByBuiltin.get(cap.serviceId)
                const systemDefault = DEFAULT_MANAGED_CATALOG.find(
                  (item) => item.builtinServiceKey === cap.serviceId
                )
                const title =
                  catalogItem?.label?.trim() &&
                  catalogItem.label.trim() !== systemDefault?.label
                    ? catalogItem.label.trim()
                    : cap.title
                const description =
                  catalogItem?.description?.trim() &&
                  catalogItem.description.trim() !== systemDefault?.description
                    ? catalogItem.description.trim()
                    : cap.description
                return (
                  <Card key={cap.serviceId} className="border-border/50 bg-card/50">
                    <CardContent className="p-8">
                      <div
                        className={cn(
                          "mb-6 flex h-12 w-12 items-center justify-center rounded-xl",
                          cap.iconBg
                        )}
                      >
                        <cap.icon className={cn("h-6 w-6", cap.iconColor)} />
                      </div>
                      <h3 className="mb-3 text-xl font-bold">{title}</h3>
                      <p className="mb-6 text-sm text-muted-foreground">{description}</p>
                      <ul className="space-y-2">
                        {cap.features.map((f) => (
                          <li
                            key={f}
                            className="flex items-center gap-2 text-sm text-muted-foreground"
                          >
                            <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )
              })}

            {customCapabilities.map((item) => (
              <Card key={item.id} className="border-border/50 bg-card/50">
                <CardContent className="p-8">
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/20">
                    <Layers className="h-6 w-6 text-cyan-400" />
                  </div>
                  <h3 className="mb-3 text-xl font-bold">{item.label}</h3>
                  <p className="mb-6 text-sm text-muted-foreground">
                    {item.description || "Zusätzliche Laser-Dienstleistung."}
                  </p>
                  {(item.features?.length ?? 0) > 0 && (
                    <ul className="space-y-2">
                      {item.features!.map((f) => (
                        <li
                          key={f}
                          className="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Supported Materials */}
      <section className="py-10 md:py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-8 text-center md:mb-12">
            <h2 className="text-3xl font-bold md:text-4xl">
              <span className="text-foreground">Unterstützte </span>
              <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">Materialien</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Wir arbeiten mit einer breiten Palette von Materialien, jedes mit einzigartigen Möglichkeiten für Ihre Projekte.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {laserMaterials.map((mat) => (
              <Card key={mat.id} className="border-border/50 bg-card/50">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={cn("flex h-14 w-14 items-center justify-center rounded-xl text-2xl", mat.iconBg)}>
                      {mat.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="mb-1 text-lg font-bold">{mat.name}</h3>
                      <p className="mb-4 text-sm text-muted-foreground">{mat.description}</p>
                      
                      <div className="mb-4">
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Verfügbare Typen:</p>
                        <div className="flex flex-wrap gap-1">
                          {mat.types.map((t) => (
                            <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                          ))}
                        </div>
                      </div>

                      <div className="mb-4 flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <span className={cn("h-2 w-2 rounded-full", mat.canEngrave ? "bg-green-500" : "bg-red-500")} />
                          Gravur
                        </span>
                        <span className="flex items-center gap-1">
                          <span className={cn("h-2 w-2 rounded-full", mat.canCut ? "bg-green-500" : "bg-red-500")} />
                          Schnitt
                        </span>
                        {mat.maxThickness && (
                          <span className="text-muted-foreground">Max: {mat.maxThickness}</span>
                        )}
                      </div>

                      <div>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Typische Anwendungen:</p>
                        <p className="text-sm text-primary">
                          {mat.applications.join(" • ")}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Laser Process */}
      <section className="py-10 md:py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-8 text-center md:mb-12">
            <h2 className="text-3xl font-bold md:text-4xl">
              <span className="text-foreground">Wie die </span>
              <span className="bg-gradient-to-r from-cyan-400 to-primary bg-clip-text text-transparent">Lasergravur</span>
              <span className="text-foreground"> funktioniert</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Von Ihrer Idee zum fertigen gravierten Produkt — in vier einfachen Schritten.
            </p>
          </div>

          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-0 right-0 top-10 hidden h-px bg-border md:block" />

            <div className="grid gap-8 md:grid-cols-4">
              {[
                {
                  icon: ImageIcon,
                  step: "01",
                  title: "Datei hochladen",
                  desc: "Laden Sie ein Bild (PNG, SVG, JPG) hoch oder geben Sie Ihren Text ein. Vektordateien liefern die schärfsten Ergebnisse.",
                  color: "text-cyan-400",
                  bg: "bg-cyan-500/20",
                  border: "border-cyan-500/30",
                },
                {
                  icon: Layers,
                  step: "02",
                  title: "Material wählen",
                  desc: "Wählen Sie aus Holz, Acryl, Leder oder Schiefer. Jedes Material reagiert anders auf den Laserstrahl.",
                  color: "text-primary",
                  bg: "bg-primary/20",
                  border: "border-primary/30",
                },
                {
                  icon: Zap,
                  step: "03",
                  title: "Laserpräzision",
                  desc: "Unser Laser graviert mit bis zu 0.1mm Präzision. Die Intensität wird automatisch auf das gewählte Material abgestimmt.",
                  color: "text-cyan-400",
                  bg: "bg-cyan-500/20",
                  border: "border-cyan-500/30",
                },
                {
                  icon: Package,
                  step: "04",
                  title: "Versand",
                  desc: "Jedes gravierte Stück wird sorgfältig geprüft, verpackt und innert 3–5 Werktagen zu Ihnen geliefert.",
                  color: "text-primary",
                  bg: "bg-primary/20",
                  border: "border-primary/30",
                },
              ].map((item, index) => (
                <LaserProcessStep key={item.step} item={item} index={index} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* What to Expect */}
      <section className="py-10 md:py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-8 text-center md:mb-12">
            <h2 className="text-3xl font-bold md:text-4xl">
              <span className="text-foreground">Was Sie </span>
              <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">erwartet</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Sehen Sie die Qualität und Präzision unserer Laserarbeiten an verschiedenen Materialien.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              { material: "Holz", title: "Individuelle Holzschilder", description: "Handgefertigte Schilder mit präziser Lasergravur" },
              { material: "Acryl", title: "LED Edge-Lit Displays", description: "Moderne Acrylschilder mit atemberaubender Beleuchtung" },
              { material: "Leder", title: "Personalisierte Accessoires", description: "Individuelle Lederartikel mit eleganten Gravuren" },
            ].map((item) => (
              <Card key={item.material} className="overflow-hidden border-border/50 bg-card/50">
                <div className="relative flex h-48 items-center justify-center bg-secondary/50">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/20">
                    <Zap className="h-8 w-8 text-cyan-400" />
                  </div>
                  <Badge className="absolute right-4 top-4" variant="secondary">{item.material}</Badge>
                </div>
                <CardContent className="p-6">
                  <h3 className="mb-2 font-bold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-10 md:py-16">
        <div className="mx-auto max-w-3xl px-4">
          <Card className="relative overflow-hidden border-cyan-500/30 bg-gradient-to-b from-card to-cyan-950/20">
            <CardContent className="p-12 text-center">
              <Zap className="mx-auto mb-4 h-10 w-10 text-cyan-400" />
              <h2 className="mb-4 text-3xl font-bold">
                <span className="text-foreground">Individuelles Projekt im </span>
                <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">Sinn</span>
                <span className="text-foreground">?</span>
              </h2>
              <p className="mb-8 text-muted-foreground">
                Ob ein einzelnes personalisiertes Geschenk oder eine Serie von individuellen Produkten - 
                wir helfen Ihnen, Ihr Laserprojekt zum Leben zu erwecken.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button
                  asChild
                  size="lg"
                  className="bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
                >
                  <Link href={configuratorHref} prefetch>
                    Jetzt Gravur gestalten
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" onClick={() => setCurrentView("kontakt")}>
                  Individuelle Offerte Anfragen
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

// Shop Page
