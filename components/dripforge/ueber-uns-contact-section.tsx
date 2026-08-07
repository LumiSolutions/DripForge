"use client"

import type { ReactNode } from "react"
import {
  Clock,
  Mail,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { DynamicContactForm } from "@/components/dripforge/dynamic-contact-form"

const SUPPORT_EMAIL = "support@dripforge.ch"

const INFO_CARDS: Array<{
  icon: LucideIcon
  title: string
  description: ReactNode
}> = [
  {
    icon: MessageCircle,
    title: "Schneller Support",
    description: (
      <>
        Antworten innerhalb von 24h & direkter E-Mail-Kontakt unter{" "}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          {SUPPORT_EMAIL}
        </a>
        .
      </>
    ),
  },
  {
    icon: ShieldCheck,
    title: "Schweizer Qualität",
    description:
      "Fertigung & Versand direkt aus der Schweiz – präzise, zuverlässig und lokal.",
  },
  {
    icon: Sparkles,
    title: "Sonderanfertigungen",
    description:
      "Individuelle 3D-Druck- & Laser-Wünsche auf Anfrage – wir machen Ideen greifbar.",
  },
]

/**
 * Dedizierte Kontaktsektion für /ueber-uns – genau einmal gerendert,
 * unabhängig von CMS-Contact-Blöcken.
 */
export function UeberUnsContactSection() {
  return (
    <section
      id="kontakt"
      aria-labelledby="ueber-uns-kontakt-heading"
      className="scroll-mt-24 border-t border-border/40 bg-gradient-to-b from-background via-secondary/20 to-background"
    >
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-14 md:space-y-12 md:py-20">
        {/* Info-Karten oberhalb des Formulars */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {INFO_CARDS.map((card) => {
            const Icon = card.icon
            return (
              <Card
                key={card.title}
                className="rounded-2xl border border-border/60 bg-card/70 shadow-sm transition-colors hover:border-primary/35"
              >
                <CardContent className="p-6">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/15">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {card.description}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-[0_18px_50px_-28px_rgba(0,0,0,0.55)] backdrop-blur-sm">
          <CardContent className="p-0">
            <div className="grid gap-0 lg:grid-cols-2">
              {/* Linke Spalte: Kontaktdaten */}
              <aside className="relative flex flex-col justify-center gap-8 border-b border-border/50 bg-gradient-to-br from-primary/12 via-card/40 to-transparent p-8 md:p-10 lg:border-b-0 lg:border-r lg:border-border/50">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,oklch(0.62_0.19_35_/0.12),transparent_55%)]" />
                <div className="relative space-y-4">
                  <h2
                    id="ueber-uns-kontakt-heading"
                    className="text-2xl font-bold tracking-tight md:text-3xl"
                  >
                    Nehmen Sie Kontakt auf
                  </h2>
                  <p className="max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
                    Fragen, Sonderwünsche oder Projektideen? Schreib uns – wir
                    melden uns persönlich und unkompliziert.
                  </p>
                </div>

                <ul className="relative space-y-5">
                  <li className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/15">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        E-Mail
                      </p>
                      <a
                        href={`mailto:${SUPPORT_EMAIL}`}
                        className="font-medium text-foreground transition-colors hover:text-primary"
                      >
                        {SUPPORT_EMAIL}
                      </a>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/15">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Reaktionszeit
                      </p>
                      <p className="font-medium text-foreground">
                        Antwort innerhalb von 24h
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/15">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Standort
                      </p>
                      <p className="font-medium text-foreground">Schweiz</p>
                    </div>
                  </li>
                </ul>
              </aside>

              {/* Rechte Spalte: Formular */}
              <div className="p-8 md:p-10">
                <DynamicContactForm variant="polished" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
