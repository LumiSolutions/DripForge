"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

type AgbSection = {
  title: string
  paragraphs?: readonly string[]
  bullets?: readonly string[]
}

const AGB_SECTIONS: readonly AgbSection[] = [
  {
    title: "1. Geltungsbereich & Vertragspartner",
    paragraphs: [
      "Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Bestellungen über den Onlineshop von DripForge. Vertragspartner ist DripForge, Inhaber Robin Schulz, Mattenstrasse 7, 8330 Pfäffikon ZH. Mit dem Absenden einer Bestellung erkennt der Kunde diese AGB vollumfänglich an.",
    ],
  },
  {
    title: "2. Transparenz & Preise (Art. 3 Abs. 1 lit. s UWG)",
    paragraphs: [
      "Alle Preise sind in Schweizer Franken (CHF) ausgewiesen. Gemäss Art. 3 Abs. 1 lit. s des Bundesgesetzes gegen den unlauteren Wettbewerb (UWG) werden die Preise klar deklariert. Da DripForge nicht im Schweizer MWST-Register eingetragen ist, wird keine Mehrwertsteuer erhoben oder ausgewiesen (Preise verstehen sich rein Netto als Endpreise). Die Zahlung erfolgt über die im Shop bereitgestellten Methoden. Die Ware bleibt bis zur vollständigen Bezahlung im Eigentum von DripForge.",
    ],
  },
  {
    title: "3. Zustandekommen des Vertrages (Art. 184 ff. OR)",
    paragraphs: [
      "Der Kaufvertrag kommt nach den Bestimmungen des Schweizerischen Obligationenrechts (OR) zustande, sobald DripForge die Bestellung per E-Mail bestätigt oder mit der Produktion der individualisierten Ware beginnt. DripForge behält sich das Recht vor, Bestellungen ohne Angabe von Gründen abzulehnen (insbesondere bei rechtswidrigen Inhalten).",
    ],
  },
  {
    title: "4. Striktes Haftungs- und Urheberrechts-Disclaimer für Kundeninhalte",
    bullets: [
      "Der Kunde trägt die alleinige und vollumfängliche Verantwortung für alle Texte, Daten, Logos und Bilder, die er im Designer-Studio eingibt oder hochlädt.",
      "Der Kunde sichert ausdrücklich zu, dass die von ihm bereitgestellten Inhalte keine Rechte Dritter (insbesondere Urheberrechte, Markenrechte, Namensrechte oder Persönlichkeitsrechte) verletzen.",
      "Sollte DripForge von Dritten wegen einer solchen Rechtsverletzung durch ein vom Kunden gestaltetes Produkt in Anspruch genommen werden, stellt der Kunde DripForge von allen Ansprüchen, Kosten (inklusive Anwalts- und Gerichtskosten) und Schadenersatzforderungen vollumfänglich schadlos.",
    ],
  },
  {
    title: "5. Haftungsausschluss für gestalterische Mängel durch den Nutzer",
    bullets: [
      "DripForge haftet nicht für gestalterische Fehler, Tippfehler, Rechtschreibfehler, ungenaue Positionierungen oder mangelhafte Bildauflösungen (Pixelbildung), die durch den Kunden im Online-Konfigurator verursacht wurden. Die Vorschau im Studio ist bindend für das Produktionsergebnis. Das Produktionsrisiko für solche Fehler liegt allein beim Kunden.",
    ],
  },
  {
    title: "6. Absoluter Ausschluss des Rückgaberechts (Individualanfertigungen)",
    bullets: [
      "Im Schweizer Recht existiert kein gesetzliches Widerrufsrecht für den Online-Handel. Da alle im Studio personalisierten Produkte (3D-Drucke, Gravuren, Schnitte) per Definition kundenspezifische Massanfertigungen sind, ist jede Rückgabe, jeder Umtausch und jede Stornierung nach Bestellabschluss absolut ausgeschlossen. Der Kaufvertrag ist mit Absenden der Bestellung bindend.",
    ],
  },
  {
    title: "7. Lieferung, Versand & Gefahrenübergang (Art. 185 OR)",
    paragraphs: [
      "Der Versand erfolgt ausschliesslich innerhalb der Schweiz. Lieferfristen sind Richtwerte. Gemäss Art. 185 OR gehen Nutzen und Gefahr auf den Kunden über, sobald die Ware an das Transportunternehmen (z.B. Schweizer Post) übergeben wurde. DripForge haftet nicht für Lieferverzögerungen oder Transportschäden des Versandunternehmens.",
    ],
  },
  {
    title: "8. Gewährleistung & Mängelrüge (Art. 201 OR)",
    paragraphs: [
      "Gemäss Art. 201 OR ist der Kunde verpflichtet, die gelieferte Ware unverzüglich nach Erhalt zu prüfen und allfällige Mängel sofort zu rügen. Offensichtliche Material- oder Fabrikationsfehler (z.B. ein defekter LED-Sockel) müssen innerhalb von 3 Werktagen nach Erhalt schriftlich mit Fotobeweis gerügt werden. Bei berechtigten Mängeln steht DripForge gemäss Art. 205 OR das primäre Recht auf Nachbesserung oder Ersatzlieferung zu. Minderung oder Wandlung sind ausgeschlossen.",
    ],
  },
  {
    title: "9. Haftungsbeschränkung (Art. 100 OR)",
    paragraphs: [
      "Die Haftung von DripForge wird im gesetzlich zulässigen Rahmen (Art. 100 OR) auf Vorsatz und grobe Fahrlässigkeit beschränkt. Jede weitergehende Haftung, insbesondere für indirekte Schäden, Mangelfolgeschäden, entgangenen Gewinn oder Produktionsausfälle des Kunden, wird vollumfänglich ausgeschlossen.",
    ],
  },
  {
    title: "10. Salvatorische Klausel & Anwendbares Recht",
    paragraphs: [
      "Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt. Es gilt ausschliesslich Schweizer Recht.",
    ],
  },
  {
    title: "11. Gerichtsstand (Art. 10 ff. ZPO)",
    paragraphs: [
      "Für alle vertraglichen Streitigkeiten wird, soweit gesetzlich zulässig und unter Berücksichtigung der Bestimmungen der Schweizerischen Zivilprozessordnung (ZPO), der Sitz von DripForge (Pfäffikon ZH) als ausschliesslicher Gerichtsstand vereinbart.",
    ],
  },
]

function AgbSectionBlock({ section }: { section: AgbSection }) {
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

export function AgbPageContent() {
  return (
    <div className="space-y-12 py-8">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <Badge variant="secondary" className="mb-4">
          Rechtliches
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          <span className="text-foreground">Allgemeine </span>
          <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
            Geschäftsbeding
          </span>
          <span className="text-foreground">ungen</span>
        </h1>
      </div>

      <div className="mx-auto max-w-3xl px-4">
        <Card className="border-border/50 bg-card/50 shadow-sm dark:border-border/60 dark:bg-card/90">
          <CardContent className="space-y-10 p-8 md:p-10">
            {AGB_SECTIONS.map((section) => (
              <AgbSectionBlock key={section.title} section={section} />
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
