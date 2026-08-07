import type { CmsPageEntry } from "@/lib/admin/site-nav"
import type { CmsPageBlock, CmsPageRow } from "@/lib/admin/cms-custom-pages"

const UEBER_UNS_ID = "ueber-uns"

const STORY_HTML = `
<h2>Leidenschaft für High-Tech &amp; Detail</h2>
<p>DripForge entstand aus der Begeisterung für grenzenlose kreative Gestaltung. Wir glauben daran, dass individuelle Produkte nicht nur funktional, sondern auch ästhetisch erstklassig sein müssen. Mit modernster additiver Fertigung (3D-Druck) und hochpräziser Lasergravur verwandeln wir komplexe digitale Designs in greifbare Realität – ob maßgeschneiderte Einzelanfertigung, Prototyp oder exklusive Kleinserie.</p>
`.trim()

/**
 * Default-Template für die Unterseite «Über uns» (/ueber-uns).
 * Storefront rendert die dedizierte UeberUnsPageView; dieses Template
 * bleibt für CMS-Seed / Builder-Konsistenz synchron.
 * Kontaktformular bewusst nicht enthalten (einmalig auf der Page-View).
 */
export function buildUeberUnsPageTemplate(): CmsPageEntry {
  const rows: CmsPageRow[] = [
    { id: "ueber-row-story", layout: "1", sortOrder: 0 },
    { id: "ueber-row-values", layout: "1", sortOrder: 1 },
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
          icon: "Sparkles",
          title: "Modernste Fertigung",
          description:
            "Präziser 3D-Druck & scharfe Lasergravuren auf höchstem technischem Niveau.",
        },
        {
          id: "ueber-card-quality",
          icon: "ShieldCheck",
          title: "Schweizer Präzision",
          description:
            "Jedes Produkt wird vor dem Versand persönlich geprüft und in der Schweiz fertiggestellt.",
        },
        {
          id: "ueber-card-detail",
          icon: "HeartHandshake",
          title: "Individuelle Wünsche",
          description:
            "Ob Sonderfarben, Namensgravuren oder STL-Dateien – wir setzen deine Vision exakt um.",
        },
      ],
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
    heroTitle: "Über DripForge – Wo Idee auf Präzision trifft",
    heroSubtitle:
      "Vom digitalen Entwurf zum perfekten Unikat. Wir verbinden modernste 3D-Druck- & Lasergravur-Technologie mit Schweizer Qualitätsanspruch.",
    bannerImageUrl: "/placeholder.svg",
    rows,
    blocks,
  }
}

export function isUeberUnsPageId(id: string): boolean {
  return id === UEBER_UNS_ID
}
