import type { CmsPageEntry } from "@/lib/admin/site-nav"
import type { CmsPageBlock, CmsPageRow } from "@/lib/admin/cms-custom-pages"

const UEBER_UNS_ID = "ueber-uns"

const STORY_HTML = `
<p><strong>Willkommen bei DripForge – Präzision trifft Leidenschaft</strong></p>
<p>Bei DripForge verwandeln wir kreative Ideen in einzigartige, greifbare Produkte. Was als Begeisterung für moderne Fertigungstechnologien und individuelles Design begann, ist heute unsere tägliche Leidenschaft: Produkte zu schaffen, die durch Qualität, Detailverliebtheit und Funktionalität überzeugen.</p>
<h3>Vom Code zum fertigen Unikat</h3>
<p>Egal ob hochpräziser 3D-Druck oder edle Lasergravur – bei uns kommt alles aus einer Hand. Wir setzen auf modernste Fertigungsmethoden, um sowohl maßgeschneiderte Einzelanfertigungen als auch durchdachte Kollektionen zu realisieren.</p>
<h3>Unsere Philosophie</h3>
<ul>
  <li><strong>Echte Schweizer Präzision:</strong> Wir prüfen jedes Teil persönlich, bevor es verpackt wird.</li>
  <li><strong>Nachhaltige Qualität:</strong> Wir nutzen langlebige Materialien und fertigen ressourcenschonend auf Bestellung.</li>
  <li><strong>Kreativität ohne Grenzen:</strong> Ob personalisiertes Geschenk oder technisches Bauteil – wir machen eure Vorstellungen möglich.</li>
</ul>
<p>Vielen Dank, dass du Teil unserer Reise bist!</p>
`.trim()

/**
 * Default-Template für die Unterseite «Über uns» (/ueber-uns).
 * Wird in mergeCmsPages geseedet und ist im Seiten-Builder editierbar.
 */
export function buildUeberUnsPageTemplate(): CmsPageEntry {
  const rows: CmsPageRow[] = [
    { id: "ueber-row-story", layout: "1", sortOrder: 0 },
    { id: "ueber-row-values", layout: "1", sortOrder: 1 },
    { id: "ueber-row-contact", layout: "1", sortOrder: 2 },
  ]

  const blocks: CmsPageBlock[] = [
    {
      id: "ueber-block-story",
      type: "imageText",
      sortOrder: 0,
      rowId: "ueber-row-story",
      columnIndex: 0,
      imageUrl: "/placeholder.svg",
      imageAlt: "3D-Druck und Laserfertigung bei DripForge",
      imagePosition: "right",
      textHtml: STORY_HTML,
    },
    {
      id: "ueber-block-values",
      type: "valueCards",
      sortOrder: 1,
      rowId: "ueber-row-values",
      columnIndex: 0,
      cards: [
        {
          id: "ueber-card-tech",
          icon: "Printer",
          title: "High-Tech Fertigung",
          description:
            "3D-Druck & Lasergravur aus einer Hand – präzise, modern und für Unikate wie Serien geeignet.",
        },
        {
          id: "ueber-card-quality",
          icon: "CheckCircle2",
          title: "Höchste Qualitätskontrolle",
          description:
            "Echte Schweizer Präzision: Jedes Teil wird persönlich geprüft, bevor es verpackt wird.",
        },
        {
          id: "ueber-card-detail",
          icon: "HeartHandshake",
          title: "Mit Liebe zum Detail",
          description:
            "Handwerkliche Sorgfalt und Leidenschaft für Design – vom digitalen Entwurf zum greifbaren Unikat.",
        },
      ],
    },
    {
      id: "ueber-block-contact",
      type: "contact",
      sortOrder: 2,
      rowId: "ueber-row-contact",
      columnIndex: 0,
      showContactForm: true,
      ctaTitle: "Schreib uns / Fragen & Sonderwünsche",
    },
  ]

  return {
    id: UEBER_UNS_ID,
    title: "Über uns",
    path: "/ueber-uns",
    enabled: true,
    sortOrder: 100,
    system: false,
    slug: "ueber-uns",
    published: true,
    heroTitle: "Über DripForge – Präzision trifft Leidenschaft",
    heroSubtitle: "Vom digitalen Entwurf zum greifbaren Unikat.",
    bannerImageUrl: "/placeholder.svg",
    rows,
    blocks,
  }
}

export function isUeberUnsPageId(id: string): boolean {
  return id === UEBER_UNS_ID
}
