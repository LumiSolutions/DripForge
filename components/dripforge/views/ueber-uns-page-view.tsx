"use client"

import type { ReactNode } from "react"
import Image from "next/image"
import { motion } from "framer-motion"
import {
  HeartHandshake,
  Mail,
  MapPin,
  Printer,
  ShieldCheck,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { DynamicContactForm } from "@/components/dripforge/dynamic-contact-form"

const SUPPORT_EMAIL = "support@dripforge.ch"

const VALUE_CARDS: Array<{
  icon: LucideIcon
  title: string
  description: string
}> = [
  {
    icon: Sparkles,
    title: "Modernste Fertigung",
    description:
      "Präziser 3D-Druck & scharfe Lasergravuren auf höchstem technischem Niveau.",
  },
  {
    icon: ShieldCheck,
    title: "Schweizer Präzision",
    description:
      "Jedes Produkt wird vor dem Versand persönlich geprüft und in der Schweiz fertiggestellt.",
  },
  {
    icon: HeartHandshake,
    title: "Individuelle Wünsche",
    description:
      "Ob Sonderfarben, Namensgravuren oder STL-Dateien – wir setzen deine Vision exakt um.",
  },
]

const CONTACT_INFO_CARDS: Array<{
  icon: LucideIcon
  title: string
  description: ReactNode
}> = [
  {
    icon: Mail,
    title: "E-Mail Support",
    description: (
      <>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          {SUPPORT_EMAIL}
        </a>
        <span className="mt-1 block text-muted-foreground">
          Antwort i.d.R. innerhalb von 24h
        </span>
      </>
    ),
  },
  {
    icon: MapPin,
    title: "Standort",
    description: "Fertigung & Versand aus der Schweiz",
  },
  {
    icon: Sparkles,
    title: "Sonderanfertigungen",
    description: "Eigene STL-Modelle oder Firmenlogos möglich",
  },
]

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
}

export function UeberUnsPageView() {
  return (
    <div className="bg-background text-foreground">
      {/* SEKTION 1: Hero */}
      <section className="relative isolate min-h-[70vh] overflow-hidden border-b border-border/40">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,oklch(0.68_0.19_35_/0.22),transparent_50%),radial-gradient(ellipse_at_80%_0%,oklch(0.7_0.12_220_/0.18),transparent_45%),linear-gradient(180deg,oklch(0.14_0_0)_0%,oklch(0.12_0_0)_55%,oklch(0.12_0_0)_100%)]" />
          <Image
            src="/images/drip-overlay.svg"
            alt=""
            width={280}
            height={340}
            className="pointer-events-none absolute -right-8 top-10 h-[55%] w-auto opacity-[0.14] md:right-[8%] md:top-6 md:h-[70%]"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
        </div>

        <div className="relative mx-auto flex min-h-[70vh] max-w-5xl flex-col items-center justify-center px-4 py-20 text-center md:py-28">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mb-5 text-sm font-semibold tracking-[0.22em] text-primary uppercase"
          >
            DripForge
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05 }}
            className="max-w-4xl text-4xl font-bold tracking-tight text-balance md:text-5xl lg:text-6xl"
          >
            Über DripForge –{" "}
            <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
              Wo Idee auf Präzision trifft
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.15 }}
            className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg"
          >
            Vom digitalen Entwurf zum perfekten Unikat. Wir verbinden modernste
            3D-Druck- & Lasergravur-Technologie mit Schweizer Qualitätsanspruch.
          </motion.p>
        </div>
      </section>

      {/* SEKTION 2: Story & Fertigung */}
      <section className="border-b border-border/40">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:gap-14 md:py-24">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="space-y-5"
          >
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Leidenschaft für High-Tech & Detail
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
              DripForge entstand aus der Begeisterung für grenzenlose kreative
              Gestaltung. Wir glauben daran, dass individuelle Produkte nicht
              nur funktional, sondern auch ästhetisch erstklassig sein müssen.
              Mit modernster additiver Fertigung (3D-Druck) und hochpräziser
              Lasergravur verwandeln wir komplexe digitale Designs in greifbare
              Realität – ob maßgeschneiderte Einzelanfertigung, Prototyp oder
              exklusive Kleinserie.
            </p>
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border/50 bg-card shadow-[0_24px_60px_-36px_rgba(0,0,0,0.65)]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-secondary to-cyan-500/20" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,oklch(0.68_0.19_35_/0.28),transparent_55%)]" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-8 text-center">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-background/40 backdrop-blur-sm">
                  <Printer className="h-7 w-7 text-primary" />
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/25 bg-background/40 backdrop-blur-sm">
                  <Zap className="h-7 w-7 text-cyan-400" />
                </div>
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">
                  Fertigung in Aktion
                </p>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                  3D-Drucker & Laser – Präzision, die man sehen und greifen
                  kann.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SEKTION 3: USPs / Werte */}
      <section className="border-b border-border/40 bg-gradient-to-b from-background via-secondary/15 to-background">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45 }}
            className="mx-auto mb-10 max-w-2xl text-center md:mb-14"
          >
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Was uns auszeichnet
            </h2>
            <p className="mt-3 text-muted-foreground">
              Technik, Qualität und individuelle Umsetzung – ohne Kompromisse.
            </p>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {VALUE_CARDS.map((card, index) => {
              const Icon = card.icon
              return (
                <motion.div
                  key={card.title}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.45, delay: index * 0.06 }}
                >
                  <Card className="h-full rounded-2xl border border-border/60 bg-card/70 transition-colors hover:border-primary/40">
                    <CardContent className="p-6 md:p-7">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/15">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold tracking-tight">
                        {card.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {card.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* SEKTION 4: Kontakt */}
      <section
        id="kontakt"
        aria-labelledby="ueber-uns-kontakt-heading"
        className="scroll-mt-24"
      >
        <div className="mx-auto max-w-6xl space-y-10 px-4 py-16 md:space-y-12 md:py-24">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45 }}
            className="mx-auto max-w-2xl text-center"
          >
            <h2
              id="ueber-uns-kontakt-heading"
              className="text-3xl font-bold tracking-tight md:text-4xl"
            >
              Kontakt & Anfragen
            </h2>
            <p className="mt-3 text-muted-foreground md:text-lg">
              Hast du eine Frage zu deiner Bestellung oder einen speziellen
              Sonderwunsch? Schreib uns direkt!
            </p>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {CONTACT_INFO_CARDS.map((card, index) => {
              const Icon = card.icon
              return (
                <motion.div
                  key={card.title}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                >
                  <Card className="h-full rounded-2xl border border-border/60 bg-card/70 transition-colors hover:border-primary/35">
                    <CardContent className="p-6">
                      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/15">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold tracking-tight">
                        {card.title}
                      </h3>
                      <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {card.description}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5 }}
          >
            <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-[0_18px_50px_-28px_rgba(0,0,0,0.55)]">
              <CardContent className="p-6 md:p-8 lg:p-10">
                <DynamicContactForm variant="polished" />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
