"use client"

import { Clock, Mail, MapPin } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { DynamicContactForm } from "@/components/dripforge/dynamic-contact-form"

const SUPPORT_EMAIL = "support@dripforge.ch"

/**
 * Dedizierte Kontaktsektion für /ueber-uns – genau einmal gerendert,
 * unabhängig von CMS-Contact-Blöcken.
 */
export function UeberUnsContactSection() {
  return (
    <section
      id="kontakt"
      aria-labelledby="ueber-uns-kontakt-heading"
      className="border-t border-border/40 bg-gradient-to-b from-background via-secondary/20 to-background"
    >
      <div className="mx-auto max-w-6xl px-4 py-14 md:py-20">
        <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-[0_18px_50px_-28px_rgba(0,0,0,0.55)] backdrop-blur-sm">
          <CardContent className="p-0">
            <div className="grid gap-0 lg:grid-cols-2">
              {/* Linke Spalte: Kontaktdaten */}
              <aside className="relative flex flex-col justify-center gap-8 border-b border-border/50 bg-gradient-to-br from-primary/12 via-card/40 to-transparent p-8 md:p-10 lg:border-b-0 lg:border-r lg:border-border/50">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,oklch(0.62_0.19_35_/0.12),transparent_55%)] pointer-events-none" />
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
