"use client"

import {
  Zap,
  Scissors,
  Stamp,
  CheckCircle2,
  ArrowRight,
  Layers,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  SiteEditableLink,
  SiteText,
} from "@/components/dripforge/editable-site-text"
import { SiteTextPhrase } from "@/components/dripforge/site-text-phrase"
import { EditableProcessSteps } from "@/components/dripforge/editable-process-steps"
import { EditableExpectItems } from "@/components/dripforge/editable-expect-items"
import { SHOP_ROUTES } from "@/lib/dripforge/shop-routes"
import type { ServiceVisibilitySettings } from "@/lib/admin/types"
import {
  isLaserCapabilityVisible,
  type LaserCapabilityId,
} from "@/lib/dripforge/service-visibility"
import {
  getEnabledCustomLaserCapabilities,
  DEFAULT_MANAGED_CATALOG,
  type ManagedCatalogItem,
} from "@/lib/dripforge/managed-catalog"
import { useLaserMaterialsCatalog } from "@/hooks/use-laser-materials-catalog"

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
  const { materials: laserMaterials } = useLaserMaterialsCatalog()
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
            <SiteText k="page_laser_hero_badge" />
          </Badge>
          <h1 className="text-4xl font-bold md:text-5xl">
            <SiteTextPhrase
              parts={[
                { key: "page_laser_hero_title_prefix", className: "text-foreground" },
                {
                  key: "page_laser_hero_title_highlight",
                  className:
                    "bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent",
                },
              ]}
            />
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            <SiteText k="page_laser_hero_subtitle" />
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button
              asChild
              size="lg"
              className="bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
            >
              <SiteEditableLink
                href={configuratorHref}
                hrefKey="page_laser_hero_cta_primary"
              >
                <SiteText k="page_laser_hero_cta_primary" />
                <ArrowRight className="ml-2 h-4 w-4" />
              </SiteEditableLink>
            </Button>
            <Button variant="outline" onClick={() => setCurrentView("shop")}>
              <SiteText k="page_laser_hero_cta_secondary" />
            </Button>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-10 md:py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-8 text-center md:mb-12">
            <h2 className="text-3xl font-bold md:text-4xl">
              <SiteTextPhrase
                parts={[
                  {
                    key: "page_laser_capabilities_heading_prefix",
                    className: "text-foreground",
                  },
                  {
                    key: "page_laser_capabilities_heading_highlight",
                    className:
                      "bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent",
                  },
                ]}
              />
            </h2>
            <p className="mt-4 text-muted-foreground">
              <SiteText k="page_laser_capabilities_subtitle" />
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
              <SiteTextPhrase
                parts={[
                  {
                    key: "page_laser_materials_heading_prefix",
                    className: "text-foreground",
                  },
                  {
                    key: "page_laser_materials_heading_highlight",
                    className:
                      "bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent",
                  },
                ]}
              />
            </h2>
            <p className="mt-4 text-muted-foreground">
              <SiteText k="page_laser_materials_subtitle" />
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
              <SiteTextPhrase
                parts={[
                  {
                    key: "page_laser_process_heading_prefix",
                    className: "text-foreground",
                  },
                  {
                    key: "page_laser_process_heading_highlight",
                    className:
                      "bg-gradient-to-r from-cyan-400 to-primary bg-clip-text text-transparent",
                  },
                ]}
              />
            </h2>
            <p className="mt-4 text-muted-foreground">
              <SiteText k="page_laser_process_subtitle" />
            </p>
          </div>

          <EditableProcessSteps variant="laser" />
        </div>
      </section>

      {/* What to Expect */}
      <section className="py-10 md:py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-8 text-center md:mb-12">
            <h2 className="text-3xl font-bold md:text-4xl">
              <SiteTextPhrase
                parts={[
                  {
                    key: "page_laser_expect_heading_prefix",
                    className: "text-foreground",
                  },
                  {
                    key: "page_laser_expect_heading_highlight",
                    className:
                      "bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent",
                  },
                ]}
              />
            </h2>
            <p className="mt-4 text-muted-foreground">
              <SiteText k="page_laser_expect_subtitle" />
            </p>
          </div>
          <EditableExpectItems variant="laser" />
        </div>
      </section>

      {/* CTA */}
      <section className="py-10 md:py-16">
        <div className="mx-auto max-w-3xl px-4">
          <Card className="relative overflow-hidden border-cyan-500/30 bg-gradient-to-b from-card to-cyan-950/20">
            <CardContent className="p-12 text-center">
              <Zap className="mx-auto mb-4 h-10 w-10 text-cyan-400" />
              <h2 className="mb-4 text-3xl font-bold">
                <SiteText k="page_laser_cta_title" />
              </h2>
              <p className="mb-8 text-muted-foreground">
                <SiteText k="page_laser_cta_subtitle" />
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button
                  asChild
                  size="lg"
                  className="bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
                >
                  <SiteEditableLink
                    href={configuratorHref}
                    hrefKey="page_laser_cta_button"
                  >
                    <SiteText k="page_laser_cta_button" />
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </SiteEditableLink>
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
