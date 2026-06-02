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

export function Page3DDruck({ 
  selectedMaterial, 
  setSelectedMaterial,
  setCurrentView 
}: { 
  selectedMaterial: string
  setSelectedMaterial: (m: string) => void
  setCurrentView: (view: string) => void
}) {
  const material = materials3D.find(m => m.id === selectedMaterial) || materials3D[0]

  return (
    <div className="space-y-24 pb-24">
      {/* Hero */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0">
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/pc3-BE2inKSo4vqNzyJPw5eT2lZzb9cXDP.jpg"
            alt="3D Printer"
            fill
            className="object-cover opacity-15"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/90 to-background" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4">
          <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/10 text-primary">
            <Printer className="mr-1 h-3 w-3" />
            Additive Fertigung
          </Badge>
          <h1 className="text-4xl font-bold md:text-5xl">
            <span className="text-foreground">Präzisions </span>
            <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">3D-Druck</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Von der Konzeption zur Kreation - wir bringen Ihre Ideen mit industrietauglichem 3D-Druck 
            zum Leben. Wählen Sie aus Premium-Materialien, die auf Ihre spezifischen Bedürfnisse zugeschnitten sind.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Button 
              onClick={() => setCurrentView("shop")}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Design Hochladen
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => setCurrentView("shop")}>
              Produkte Entdecken
            </Button>
          </div>
        </div>
      </section>

      {/* Premium Materials */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">
              <span className="text-foreground">Premium </span>
              <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">Materialien</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Wählen Sie das perfekte Filament für Ihr Projekt. Jedes Material bietet einzigartige Eigenschaften für verschiedene Anwendungen.
            </p>
          </div>

          {/* Material Tabs */}
          <div className="mb-8 flex justify-center">
            <div className="inline-flex rounded-xl bg-secondary p-1">
              {materials3D.map((m) => (
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
                  {[
                    { label: "Festigkeit", value: material.strength },
                    { label: "Flexibilität", value: material.flexibility },
                    { label: "Hitzebeständigkeit", value: material.heatResistance },
                    { label: "Verarbeitung", value: material.easeOfUse },
                  ].map((stat) => (
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
            materials={materials3D} 
            activeTab={selectedMaterial}
            onTabChange={setSelectedMaterial}
          />
        </div>
      </section>

      {/* Our Process */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">
              <span className="text-foreground">Unser </span>
              <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">Prozess</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Von Ihrer Idee zum fertigen Produkt - so bringen wir Ihre Kreationen zum Leben.
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
      <section className="py-16">
        <div className="mx-auto max-w-3xl px-4">
          <Card className="relative overflow-hidden border-cyan-500/30 bg-gradient-to-b from-card to-cyan-950/20">
            <CardContent className="p-12 text-center">
              <Package className="mx-auto mb-4 h-10 w-10 text-cyan-400" />
              <h2 className="mb-4 text-3xl font-bold">
                <span className="text-foreground">Bereit Ihr Projekt zu </span>
                <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">starten</span>
                <span className="text-foreground">?</span>
              </h2>
              <p className="mb-8 text-muted-foreground">
                Laden Sie Ihr 3D-Modell hoch und erhalten Sie eine sofortige Offerte. Unser Team ist bereit, 
                Ihre Vision mit Präzision und Qualität umzusetzen.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button 
                  size="lg" 
                  onClick={() => setCurrentView("shop")}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Modell Hochladen
                  <ArrowRight className="ml-2 h-4 w-4" />
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
