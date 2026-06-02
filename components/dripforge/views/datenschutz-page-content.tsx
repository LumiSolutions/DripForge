"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

type PrivacySection = {
  title: string
  paragraphs?: readonly string[]
  bullets?: readonly string[]
}

const PRIVACY_SECTIONS: readonly PrivacySection[] = [
  {
    title: "1. Allgemeine Informationen",
    paragraphs: [
      "Verantwortliche Stelle für die Datenverarbeitung auf dieser Website im Sinne des Schweizerischen Datenschutzgesetzes (DSG) ist DripForge, Inhaber Robin Schulz, Mattenstrasse 7, 8330 Pfäffikon ZH (E-Mail: drip-forge@outlook.com). Wir nehmen den Schutz deiner persönlichen Daten sehr ernst und behandeln deine personenbezogenen Daten vertraulich und entsprechend der gesetzlichen Vorschriften.",
    ],
  },
  {
    title: "2. Erfassung und Verarbeitung von Personendaten",
    paragraphs: [
      "Wir verarbeiten personenbezogene Daten, die wir im Rahmen unserer Geschäftsbeziehung von unseren Kunden und anderen Beteiligten erhalten oder die beim Betrieb unserer Website erhoben werden. Dazu gehören insbesondere: Name, Kontaktdaten, Liefer- und Rechnungsadresse, Zahlungsdaten sowie Kommunikationsdaten.",
    ],
  },
  {
    title: "3. Verarbeitung von Kundeninhalten (Bild- und Logouploads)",
    bullets: [
      "Für die Personalisierung von Produkten im Designer-Studio lädt der Nutzer eigene Bilddateien, Grafiken oder Logos hoch.",
      "Diese Daten werden ausschliesslich temporär für den Bestellprozess und die anschliessende physische Produktion (3D-Druck, Lasergravur) verarbeitet.",
      "Nach erfolgreichem Versand und Abschluss des Auftrags werden diese kundenspezifischen Designdaten aus Sicherheits- und Datenschutzgründen innerhalb von 30 Tagen unwiderruflich von unseren Systemen gelöscht.",
    ],
  },
  {
    title: "4. Zweck der Datenverarbeitung",
    paragraphs: [
      "Die Datenverarbeitung erfolgt primär zur Abwicklung von Kaufverträgen, zur Bereitstellung und Optimierung unseres Online-Konfigurators, für den sicheren Versand der bestellten Produkte, zur Rechnungsstellung sowie zur Kommunikation mit dir bei Rückfragen zu deinem Design.",
    ],
  },
  {
    title: "5. Datensicherheit",
    paragraphs: [
      "Wir treffen angemessene technische und organisatorische Sicherheitsmassnahmen, um deine personenbezogenen Daten vor unberechtigtem Zugriff, Missbrauch, Verlust oder Zerstörung zu schützen. Unsere Website nutzt aus Sicherheitsgründen und zum Schutz der Übertragung vertraulicher Inhalte eine SSL- bzw. TLS-Verschlüsselung.",
    ],
  },
  {
    title: "6. Weitergabe von Daten an Dritte",
    paragraphs: [
      "Eine Weitergabe deiner Daten an Dritte erfolgt nur dann, wenn dies zur Vertragserfüllung zwingend notwendig ist. Dazu gehören Logistikpartner (z.B. Schweizer Post) für die Zustellung der Ware sowie Zahlungsdienstleister für die sichere Abwicklung der Transaktionen. Es werden jeweils nur die absolut notwendigen Daten übermittelt.",
    ],
  },
  {
    title: "7. Verwendung von Cookies und Server-Logfiles",
    paragraphs: [
      "Beim Zugriff auf unsere Website werden automatisch Informationen allgemeiner Natur in sogenannten Server-Logfiles erhoben (z.B. Browsertyp, Betriebssystem, IP-Adresse). Diese Daten sind nicht bestimmten Personen zuzuordnen und dienen der fehlerfreien Bereitstellung der Website. Zudem setzen wir notwendige Cookies ein, um die Funktionalität des Warenkorbs und des Studios zu gewährleisten.",
    ],
  },
  {
    title: "8. Deine Rechte (Auskunft, Berichtigung, Löschung)",
    paragraphs: [
      "Du hast im Rahmen des auf dich anwendbaren Datenschutzrechts das Recht auf Auskunft, Berichtigung, Löschung oder Einschränkung der Verarbeitung deiner bei uns gespeicherten Personendaten. Entsprechende Anfragen können jederzeit schriftlich per E-Mail an unseren Kundendienst gerichtet werden.",
    ],
  },
]

function PrivacySectionBlock({ section }: { section: PrivacySection }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-foreground md:text-xl">
        {section.title}
      </h2>
      <div className="space-y-3 text-[0.9375rem] leading-relaxed text-muted-foreground md:text-base">
        {section.paragraphs?.map((paragraph) => (
          <p key={paragraph.slice(0, 48)}>{paragraph}</p>
        ))}
        {section.bullets && section.bullets.length > 0 && (
          <ul className="list-disc space-y-2 pl-5">
            {section.bullets.map((item) => (
              <li key={item.slice(0, 48)}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export function DatenschutzPageContent() {
  return (
    <div className="space-y-12 py-8">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <Badge variant="secondary" className="mb-4">
          Rechtliches
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          <span className="text-foreground">Daten</span>
          <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
            schutzerkl
          </span>
          <span className="text-foreground">ärung</span>
        </h1>
      </div>

      <div className="mx-auto max-w-3xl px-4">
        <Card className="border-border/50 bg-card/50 shadow-sm dark:border-border/60 dark:bg-card/90">
          <CardContent className="space-y-10 p-8 md:p-10">
            {PRIVACY_SECTIONS.map((section) => (
              <PrivacySectionBlock key={section.title} section={section} />
            ))}
            <p className="border-t border-border/50 pt-6 text-sm text-muted-foreground">
              Stand: Mai 2026
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
