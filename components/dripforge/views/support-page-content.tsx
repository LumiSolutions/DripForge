"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  CheckCircle2,
  CreditCard,
  Heart,
  Loader2,
  MapPin,
  Package,
  Printer,
  Sparkles,
  Zap,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  milestoneIdToCategory,
  SUPPORT_CATEGORIES,
  type SupportCategoryId,
  type SupportMilestone,
} from "@/lib/support/types"

const PRESET_AMOUNTS = [20, 50, 100] as const

const MILESTONE_ICONS = {
  materials: Package,
  printer: Printer,
  laser: Zap,
} as const

function formatChf(value: number): string {
  return value.toLocaleString("de-CH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

export function SupportPageContent({
  initialSuccess,
  initialCanceled,
}: {
  initialSuccess?: boolean
  initialCanceled?: boolean
}) {
  const [milestones, setMilestones] = useState<SupportMilestone[]>([])
  const [totalRaisedChf, setTotalRaisedChf] = useState(0)
  const [loadingMilestones, setLoadingMilestones] = useState(true)
  const [stripeConfigured, setStripeConfigured] = useState<boolean | null>(null)

  const [selectedAmount, setSelectedAmount] = useState<number>(50)
  const [customAmount, setCustomAmount] = useState("")
  const [useCustomAmount, setUseCustomAmount] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(Boolean(initialSuccess))
  const [showCanceled, setShowCanceled] = useState(Boolean(initialCanceled))
  const [category, setCategory] = useState<SupportCategoryId>("general")
  const [highlightCategory, setHighlightCategory] = useState(false)
  const formSectionRef = useRef<HTMLElement>(null)

  const effectiveAmount = useMemo(() => {
    if (useCustomAmount) {
      const parsed = Number(customAmount.replace(",", "."))
      return Number.isFinite(parsed) ? parsed : 0
    }
    return selectedAmount
  }, [customAmount, selectedAmount, useCustomAmount])

  const loadMilestones = useCallback(async () => {
    setLoadingMilestones(true)
    try {
      const res = await fetch("/api/support/milestones", { cache: "no-store" })
      const data = await res.json()
      if (Array.isArray(data.milestones)) {
        setMilestones(data.milestones as SupportMilestone[])
      }
      if (typeof data.totalRaisedChf === "number") {
        setTotalRaisedChf(data.totalRaisedChf)
      }
    } catch {
      console.warn("Support: Meilensteine konnten nicht geladen werden.")
    } finally {
      setLoadingMilestones(false)
    }
  }, [])

  useEffect(() => {
    void loadMilestones()
    void fetch("/api/support/checkout", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setStripeConfigured(Boolean(data?.configured)))
      .catch(() => setStripeConfigured(false))
  }, [loadMilestones])

  const scrollToFormWithCategory = useCallback((milestoneId: string) => {
    setCategory(milestoneIdToCategory(milestoneId))
    setHighlightCategory(true)
    formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    window.setTimeout(() => setHighlightCategory(false), 2200)
  }, [])

  const startCheckout = async () => {
    setSubmitting(true)
    setError(null)
    setShowCanceled(false)

    try {
      const res = await fetch("/api/support/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountChf: effectiveAmount,
          name,
          email,
          category,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? "Checkout konnte nicht gestartet werden.")
      }
      if (!data.url) {
        throw new Error("Keine Checkout-URL erhalten.")
      }
      window.location.href = data.url as string
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Checkout konnte nicht gestartet werden."
      )
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-20 pb-24 pt-12">
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-primary/20 blur-3xl cs-glow-orange" />
        <div className="pointer-events-none absolute -right-16 top-24 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl cs-glow-blue" />
        <div className="relative mx-auto max-w-4xl px-4 text-center">
          <Badge
            variant="outline"
            className="mb-6 border-primary/30 bg-primary/10 text-primary"
          >
            <Heart className="mr-1 h-3 w-3" />
            Support our Journey
          </Badge>
          <h1 className="text-4xl font-bold leading-tight md:text-5xl">
            <span className="text-foreground">Gemeinsam bauen wir </span>
            <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
              die Manufaktur von morgen
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground">
            In Pfäffikon ZH entsteht Schritt für Schritt eine moderne Manufaktur für
            präzisen 3D-Druck und feine Lasergravur. Was als Vision begann, wächst dank
            eurer Unterstützung zu echter Produktionskapazität — mit neuen Druckern,
            erweiterten Materialien und professioneller Laser-Infrastruktur.
          </p>
          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-2 text-sm text-muted-foreground backdrop-blur-sm">
            <MapPin className="h-4 w-4 text-primary" />
            Pfäffikon ZH · Schweizer Präzision · Community-powered
          </div>
        </div>
      </section>

      {showSuccess && (
        <div className="mx-auto max-w-3xl px-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-5 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
            <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
              Vielen Dank für deine Unterstützung!
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Dein Beitrag hilft uns, DripForge weiter auszubauen. Goodies und Status-Updates
              folgen automatisch über dein Kundenportal.
            </p>
          </div>
        </div>
      )}

      {showCanceled && (
        <div className="mx-auto max-w-3xl px-4">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-6 py-4 text-center text-sm text-amber-800 dark:text-amber-200">
            Die Zahlung wurde abgebrochen. Du kannst jederzeit erneut unterstützen.
          </div>
        </div>
      )}

      <section className="mx-auto max-w-5xl px-4">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold">Unsere nächsten Meilensteine</h2>
          <p className="mt-3 text-muted-foreground">
            {loadingMilestones
              ? "Fortschritt wird geladen…"
              : `Bisher gesammelt: CHF ${formatChf(totalRaisedChf)}`}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {milestones.map((milestone) => {
            const Icon =
              MILESTONE_ICONS[milestone.id as keyof typeof MILESTONE_ICONS] ?? Sparkles
            return (
              <button
                key={milestone.id}
                type="button"
                onClick={() => scrollToFormWithCategory(milestone.id)}
                className="text-left"
              >
              <Card
                className={cn(
                  "border-border/50 bg-card/60 backdrop-blur-sm transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5",
                  milestone.completed && "border-emerald-500/40 bg-emerald-500/5",
                  !milestone.unlocked && "opacity-70",
                  "cursor-pointer"
                )}
              >
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="rounded-xl bg-primary/10 p-3 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    {milestone.completed && (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                        Erreicht
                      </Badge>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold leading-snug">{milestone.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {milestone.description}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        CHF {formatChf(milestone.raisedChf)} / {formatChf(milestone.goalChf)}
                      </span>
                      <span>{milestone.progressPercent}%</span>
                    </div>
                    <Progress
                      value={milestone.progressPercent}
                      className="h-2.5 bg-secondary"
                    />
                  </div>
                </CardContent>
              </Card>
              </button>
            )
          })}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Tipp: Klicke auf eine Meilenstein-Karte, um sie im Formular vorzuwählen.
        </p>
      </section>

      <section
        ref={formSectionRef}
        id="support-form"
        className="mx-auto max-w-2xl scroll-mt-24 px-4"
      >
        <Card className="overflow-hidden border-border/50 bg-card/70 backdrop-blur-md">
          <CardContent className="space-y-6 p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Jetzt unterstützen</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Wähle einen Betrag und bezahle sicher per TWINT oder Kreditkarte über Stripe.
              </p>
            </div>

            <div
              className={cn(
                "space-y-2 rounded-xl transition-shadow",
                highlightCategory && "ring-2 ring-primary/50 ring-offset-2 ring-offset-background"
              )}
            >
              <Label htmlFor="support-category">Wofür möchtest du spenden?</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as SupportCategoryId)}
              >
                <SelectTrigger id="support-category" className="w-full">
                  <SelectValue placeholder="Kategorie wählen" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORT_CATEGORIES.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {PRESET_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => {
                    setUseCustomAmount(false)
                    setSelectedAmount(amount)
                  }}
                  className={cn(
                    "rounded-xl border px-4 py-4 text-center transition-colors",
                    !useCustomAmount && selectedAmount === amount
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border/60 hover:border-primary/40"
                  )}
                >
                  <span className="block text-xl font-bold">{amount}</span>
                  <span className="text-xs text-muted-foreground">CHF</span>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom-amount">Wunschbetrag (CHF)</Label>
              <Input
                id="custom-amount"
                type="number"
                min={5}
                step={1}
                placeholder="z. B. 75"
                value={customAmount}
                onChange={(e) => {
                  setUseCustomAmount(true)
                  setCustomAmount(e.target.value)
                }}
                onFocus={() => setUseCustomAmount(true)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="supporter-name">Name</Label>
                <Input
                  id="supporter-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dein Name"
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supporter-email">E-Mail</Label>
                <Input
                  id="supporter-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@beispiel.ch"
                  autoComplete="email"
                />
              </div>
            </div>

            {stripeConfigured === false && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                Stripe ist noch nicht konfiguriert. Hinterlege STRIPE_SECRET_KEY und
                STRIPE_WEBHOOK_SECRET in der Umgebung, um Zahlungen zu aktivieren.
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={submitting || stripeConfigured === false}
              onClick={() => void startCheckout()}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              CHF {effectiveAmount > 0 ? effectiveAmount.toFixed(0) : "—"} unterstützen
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Sichere Zahlung via Stripe · TWINT &amp; Kreditkarte · Spenden sind freiwillig
              und nicht erstattungsfähig.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
