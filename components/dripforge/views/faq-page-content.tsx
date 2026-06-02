"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const FAQ_ITEMS = [
  {
    question: "Welche Dateiformate akzeptiert ihr für den 3D-Druck?",
    answer:
      "Wir akzeptieren die Formate STL, OBJ und 3MF. Für die besten und detailreichsten Ergebnisse empfehlen wir eine STL-Datei mit einer Auflösung von mindestens 0.1 mm.",
  },
  {
    question: "Auf welchen Materialien sind Lasergravuren und Schnitte möglich?",
    answer:
      "Im Designer-Studio bieten wir aktuell hochwertige Bearbeitungen auf Naturschiefer, edlem Acrylglas, Echtleder sowie verschiedenen Hölzern an. Je nach Material ist eine Gravur oder ein präziser Laserschnitt möglich.",
  },
  {
    question: "Was ist der Unterschied zwischen Lasergravur und Laserschnitt?",
    answer:
      "Bei der Lasergravur wird die Oberfläche des Materials minimal abgetragen, um Texte, Logos oder Bilder dauerhaft und kratzfest einzubrennen (z.B. weissliche Schrift auf Schiefer). Beim Laserschnitt schneidet der Laser das Material komplett durch, um individuelle Formen und Konturen (z.B. aus Acryl oder Holz) auszuschneiden.",
  },
  {
    question: "Wie lange dauert die Produktion und der Versand?",
    answer:
      "Da jedes Produkt ein Unikat ist und individuell für dich gefertigt wird, beträgt die Produktionszeit in der Regel 3 bis 5 Werktage nach Zahlungseingang. Anschliessend wird dein Paket klimaneutral per B-Post schweizweit versendet.",
  },
  {
    question: "Kann ich ein individuell gestaltetes Produkt wieder zurückgeben?",
    answer:
      "Nein. Da alle im Studio personalisierten Produkte (mit eigenem Text, gewählten Schriftarten oder hochgeladenen Logos) exakt nach deinen spezifischen Kundenvorgaben massangefertigt werden, ist das Recht auf Widerruf oder Rückgabe gemäss unseren AGB ausgeschlossen.",
  },
  {
    question: "Wie reinige und pflege ich meine gravierten Schiefer- oder Acrylprodukte?",
    answer:
      "Schieferprodukte lassen sich einfach mit einem feuchten Tuch reinigen. Für einen schönen Glanz kannst du sie ab und zu mit etwas Speiseöl einreiben. Acrylglas reinigst du am besten mit einem weichen Mikrofasertuch und etwas Wasser – bitte verwende keinen Glasreiniger oder Alkohol, da das Material sonst blind werden kann.",
  },
  {
    question: "Was passiert, wenn mein Produkt beschädigt ankommt oder einen Fehler hat?",
    answer:
      "Bitte prüfe deine Ware sofort nach Erhalt. Sollte ein nachweisbarer Material- oder Produktionsfehler vorliegen (z.B. ein Defekt am LED-Sockel), melde dich umgehend über unser Kontaktformular bei uns. Wir kümmern uns sofort um eine Nachbesserung oder eine kostenlose Ersatzlieferung.",
  },
  {
    question: "Werden meine hochgeladenen Bilder/Logos für die Gravur gespeichert?",
    answer:
      "Deine hochgeladenen Logos und Bilder werden ausschliesslich für die Abwicklung und Produktion deiner Bestellung verwendet. Nach erfolgreicher Fertigung und dem Versand deines Produkts werden die Designdaten aus Sicherheits- und Datenschutzgründen gelöscht.",
  },
  {
    question: "Bietet ihr auch Rabatte für Grossbestellungen (z.B. für Firmen oder Vereine) an?",
    answer:
      "Ja, ab einer grösseren Stückzahl (z.B. bei personalisierten Kundengeschenken, Untersetzern oder Firmenschildern) bieten wir attraktive Mengenrabatte an. Kontaktiere uns hierzu am besten direkt über das Kontaktformular für ein individuelles Angebot.",
  },
  {
    question: "Kann ich im Nachhinein noch Änderungen an meinem Design vornehmen?",
    answer:
      "Da unser Produktionsprozess stark automatisiert ist, werden Bestellungen oft sehr schnell verarbeitet. Wenn du einen Fehler entdeckst, schreibe uns bitte sofort eine E-Mail. Befindet sich dein Produkt bereits in der Fertigung, können wir leider keine Änderungen mehr vornehmen.",
  },
] as const

export function FaqPageContent() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggle = (index: number) => {
    setOpenIndex((current) => (current === index ? null : index))
  }

  return (
    <div className="space-y-12 py-8">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <Badge variant="secondary" className="mb-4">
          Hilfe & Support
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          <span className="text-foreground">Häufig gestellte </span>
          <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
            Frag
          </span>
          <span className="text-foreground">en</span>
        </h1>
      </div>

      <div className="mx-auto max-w-3xl space-y-3 px-4">
        {FAQ_ITEMS.map((faq, index) => {
          const isOpen = openIndex === index
          return (
            <Card
              key={faq.question}
              className={cn(
                "overflow-hidden border-border/50 bg-card/50 shadow-sm transition-all duration-300 dark:bg-card/90",
                isOpen && "border-primary/40 bg-card ring-1 ring-primary/20"
              )}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 p-5 text-left md:p-6"
                onClick={() => toggle(index)}
                aria-expanded={isOpen}
              >
                <span
                  className={cn(
                    "pr-2 text-sm font-bold leading-snug text-foreground md:text-base",
                    isOpen && "text-primary"
                  )}
                >
                  {faq.question}
                </span>
                <ChevronRight
                  className={cn(
                    "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300",
                    isOpen && "rotate-90 text-primary"
                  )}
                  aria-hidden
                />
              </button>
              <div
                className={cn(
                  "grid transition-all duration-300 ease-in-out",
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                )}
              >
                <div className="overflow-hidden">
                  <p className="border-t border-border/40 px-5 pb-5 pt-4 text-sm leading-relaxed text-muted-foreground md:px-6 md:pb-6 md:text-[0.9375rem]">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
