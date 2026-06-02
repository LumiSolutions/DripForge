"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

function ImpressumSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-foreground md:text-xl">{title}</h2>
      <div className="space-y-2 text-[0.9375rem] leading-relaxed text-muted-foreground md:text-base">
        {children}
      </div>
    </section>
  )
}

export function ImpressumPageContent() {
  return (
    <div className="space-y-12 py-8">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <Badge variant="secondary" className="mb-4">
          Rechtliches
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          <span className="text-foreground">Imp</span>
          <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
            ress
          </span>
          <span className="text-foreground">um</span>
        </h1>
      </div>

      <div className="mx-auto max-w-3xl px-4">
        <Card className="border-border/50 bg-card/50 shadow-sm dark:border-border/60 dark:bg-card/90">
          <CardContent className="space-y-10 p-8 md:p-10">
            <ImpressumSection title="Unternehmensidentifikation">
              <p className="font-medium text-foreground">DripForge</p>
              <p>Robin Schulz</p>
              <p>Mattenstrasse 7</p>
              <p>8330 Pfäffikon ZH</p>
              <p>Schweiz</p>
            </ImpressumSection>

            <ImpressumSection title="Kontaktmöglichkeit">
              <p>
                E-Mail:{" "}
                <a
                  href="mailto:drip-forge@outlook.com"
                  className="text-primary transition-colors hover:text-primary/80"
                >
                  drip-forge@outlook.com
                </a>
              </p>
              <p>Kontaktformular: Über unsere Website</p>
            </ImpressumSection>

            <ImpressumSection title="Handelsregister & Mehrwertsteuer">
              <p>
                Handelsregister: Nicht eingetragen (Einzelunternehmen in
                Gründungsphase / Kleinunternehmen)
              </p>
              <p>Mehrwertsteuer-Nummer: Nicht MWST-pflichtig</p>
            </ImpressumSection>

            <ImpressumSection title="Haftungsausschluss">
              <p>
                Der Autor übernimmt keinerlei Gewähr hinsichtlich der inhaltlichen
                Richtigkeit, Genauigkeit, Aktualität, Zuverlässigkeit und
                Vollständigkeit der Informationen. Haftungsansprüche gegen den
                Autor wegen Schäden materieller oder immaterieller Art, welche aus
                dem Zugriff oder der Nutzung bzw. Nichtnutzung der veröffentlichten
                Informationen, durch Missbrauch der Verbindung oder durch
                technische Störungen entstanden sind, werden ausgeschlossen. Alle
                Angebote sind unverbindlich. Der Autor behält es sich ausdrücklich
                vor, Teile der Seiten oder das gesamte Angebot ohne gesonderte
                Ankündigung zu verändern, zu ergänzen, zu löschen oder die
                Veröffentlichung zeitweise oder endgültig einzustellen.
              </p>
            </ImpressumSection>

            <ImpressumSection title="Haftung für Links">
              <p>
                Verweise und Links auf Webseiten Dritter liegen ausserhalb unseres
                Verantwortungsbereichs. Es wird jegliche Verantwortung für solche
                Webseiten abgelehnt. Der Zugriff und die Nutzung solcher Webseiten
                erfolgen auf eigene Gefahr des Nutzers oder der Nutzerin.
              </p>
            </ImpressumSection>

            <ImpressumSection title="Urheberrechte">
              <p>
                Die Urheber- und alle anderen Rechte an Inhalten, Bildern, Fotos
                oder anderen Dateien auf dieser Website gehören ausschliesslich
                DripForge oder den speziell genannten Rechtsinhabern. Für die
                Reproduktion jeglicher Elemente ist die schriftliche Zustimmung
                der Urheberrechtsträger im Voraus einzuholen.
              </p>
            </ImpressumSection>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
