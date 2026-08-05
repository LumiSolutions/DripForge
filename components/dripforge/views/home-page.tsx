"use client"

import { useState, useRef, useEffect } from "react"
import {
  Home,
  Printer,
  Zap,
  ShoppingBag,
  MessageSquare,
  Menu,
  X,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  Leaf,
  Scissors,
  Stamp,
  CheckCircle2,
  Circle,
  Sparkles,
  Package,
  Timer,
  Gem,
  Layers,
  ArrowRight,
  MessageCircle,
  User,
  Bot,
  Upload,
  Box,
  RotateCcw,
  ZoomIn,
  Minus,
  Plus,
  ShoppingCart,
  Image as ImageIcon,
  Tag,
  Search,
  Moon,
  Sun,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { FilamentColorPicker } from "@/components/dripforge/shared/filament-color-picker"
import { ProcessStepItem } from "@/components/dripforge/shared/process-step-item"
import { LaserProcessStep } from "@/components/dripforge/shared/laser-process-step"
import { IndividualProcessBar } from "@/components/dripforge/shared/individual-process-bar"
import { materials3D, laserMaterials, processSteps, products } from "@/lib/dripforge/data"
import type { CartItem } from "@/lib/dripforge/types"
import type { ServiceVisibilitySettings } from "@/lib/admin/types"
import {
  SiteEditableLink,
  SiteText,
} from "@/components/dripforge/editable-site-text"
import { SiteImage } from "@/components/dripforge/editable-site-image"
import { SafeProductImage } from "@/components/dripforge/shared/safe-product-image"
import { useBranding } from "@/hooks/use-branding"

const HERO_IMAGE_SIZES = "(max-width: 1024px) 100vw, 50vw"
const EXPERTISE_IMAGE_SIZES = "160px"

/**
 * Hero-Bild: Haupt-/Branding-Logo (Slot 2) falls hochgeladen, sonst das
 * bisherige CMS-Hero-Bild.
 */
function HomeHeroBrandImage() {
  const { brandLogoUrl } = useBranding()
  if (brandLogoUrl) {
    return (
      <SafeProductImage
        src={brandLogoUrl}
        alt="DripForge"
        fill
        priority
        quality={75}
        sizes={HERO_IMAGE_SIZES}
        className="animate-float object-contain"
      />
    )
  }
  return (
    <SiteImage
      imageKey="landingpage_hero_image"
      fill
      imageClassName="animate-float object-contain"
      priority
      sizes={HERO_IMAGE_SIZES}
    />
  )
}
import { SiteTextPhrase } from "@/components/dripforge/site-text-phrase"
import { useAiPublicSettings } from "@/hooks/use-ai-public-settings"
import { SHOP_ROUTES } from "@/lib/dripforge/shop-routes"
import { HomeTopProductsSection } from "@/components/dripforge/views/home-top-products-section"

export function HomePage({
  setCurrentView,
  services,
}: {
  setCurrentView: (view: string) => void
  services: ServiceVisibilitySettings
}) {
  const aiPublic = useAiPublicSettings()
  const showExpertise = services.druck3d || services.lasergravur
  const showAiKonfigurator = services.druck3d && aiPublic.enabled
  return (
    <div className="space-y-12 pb-12 md:space-y-24 md:pb-24">
      {/* Hero */}
      <section className="relative overflow-hidden py-12 md:py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col-reverse items-center gap-8 lg:flex-row lg:items-center lg:gap-12">
            <div className="w-full lg:w-1/2">
              <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/10 text-primary">
                <Sparkles className="mr-1 h-3 w-3" />
                <SiteText k="landingpage_hero_badge" />
              </Badge>
              <h1 className="text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
                <SiteTextPhrase
                  parts={[
                    { key: "landingpage_hero_title", className: "text-foreground" },
                    {
                      key: "landingpage_hero_title_highlight",
                      className:
                        "bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent",
                    },
                  ]}
                />
              </h1>
              <p className="mt-6 text-lg text-muted-foreground">
                <SiteText k="landingpage_hero_subtitle" />
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button 
                  size="lg" 
                  asChild
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <SiteEditableLink
                    href={SHOP_ROUTES.shop}
                    hrefKey="landingpage_hero_cta_primary"
                  >
                    <SiteText k="landingpage_hero_cta_primary" />
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </SiteEditableLink>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <SiteEditableLink
                    href={SHOP_ROUTES.shop}
                    hrefKey="landingpage_hero_cta_secondary"
                  >
                    <SiteText k="landingpage_hero_cta_secondary" />
                  </SiteEditableLink>
                </Button>
              </div>
            </div>
            <div className="relative w-full lg:w-1/2">
              <div className="relative aspect-square">
                <HomeHeroBrandImage />
              </div>
            </div>
          </div>
        </div>
      </section>

      <HomeTopProductsSection />

      {/* Our Expertise */}
      {showExpertise && (
      <section className="py-10 md:py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-8 text-center md:mb-12">
            <h2 className="text-3xl font-bold md:text-4xl">
              <SiteTextPhrase
                parts={[
                  { key: "landingpage_expertise_prefix", className: "text-foreground" },
                  {
                    key: "landingpage_expertise_heading",
                    className:
                      "bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent",
                  },
                ]}
              />
            </h2>
            <p className="mt-4 text-muted-foreground">
              {services.druck3d && services.lasergravur ? (
                <SiteText k="landingpage_expertise_subtitle_both" />
              ) : (
                <SiteText k="landingpage_expertise_subtitle_single" />
              )}
            </p>
          </div>

          <div
            className={cn(
              "grid gap-6",
              services.druck3d && services.lasergravur
                ? "md:grid-cols-2"
                : "mx-auto max-w-xl md:grid-cols-1"
            )}
          >
            {services.druck3d && (
            <Card className="group relative overflow-hidden border-border/50 bg-card/50">
              <CardContent className="relative p-8">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
                      <Printer className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mb-2 text-xl font-bold"><SiteText k="landingpage_expertise_3d_title" /></h3>
                    <p className="mb-6 text-sm text-muted-foreground">
                      <SiteText k="landingpage_expertise_3d_description" />
                    </p>
                    <SiteEditableLink
                      href={SHOP_ROUTES["3d-druck"]}
                      hrefKey="landingpage_expertise_3d_cta"
                      className="inline-flex items-center text-sm font-medium text-foreground hover:text-primary"
                    >
                      <SiteText k="landingpage_expertise_3d_cta" />
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </SiteEditableLink>
                  </div>
                  <div className="relative ml-4 h-40 w-40 opacity-50">
                    <SiteImage
                      imageKey="landingpage_expertise_3d_image"
                      fill
                      sizes={EXPERTISE_IMAGE_SIZES}
                      imageClassName="object-contain"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            )}

            {services.lasergravur && (
            <Card className="group relative overflow-hidden border-border/50 bg-card/50">
              <CardContent className="relative p-8">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/20">
                      <Zap className="h-6 w-6 text-cyan-400" />
                    </div>
                    <h3 className="mb-2 text-xl font-bold"><SiteText k="landingpage_expertise_laser_title" /></h3>
                    <p className="mb-6 text-sm text-muted-foreground">
                      <SiteText k="landingpage_expertise_laser_description" />
                    </p>
                    <SiteEditableLink
                      href={SHOP_ROUTES.laser}
                      hrefKey="landingpage_expertise_laser_cta"
                      className="inline-flex items-center text-sm font-medium text-foreground hover:text-primary"
                    >
                      <SiteText k="landingpage_expertise_laser_cta" />
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </SiteEditableLink>
                  </div>
                  <div className="relative ml-4 h-40 w-40 opacity-50">
                    <SiteImage
                      imageKey="landingpage_expertise_laser_image"
                      fill
                      sizes={EXPERTISE_IMAGE_SIZES}
                      imageClassName="object-contain"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            )}
          </div>
        </div>
      </section>
      )}

      {showAiKonfigurator && (
      <section className="py-8">
        <div className="mx-auto max-w-7xl px-4">
          <Card className="border-violet-500/30 bg-gradient-to-r from-card to-violet-950/20">
            <CardContent className="flex flex-col items-start gap-6 p-8 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/20">
                  <Sparkles className="h-6 w-6 text-violet-400" />
                </div>
                <h2 className="text-2xl font-bold"><SiteText k="landingpage_ai_title" /></h2>
                <p className="mt-2 max-w-xl text-muted-foreground">
                  <SiteText k="landingpage_ai_description" />
                </p>
              </div>
              <Button
                size="lg"
                asChild
                className="bg-violet-600 text-white hover:bg-violet-500"
              >
                <SiteEditableLink
                  href={SHOP_ROUTES.aiKonfigurator}
                  hrefKey="landingpage_ai_cta"
                >
                  <SiteText k="landingpage_ai_cta" />
                  <ArrowRight className="ml-2 h-4 w-4" />
                </SiteEditableLink>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
      )}

      {/* Why Choose DripForge */}
      <section className="py-10 md:py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-8 text-center md:mb-12">
            <h2 className="text-3xl font-bold md:text-4xl">
              <SiteTextPhrase
                parts={[
                  { key: "landingpage_why_prefix", className: "text-foreground" },
                  {
                    key: "landingpage_why_heading",
                    className:
                      "bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent",
                  },
                ]}
              />
            </h2>
            <p className="mt-4 text-muted-foreground">
              <SiteText k="landingpage_why_subtitle" />
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-4">
            {[
              { icon: Gem, titleKey: "landingpage_feature_1_title" as const, descKey: "landingpage_feature_1_description" as const },
              { icon: Timer, titleKey: "landingpage_feature_2_title" as const, descKey: "landingpage_feature_2_description" as const },
              { icon: Sparkles, titleKey: "landingpage_feature_3_title" as const, descKey: "landingpage_feature_3_description" as const },
              { icon: Layers, titleKey: "landingpage_feature_4_title" as const, descKey: "landingpage_feature_4_description" as const },
            ].map((feature, i) => (
              <Card key={feature.titleKey} className="border-border/50 bg-card/50">
                <CardContent className="p-6">
                  <div className={cn(
                    "mb-4 flex h-12 w-12 items-center justify-center rounded-xl",
                    i === 0 ? "bg-primary/20" : i === 1 ? "bg-cyan-500/20" : i === 2 ? "bg-green-500/20" : "bg-purple-500/20"
                  )}>
                    <feature.icon className={cn(
                      "h-6 w-6",
                      i === 0 ? "text-primary" : i === 1 ? "text-cyan-400" : i === 2 ? "text-green-400" : "text-purple-400"
                    )} />
                  </div>
                  <h3 className="mb-2 font-bold"><SiteText k={feature.titleKey} /></h3>
                  <p className="text-sm text-muted-foreground"><SiteText k={feature.descKey} /></p>
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
            <CardContent className="p-8 text-center md:p-12">
              <Package className="mx-auto mb-4 h-10 w-10 text-cyan-400" />
              <h2 className="mb-4 text-3xl font-bold">
                <SiteTextPhrase
                  parts={[
                    { key: "landingpage_cta_title_prefix", className: "text-foreground" },
                    {
                      key: "landingpage_cta_title",
                      className:
                        "bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent",
                    },
                  ]}
                />
                <span className="text-foreground">?</span>
              </h2>
              <p className="mb-8 text-muted-foreground">
                <SiteText k="landingpage_cta_subtitle" />
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button 
                  size="lg" 
                  asChild
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <SiteEditableLink
                    href={SHOP_ROUTES.shop}
                    hrefKey="landingpage_cta_button_upload"
                  >
                    <SiteText k="landingpage_cta_button_upload" />
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </SiteEditableLink>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <SiteEditableLink
                    href={SHOP_ROUTES.kontakt}
                    hrefKey="landingpage_cta_button_contact"
                  >
                    <SiteText k="landingpage_cta_button_contact" />
                  </SiteEditableLink>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                  <SiteText k="landingpage_trust_offer" />
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                  <SiteText k="landingpage_trust_shipping" />
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                  <SiteText k="landingpage_trust_quality" />
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

// 3D Printing Page
