export const SITE_TEXTS_DOC_ID = "site-texts"
export const SITE_TEXT_DOC_TYPE = "site-texts"

export type SiteTextKey = keyof typeof DEFAULT_SITE_TEXTS

export type SiteTexts = Record<SiteTextKey, string>

export type SiteTextField = {
  key: SiteTextKey
  label: string
  multiline?: boolean
}

export type SiteTextSection = {
  id: "landingpage" | "shop" | "konto" | "footer"
  label: string
  fields: SiteTextField[]
}

export const DEFAULT_SITE_TEXTS = {
  landingpage_hero_badge: "Schweizer Präzision",
  landingpage_hero_title: "Präzision trifft",
  landingpage_hero_title_highlight: "Kreativität",
  landingpage_hero_subtitle:
    "Von der Idee zur Realität - wir bringen Ihre Visionen mit industriellem 3D-Druck und Lasergravur zum Leben. Schweizer Qualität für Ihre individuellen Projekte.",
  landingpage_hero_cta_primary: "Jetzt Erstellen",
  landingpage_hero_cta_secondary: "Produkte Entdecken",
  landingpage_expertise_heading: "Expertise",
  landingpage_expertise_subtitle_both:
    "Zwei leistungsstarke Fertigungstechnologien, ein Premium-Erlebnis.",
  landingpage_expertise_subtitle_single:
    "Präzise Fertigung für Ihre individuellen Projekte.",
  landingpage_why_heading: "DripForge",
  landingpage_why_subtitle:
    "Wir verbinden modernste Technologie mit Handwerkskunst für aussergewöhnliche Ergebnisse.",
  landingpage_cta_title: "Erstellen",
  landingpage_cta_subtitle:
    "Laden Sie Ihr 3D-Modell hoch oder wählen Sie aus unserer Kollektion. Lassen Sie uns Ihre Vision mit Präzision und Qualität zum Leben erwecken.",
  landingpage_cta_button_upload: "3D-Datei Hochladen",
  landingpage_cta_button_contact: "Beratung Anfragen",
  landingpage_trust_offer: "Kostenlose Offerte",
  landingpage_trust_shipping: "Schneller Versand",
  landingpage_trust_quality: "Qualitätsgarantie",
  landingpage_countdown_label: "Countdown zum Launch",
  landingpage_countdown_teaser: "Hier entsteht DripForge",
  landingpage_countdown_title: "Präziser 3D-Druck & Lasergravur aus der Schweiz",
  landingpage_countdown_past_message:
    "Der Launch-Termin ist erreicht — die Freischaltung erfolgt in Kürze.",

  shop_hero_badge: "Shop",
  shop_hero_title_prefix: "Der ",
  shop_hero_title_brand: "DripForge",
  shop_hero_title_suffix: " Shop",
  shop_hero_subtitle:
    "Durchstoebern Sie unsere Kollektion von Premium 3D-gedruckten und lasergravierten Produkten, oder erstellen Sie Ihr eigenes individuelles Stueck.",
  shop_custom_section_title: "Einzigartiges",
  shop_custom_section_subtitle:
    "Laden Sie Ihr eigenes Design hoch und verwirklichen Sie Ihre Vision",
  shop_custom_3d_title: "Ihr Individueller 3D-Druck",
  shop_custom_3d_description:
    "Laden Sie Ihre STL/OBJ-Datei hoch und erhalten Sie eine sofortige Offerte.",
  shop_custom_laser_title: "Individuelle Laserkreation",
  shop_custom_laser_description:
    "Laden Sie Ihr Bild oder Text hoch und wir gravieren es auf dem Material Ihrer Wahl.",
  shop_delivery_notice:
    "Falls du eine andere Groesse fuer dieses Produkt wuenschst, fertigen wir dies gerne fuer dich an. Melde dich einfach kurz ueber unser",
  shop_empty_category: "Keine Produkte in dieser Kategorie.",

  konto_welcome_title: "Mein Konto",
  konto_welcome_subtitle: "Willkommen zurück",
  konto_customer_number_label: "Ihre Kundennummer",
  konto_login_title: "Kunden-Login",
  konto_login_subtitle: "Melde dich an, um Bestellungen und Designs zu verwalten.",
  konto_register_title: "Konto erstellen",
  konto_register_subtitle:
    "Mit derselben E-Mail wie bei Bestellungen siehst du deine Auftraege automatisch.",
  konto_support_hint:
    "Bei Fragen zu Bestellungen oder Designs erreichst du uns jederzeit ueber das Kontaktformular.",

  footer_tagline:
    "Verwandeln Sie Ihre Ideen in Realität mit präzisem 3D-Druck und Lasergravur-Services.",
  footer_services_heading: "Services",
  footer_company_heading: "Unternehmen",
  footer_contact_heading: "Kontakt",
  footer_copyright_suffix: "Alle Rechte vorbehalten.",
} as const

export const SITE_TEXT_SECTIONS: SiteTextSection[] = [
  {
    id: "landingpage",
    label: "Landingpage",
    fields: [
      { key: "landingpage_hero_badge", label: "Hero-Badge" },
      { key: "landingpage_hero_title", label: "Hero-Titel (Teil 1)" },
      { key: "landingpage_hero_title_highlight", label: "Hero-Titel (hervorgehoben)" },
      { key: "landingpage_hero_subtitle", label: "Hero-Untertitel", multiline: true },
      { key: "landingpage_hero_cta_primary", label: "Primaerer Button" },
      { key: "landingpage_hero_cta_secondary", label: "Sekundaerer Button" },
      { key: "landingpage_expertise_heading", label: "Expertise-Ueberschrift" },
      {
        key: "landingpage_expertise_subtitle_both",
        label: "Expertise-Text (3D + Laser)",
        multiline: true,
      },
      {
        key: "landingpage_expertise_subtitle_single",
        label: "Expertise-Text (ein Service)",
        multiline: true,
      },
      { key: "landingpage_why_heading", label: "Warum-Ueberschrift" },
      { key: "landingpage_why_subtitle", label: "Warum-Text", multiline: true },
      { key: "landingpage_cta_title", label: "CTA-Titel (hervorgehoben)" },
      { key: "landingpage_cta_subtitle", label: "CTA-Text", multiline: true },
      { key: "landingpage_cta_button_upload", label: "CTA-Button Upload" },
      { key: "landingpage_cta_button_contact", label: "CTA-Button Kontakt" },
      { key: "landingpage_trust_offer", label: "Vertrauens-Badge: Offerte" },
      { key: "landingpage_trust_shipping", label: "Vertrauens-Badge: Versand" },
      { key: "landingpage_trust_quality", label: "Vertrauens-Badge: Qualitaet" },
      { key: "landingpage_countdown_label", label: "Countdown-Ueberschrift" },
      { key: "landingpage_countdown_teaser", label: "Coming-Soon Teaser" },
      { key: "landingpage_countdown_title", label: "Coming-Soon Titel" },
      {
        key: "landingpage_countdown_past_message",
        label: "Countdown abgelaufen Hinweis",
        multiline: true,
      },
    ],
  },
  {
    id: "shop",
    label: "Shop / Produkte",
    fields: [
      { key: "shop_hero_badge", label: "Shop-Badge" },
      { key: "shop_hero_title_prefix", label: "Shop-Titel Prefix" },
      { key: "shop_hero_title_brand", label: "Shop-Titel Marke" },
      { key: "shop_hero_title_suffix", label: "Shop-Titel Suffix" },
      { key: "shop_hero_subtitle", label: "Shop-Einleitung", multiline: true },
      { key: "shop_custom_section_title", label: "Individuell-Ueberschrift" },
      {
        key: "shop_custom_section_subtitle",
        label: "Individuell-Untertitel",
        multiline: true,
      },
      { key: "shop_custom_3d_title", label: "3D-Karte Titel" },
      { key: "shop_custom_3d_description", label: "3D-Karte Text", multiline: true },
      { key: "shop_custom_laser_title", label: "Laser-Karte Titel" },
      { key: "shop_custom_laser_description", label: "Laser-Karte Text", multiline: true },
      { key: "shop_delivery_notice", label: "Lieferzeit / Groessen-Hinweis", multiline: true },
      { key: "shop_empty_category", label: "Leere Kategorie Meldung" },
    ],
  },
  {
    id: "konto",
    label: "Konto-Portal",
    fields: [
      { key: "konto_welcome_title", label: "Dashboard-Titel" },
      { key: "konto_welcome_subtitle", label: "Willkommens-Text" },
      { key: "konto_customer_number_label", label: "Kundennummer Label" },
      { key: "konto_login_title", label: "Login-Titel" },
      { key: "konto_login_subtitle", label: "Login-Untertitel", multiline: true },
      { key: "konto_register_title", label: "Registrierung-Titel" },
      { key: "konto_register_subtitle", label: "Registrierung-Untertitel", multiline: true },
      { key: "konto_support_hint", label: "Support-Hinweis", multiline: true },
    ],
  },
  {
    id: "footer",
    label: "Footer / Rechtliches",
    fields: [
      { key: "footer_tagline", label: "Footer-Beschreibung", multiline: true },
      { key: "footer_services_heading", label: "Spalte Services" },
      { key: "footer_company_heading", label: "Spalte Unternehmen" },
      { key: "footer_contact_heading", label: "Spalte Kontakt" },
      { key: "footer_copyright_suffix", label: "Copyright-Zusatz" },
    ],
  },
]

export function mergeSiteTexts(
  partial: Partial<Record<string, string>> | null | undefined
): SiteTexts {
  const merged = { ...DEFAULT_SITE_TEXTS } as SiteTexts
  if (!partial) return merged
  for (const key of Object.keys(DEFAULT_SITE_TEXTS) as SiteTextKey[]) {
    const value = partial[key]
    if (typeof value === "string" && value.trim()) {
      merged[key] = value.trim()
    }
  }
  return merged
}

export function sanitizeSiteTextsInput(
  input: Partial<Record<string, string>> | null | undefined
): SiteTexts {
  const merged = mergeSiteTexts(null)
  if (!input || typeof input !== "object") return merged
  for (const key of Object.keys(DEFAULT_SITE_TEXTS) as SiteTextKey[]) {
    const value = input[key]
    merged[key] = typeof value === "string" ? value : merged[key]
  }
  return merged
}
