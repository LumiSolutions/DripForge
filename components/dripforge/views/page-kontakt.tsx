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

export function PageKontakt({ setCurrentView }: { setCurrentView: (view: string) => void }) {
  const [inquiryType, setInquiryType] = useState("")

  return (
    <div className="py-16">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-12 text-center">
          <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/10 text-primary">
            <MessageSquare className="mr-1 h-3 w-3" />
            Kontakt aufnehmen
          </Badge>
          <h1 className="text-4xl font-bold md:text-5xl">
            <span className="text-foreground">Kontaktieren Sie </span>
            <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">DripForge</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Haben Sie ein individuelles Projekt im Sinn? Fragen zu unseren Services? 
            Wir freuen uns von Ihnen zu hören.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-8">
                <h2 className="mb-6 text-xl font-bold">Nachricht Senden</h2>
                <form className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name <span className="text-red-500">*</span></Label>
                      <Input id="name" placeholder="Ihr Name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-Mail <span className="text-red-500">*</span></Label>
                      <Input id="email" type="email" placeholder="ihre@email.com" />
                    </div>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="company">Firma (optional)</Label>
                      <Input id="company" placeholder="Ihre Firma" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">Anfrage-Typ <span className="text-red-500">*</span></Label>
                      <Select value={inquiryType} onValueChange={setInquiryType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Typ auswählen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3d">3D-Druck Anfrage</SelectItem>
                          <SelectItem value="laser">Lasergravur Anfrage</SelectItem>
                          <SelectItem value="general">Allgemeine Frage</SelectItem>
                          <SelectItem value="quote">Offerte anfordern</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Betreff <span className="text-red-500">*</span></Label>
                    <Input id="subject" placeholder="Kurzer Betreff Ihrer Anfrage" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">Nachricht <span className="text-red-500">*</span></Label>
                    <Textarea 
                      id="message" 
                      placeholder="Erzählen Sie uns von Ihrem Projekt oder Ihrer Frage..." 
                      rows={5}
                    />
                  </div>
                  <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
                    Nachricht Senden
                    <Send className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Contact Info Sidebar */}
          <div className="space-y-6">
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-6">
                <h3 className="mb-4 font-bold">Kontaktinformationen</h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">E-Mail</p>
                      <p className="font-medium">drip-forge@outlook.com</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/20">
                      <MapPin className="h-5 w-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Standort</p>
                      <p className="font-medium">Schweiz</p>
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-6">
                <h3 className="mb-4 font-bold">Schnelle Hilfe</h3>
                <p className="mb-4 text-sm text-muted-foreground">Suchen Sie nach etwas Bestimmtem?</p>
                <ul className="space-y-2">
                  {[
                    { label: "Mehr über 3D-Druck erfahren", view: "3d-druck" },
                    { label: "Mehr über Lasergravur erfahren", view: "laser" },
                    { label: "3D-Modell hochladen", view: "shop" },
                    { label: "Shop durchstöbern", view: "shop" },
                  ].map((link) => (
                    <li key={link.label}>
                      <button 
                        onClick={() => setCurrentView(link.view)}
                        className="text-sm text-primary hover:underline"
                      >
                        {link.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-primary" />
                  <div>
                    <h4 className="font-bold">Antwortzeit</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Wir antworten in der Regel innerhalb von 24 Stunden an Werktagen. 
                      Für dringende Anfragen rufen Sie uns bitte direkt an.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

// FAQ Page
