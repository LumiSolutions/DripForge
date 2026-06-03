"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
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

export function HomePage({
  setCurrentView,
  services,
}: {
  setCurrentView: (view: string) => void
  services: ServiceVisibilitySettings
}) {
  const showExpertise = services.druck3d || services.lasergravur
  return (
    <div className="space-y-24 pb-24">
      {/* Hero */}
      <section className="relative overflow-hidden py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/10 text-primary">
                <Sparkles className="mr-1 h-3 w-3" />
                Schweizer Präzision
              </Badge>
              <h1 className="text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
                <span className="text-foreground">Präzision trifft </span>
                <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">Kreativität</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground">
                Von der Idee zur Realität - wir bringen Ihre Visionen mit industriellem 3D-Druck und 
                Lasergravur zum Leben. Schweizer Qualität für Ihre individuellen Projekte.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Button 
                  size="lg" 
                  onClick={() => setCurrentView("shop")}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Jetzt Erstellen
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => setCurrentView("shop")}>
                  Produkte Entdecken
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="relative aspect-square">
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%2017.%20Mai%202026%2C%2022_30_40-QRFbP2eouxkeDTfBuUpwhiWA8fn1Ng.png"
                  alt="DripForge"
                  fill
                  className="animate-float object-contain"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Expertise */}
      {showExpertise && (
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">
              <span className="text-foreground">Unsere </span>
              <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">Expertise</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              {services.druck3d && services.lasergravur
                ? "Zwei leistungsstarke Fertigungstechnologien, ein Premium-Erlebnis."
                : "Präzise Fertigung für Ihre individuellen Projekte."}
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
                    <h3 className="mb-2 text-xl font-bold">3D-Druck</h3>
                    <p className="mb-6 text-sm text-muted-foreground">
                      Präzise additive Fertigung mit Premium-Filamenten. Von Prototypen bis zu fertigen Produkten.
                    </p>
                    <button 
                      onClick={() => setCurrentView("3d-druck")}
                      className="inline-flex items-center text-sm font-medium text-foreground hover:text-primary"
                    >
                      Mehr erfahren
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </button>
                  </div>
                  <div className="relative ml-4 h-40 w-40 opacity-50">
                    <Image
                      src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%2017.%20Mai%202026%2C%2000_02_54-d7wTZgFb3k2tGqbkACQpqJbzNVYTwR.png"
                      alt="3D Printer"
                      fill
                      className="object-contain"
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
                    <h3 className="mb-2 text-xl font-bold">Lasergravur</h3>
                    <p className="mb-6 text-sm text-muted-foreground">
                      Hochpräzises Laserschneiden und Gravieren auf Holz, Acryl, Leder und mehr.
                    </p>
                    <button 
                      onClick={() => setCurrentView("laser")}
                      className="inline-flex items-center text-sm font-medium text-foreground hover:text-primary"
                    >
                      Mehr erfahren
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </button>
                  </div>
                  <div className="relative ml-4 h-40 w-40 opacity-50">
                    <Image
                      src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%2017.%20Mai%202026%2C%2000_02_54-d7wTZgFb3k2tGqbkACQpqJbzNVYTwR.png"
                      alt="Laser Engraver"
                      fill
                      className="object-contain"
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

      {/* Why Choose DripForge */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">
              <span className="text-foreground">Warum </span>
              <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">DripForge</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Wir verbinden modernste Technologie mit Handwerkskunst für aussergewöhnliche Ergebnisse.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-4">
            {[
              { icon: Gem, title: "Premium Qualität", description: "Industrietaugliche Materialien und Präzisionsfertigung für langlebige Ergebnisse." },
              { icon: Timer, title: "Schnelle Lieferung", description: "Schnelle Produktionszeiten ohne Kompromisse bei Qualität oder Detail." },
              { icon: Sparkles, title: "Individuelle Kreationen", description: "Von Ihrer Idee zur Realität - voll personalisierte Produkte." },
              { icon: Layers, title: "Vielfältige Materialien", description: "PLA, PETG, ASA, Holz, Acryl, Leder und mehr." },
            ].map((feature, i) => (
              <Card key={i} className="border-border/50 bg-card/50">
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
                  <h3 className="mb-2 font-bold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="mx-auto max-w-3xl px-4">
          <Card className="relative overflow-hidden border-cyan-500/30 bg-gradient-to-b from-card to-cyan-950/20">
            <CardContent className="p-12 text-center">
              <Package className="mx-auto mb-4 h-10 w-10 text-cyan-400" />
              <h2 className="mb-4 text-3xl font-bold">
                <span className="text-foreground">Bereit zum </span>
                <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">Erstellen</span>
                <span className="text-foreground">?</span>
              </h2>
              <p className="mb-8 text-muted-foreground">
                Laden Sie Ihr 3D-Modell hoch oder wählen Sie aus unserer Kollektion. Lassen Sie uns Ihre Vision 
                mit Präzision und Qualität zum Leben erwecken.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button 
                  size="lg" 
                  onClick={() => setCurrentView("shop")}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  3D-Datei Hochladen
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => setCurrentView("kontakt")}>
                  Beratung Anfragen
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                  Kostenlose Offerte
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                  Schneller Versand
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                  Qualitätsgarantie
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
