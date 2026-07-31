"use client"

import {
  Printer,
  Leaf,
  CheckCircle2,
  Circle,
  Package,
  ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { FilamentColorPicker } from "@/components/dripforge/shared/filament-color-picker"
import { ProcessStepItem } from "@/components/dripforge/shared/process-step-item"
import { SiteImage } from "@/components/dripforge/editable-site-image"
import {
  SiteEditableLink,
  SiteText,
} from "@/components/dripforge/editable-site-text"
import { SiteTextPhrase } from "@/components/dripforge/site-text-phrase"
import { materials3D, processSteps } from "@/lib/dripforge/data"
import { SHOP_ROUTES } from "@/lib/dripforge/shop-routes"
import { useFilamentCatalog } from "@/hooks/use-filament-catalog"
import { findMaterialType, ratingToPercent } from "@/lib/admin/material-stats-types"

export function Page3DDruck({ 
  selectedMaterial, 
  setSelectedMaterial,
  setCurrentView,
}: { 
  selectedMaterial: string
  setSelectedMaterial: (m: string) => void
  setCurrentView: (view: string) => void
}) {
  const { materials: filamentMaterials, materialTypes } = useFilamentCatalog()
  const activeMaterial =
    filamentMaterials.find((m) => m.id === selectedMaterial) ?? filamentMaterials[0]
  const material = materials3D.find((m) => m.id === selectedMaterial) ?? materials3D[0]
  const categoryStats = findMaterialType(materialTypes, selectedMaterial)
  const displayStats = categoryStats
    ? [
        { label: "Festigkeit", value: ratingToPercent(categoryStats.strength) },
        { label: "Flexibilität", value: ratingToPercent(categoryStats.flexibility) },
        { label: "Hitzebeständigkeit", value: ratingToPercent(categoryStats.heatResistance) },
        { label: "Verarbeitung", value: categoryStats.easeOfUse },
      ]
    : activeMaterial
      ? [
          { label: "Festigkeit", value: ratingToPercent(activeMaterial.strength ?? 3) },
          { label: "Flexibilität", value: ratingToPercent(activeMaterial.flexibility ?? 3) },
          { label: "Hitzebeständigkeit", value: ratingToPercent(activeMaterial.heatResistance ?? 3) },
          { label: "Verarbeitung", value: activeMaterial.easeOfUse ?? 75 },
        ]
      : [
        { label: "Festigkeit", value: material.strength },
        { label: "Flexibilität", value: material.flexibility },
        { label: "Hitzebeständigkeit", value: material.heatResistance },
        { label: "Verarbeitung", value: material.easeOfUse },
      ]

  const configuratorHref = SHOP_ROUTES.konfigurator3d

  return (
    <div className="space-y-12 pb-12 md:space-y-24 md:pb-24">
      <section className="relative overflow-hidden py-12 md:py-20">
          <div className="absolute inset-0">
            <SiteImage
              imageKey="page_3d_druck_hero_image"
              fill
              imageClassName="object-cover opacity-15"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background via-background/90 to-background" />
          </div>
          <div className="relative mx-auto max-w-7xl px-4">
            <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/10 text-primary">
              <Printer className="mr-1 h-3 w-3" />
              <SiteText k="page_3d_hero_badge" />
            </Badge>
            <h1 className="text-4xl font-bold md:text-5xl">
              <SiteTextPhrase
                parts={[
                  { key: "page_3d_hero_title_prefix", className: "text-foreground" },
                  {
                    key: "page_3d_hero_title_highlight",
                    className:
                      "bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent",
                  },
                ]}
              />
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              <SiteText k="page_3d_hero_subtitle" />
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button
                asChild
                size="lg"
                className="bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
              >
                <SiteEditableLink
                  href={configuratorHref}
                  hrefKey="page_3d_hero_cta_primary"
                >
                  <SiteText k="page_3d_hero_cta_primary" />
                  <ArrowRight className="ml-2 h-4 w-4" />
                </SiteEditableLink>
              </Button>
              <Button variant="outline" onClick={() => setCurrentView("shop")}>
                <SiteText k="page_3d_hero_cta_secondary" />
              </Button>
            </div>
          </div>
        </section>

      {/* Premium Materials */}
      <section className="py-10 md:py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-8 text-center md:mb-12">
            <h2 className="text-3xl font-bold md:text-4xl">
              <SiteTextPhrase
                parts={[
                  { key: "page_3d_materials_heading_prefix", className: "text-foreground" },
                  {
                    key: "page_3d_materials_heading_highlight",
                    className:
                      "bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent",
                  },
                ]}
              />
            </h2>
            <p className="mt-4 text-muted-foreground">
              <SiteText k="page_3d_materials_subtitle" />
            </p>
          </div>

          {/* Material Tabs */}
          <div className="mb-8 flex justify-center">
            <div className="inline-flex flex-wrap justify-center gap-1 rounded-xl bg-secondary p-1">
              {filamentMaterials.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMaterial(m.id)}
                  className={cn(
                    "rounded-lg px-6 py-2 text-sm font-medium transition-colors",
                    selectedMaterial === m.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* Material Details */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-8">
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/20">
                    <Leaf className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">{material.name}</h3>
                    <p className="text-sm text-muted-foreground">{material.fullName}</p>
                  </div>
                </div>
                <p className="mb-8 text-muted-foreground">{material.description}</p>

                {/* Stats */}
                <div className="space-y-4">
                  {displayStats.map((stat) => (
                    <div key={stat.label}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-muted-foreground">{stat.label}</span>
                        <span>{stat.value}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400 transition-all duration-500"
                          style={{ width: `${stat.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8">
                  <p className="mb-3 text-sm font-medium text-muted-foreground">Ideal für:</p>
                  <div className="flex flex-wrap gap-2">
                    {material.bestFor.map((item) => (
                      <Badge key={item} variant="secondary">{item}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-border/50 bg-card/50">
                <CardContent className="p-6">
                  <h4 className="mb-4 font-semibold text-primary">Vorteile</h4>
                  <ul className="space-y-2">
                    {material.advantages.map((adv) => (
                      <li key={adv} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                        {adv}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50">
                <CardContent className="p-6">
                  <h4 className="mb-4 font-semibold text-primary">Hinweise</h4>
                  <ul className="space-y-2">
                    {material.considerations.map((con) => (
                      <li key={con} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
                        {con}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Color Selection per material — synced with material selector above */}
          <FilamentColorPicker
            materials={filamentMaterials}
            activeTab={selectedMaterial}
            onTabChange={setSelectedMaterial}
          />
        </div>
      </section>

      {/* Our Process */}
      <section className="py-10 md:py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-8 text-center md:mb-16">
            <h2 className="text-3xl font-bold md:text-4xl">
              <SiteTextPhrase
                parts={[
                  { key: "page_3d_process_heading_prefix", className: "text-foreground" },
                  {
                    key: "page_3d_process_heading_highlight",
                    className:
                      "bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent",
                  },
                ]}
              />
            </h2>
            <p className="mt-4 text-muted-foreground">
              <SiteText k="page_3d_process_subtitle" />
            </p>
          </div>

          {/* Timeline */}
          <div className="relative">
            <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-border md:block" />
            <div className="space-y-12">
              {processSteps.map((step, i) => (
                <ProcessStepItem key={step.number} step={step} index={i} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-10 md:py-16">
        <div className="mx-auto max-w-3xl px-4">
          <Card className="relative overflow-hidden border-cyan-500/30 bg-gradient-to-b from-card to-cyan-950/20">
            <CardContent className="p-12 text-center">
              <Package className="mx-auto mb-4 h-10 w-10 text-cyan-400" />
              <h2 className="mb-4 text-3xl font-bold">
                <SiteText k="page_3d_cta_title" />
              </h2>
              <p className="mb-8 text-muted-foreground">
                <SiteText k="page_3d_cta_subtitle" />
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button
                  asChild
                  size="lg"
                  className="bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
                >
                  <SiteEditableLink
                    href={configuratorHref}
                    hrefKey="page_3d_cta_button"
                  >
                    <SiteText k="page_3d_cta_button" />
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </SiteEditableLink>
                </Button>
                <Button size="lg" variant="outline" onClick={() => setCurrentView("kontakt")}>
                  Beratung Anfragen
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

// Laser Page
