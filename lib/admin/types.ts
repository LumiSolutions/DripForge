import type { CheckoutRuntimeConfig } from "@/lib/dripforge/checkout-config"
import type {
  OrderAddress,
  OrderPayload,
} from "@/lib/dripforge/submit-order"
import type { CartItem, Product } from "@/lib/dripforge/types"
import type { PaymentMethodId, ShippingMethodId } from "@/lib/dripforge/checkout-config"
import type { ManagedCatalogItem } from "@/lib/dripforge/managed-catalog"
import type {
  SupportFeatureItem,
  SupportMilestoneConfig,
} from "@/lib/dripforge/support-page-settings"

export type OrderStatus =
  | "ausstehend"
  | "in_produktion"
  | "versendet"
  | "storniert"

export const ORDER_STATUS_OPTIONS: {
  value: OrderStatus
  label: string
}[] = [
  { value: "ausstehend", label: "Ausstehend" },
  { value: "in_produktion", label: "In Produktion" },
  { value: "versendet", label: "Versendet" },
  { value: "storniert", label: "Storniert" },
]

/**
 * Produktions-Cockpit (Kanban) — erweiterte Pipeline inkl. Zahlungsstufen.
 * Reihenfolge: Bestellungseingang → Bezahlt → Bereit für Produktion →
 * In Produktion → Qualitätskontrolle → Bereit für Versand → Versendet.
 */
export type ProductionStatus =
  | "bestellungseingang"
  | "bezahlt"
  | "bereit_fuer_produktion"
  | "in_produktion"
  | "qualitaetskontrolle"
  | "bereit_fuer_versand"
  | "versendet"

export const DEFAULT_PRODUCTION_STATUS: ProductionStatus = "bestellungseingang"

export type StoredOrderItem = CartItem & {
  leitbildUrl?: string | null
  /**
   * Zusammengesetztes Vorschau-Mockup (Laser: Hintergrund + Logo/Text).
   * Entspricht dem Canvas-/html2canvas-Snapshot beim Warenkorb.
   */
  previewMockupUrl?: string | null
  /** Alias für previewMockupUrl (API/Cockpit) */
  mockupPreviewUrl?: string | null
  /** Snake-case Alias */
  mockup_preview_url?: string | null
  /** Azure-URL der transparenten Produktionsdatei */
  productionLayerUrl?: string | null
}

export type StoredOrder = {
  orderId: string
  createdAt: string
  status: OrderStatus
  /** Kanban-Spalte im Produktions-Cockpit */
  productionStatus?: ProductionStatus
  kundennummer?: string
  /** Eingeloggtes Konto (Session-E-Mail) — unabhängig von billing.email */
  accountEmail?: string
  billing: OrderAddress
  delivery?: OrderAddress
  shippingMethod: ShippingMethodId
  paymentMethod: PaymentMethodId
  paymentMethodLabel: string
  items: StoredOrderItem[]
  totals: OrderPayload["totals"]
  /** URL zur gespeicherten Rechnungs-PDF (Azure Blob) */
  rechnungPdfUrl?: string
  /** Lokaler Dateiname unter data/admin/invoices/ */
  rechnungPdfPath?: string
  /** Kurze Rechnungsnummer (z. B. INV-2026-0089), getrennt von der Shop-Bestell-ID */
  invoiceNumber?: string | null
  /** Stripe Checkout Session (Shop) */
  stripeSessionId?: string | null
  /** @deprecated Legacy Payrexx — nur noch historische Bestellungen */
  payrexxGatewayHash?: string | null
  /** @deprecated Legacy Payrexx — nur noch historische Bestellungen */
  payrexxTransactionUuid?: string | null
  /** Zahlung bestätigt (false = wartet auf Stripe-Webhook / TWINT) */
  paymentConfirmed?: boolean
  /** Abgeleitetes Zahlungsstatus-Label für Persistenz / Admin */
  paymentStatus?: "pending" | "paid"
  /** Mindestens eine Position: Kunde sendet eigenes Produkt zur Laserbearbeitung ein */
  isCustomerInbound?: boolean
  /** Lager: reserviert / verbraucht / freigegeben */
  inventoryState?: import("@/lib/admin/material-types").OrderInventoryState
  /** Reservierte Materialmengen pro Bestellung */
  materialReservations?: import("@/lib/admin/material-types").OrderMaterialReservation[]
  /** Schweizer Post Sendungsnummer (nach Versand) */
  trackingNumber?: string
  /** Versand-E-Mail-Benachrichtigungen (Idempotenz) */
  emailNotifications?: OrderEmailNotifications
  /** Bestellweite Kundenbemerkung / Hinweise */
  customerNote?: string
}

export type OrderEmailNotifications = {
  receivedAt?: string
  confirmedAt?: string
  /** Status «bereit für Versand / Abholbereit» */
  readyAt?: string
  shippedAt?: string
  /**
   * Claim-Flag bevor SMTP läuft — verhindert Doppelversand
   * (Stripe-Webhook + Success-Page).
   */
  inboundQueuedAt?: string
}

export type CompanySettings = {
  firmenname: string
  firmenAdresse: string
  iban: string
  bankname: string
  kontaktEmail: string
  /** Kundensupport / WhatsApp / Footer (optional) */
  telefonnummer: string
}

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  firmenname: "DripForge",
  firmenAdresse: "Pfäffikon ZH\nSchweiz",
  iban: "",
  bankname: "",
  kontaktEmail: "drip-forge@outlook.com",
  telefonnummer: "",
}

export type StoredCustomer = {
  kundennummer: string
  email: string
  billing: OrderAddress
  delivery?: OrderAddress
  orderIds: string[]
  /** Zugeordnete Kundenkategorie (Rabatt/Versand); Konfiguration in AdminSettings. */
  customerCategoryId?: string | null
  /** CRM-Status (Soft Delete über Portal) */
  status?: import("@/lib/konto/account-status").CustomerAccountStatus
  createdAt: string
  updatedAt: string
}

export type CountdownTemplateId = "website_launch" | "shop_update"

export type LaunchSettings = {
  /** true = Coming-Soon-Wand ist dauerhaft deaktiviert */
  shopLive: boolean
  /** Vorlage für Coming-Soon / Countdown */
  countdownTemplate: CountdownTemplateId
  /** Titel über der Uhr (z. B. COUNTDOWN ZUM LAUNCH) */
  countdownLabel: string
  /** Ziel-Zeitpunkt des Countdowns (ISO 8601) */
  targetAt: string
  /** Teaser-Bild (Azure Blob URL) — Fallback: /images/launch-hero.png */
  heroImageUrl?: string | null
  /** Gesperrte Unterseite (z. B. /laser). Leer = gesamte Website (shopLive-Gate). */
  blockedPath?: string | null
}

export const DEFAULT_LAUNCH_SETTINGS: LaunchSettings = {
  shopLive: false,
  countdownTemplate: "website_launch",
  countdownLabel: "COUNTDOWN ZUM LAUNCH",
  targetAt: "2026-08-01T00:00:00.000Z",
  heroImageUrl: null,
  blockedPath: null,
}

/** Sichtbarkeit einzelner Dienstleistungen auf der Website */
export type ServiceVisibilitySettings = {
  druck3d: boolean
  lasergravur: boolean
  laserschnitt: boolean
  markierungAetzung: boolean
}

export const DEFAULT_SERVICE_VISIBILITY: ServiceVisibilitySettings = {
  druck3d: false,
  lasergravur: true,
  laserschnitt: false,
  markierungAetzung: false,
}

/** Sichtbarkeit der Konfigurator-Karten im Shop («Erschaffen Sie etwas Einzigartiges») */
export type ShopConfiguratorSettings = {
  custom3d: boolean
  customLaser: boolean
}

export const DEFAULT_SHOP_CONFIGURATORS: ShopConfiguratorSettings = {
  custom3d: false,
  customLaser: true,
}

export type AdminSettings = {
  checkout: CheckoutRuntimeConfig
  company: CompanySettings
  launch: LaunchSettings
  services: ServiceVisibilitySettings
  shopConfigurators: ShopConfiguratorSettings
  /** Dynamischer Katalog: Dienstleistungen & Konfigurator-Kacheln (System + Custom) */
  managedCatalog?: ManagedCatalogItem[]
  /** Support-Kampagne auf der normalen Website (Header, Mobile, /support) */
  showSupportOnMainSite: boolean
  /** Support-Link/Button auf der Countdown-Landingpage */
  showSupportOnCountdownPage: boolean
  /** Konfigurierbare Meilensteine / Ziele der Support-Kampagne */
  supportMilestones?: SupportMilestoneConfig[]
  /** Unterstützte Produkte / Features (Storefront-Liste) */
  supportFeatures?: SupportFeatureItem[]
  /** Onboarding-Tropfen für Erstbesucher neben Sonne/Mond-Icon */
  enableOnboardingTour: boolean
  /** Frage-Text im Tropfen (Zeilenumbrüche via \\n); leer = kein Text im Tropfen */
  onboardingTourText: string
  /** Hochgeladenes Overlay-Bild für die Theme-Tour (Azure Blob / Data-URL) */
  themeInboundTourImageUrl?: string | null
  /** Treuepunkte-System (Kaufen, Einlösen, Konto-Anzeige) */
  enableRewardPointsSystem: boolean
  /** Punkte-Gutschrift in % vom Einkaufswert (100 = 1 CHF → 1 Punkt). */
  loyaltyEarnPercent: number
  /** Einlösewert eines Punktes in CHF (z. B. 1.00 oder 0.10). */
  loyaltyPointValueChf: number
  /** Ablaufdauer der Punkte ab Gutschrift (Monate). */
  loyaltyPointsExpiryMonths: number
  /** Sektion «Unsere Top Produkte» auf der Startseite anzeigen */
  showTopProductsOnHomepage: boolean
  /** Anzahl angezeigter Top-Produkte auf der Startseite (1–10) */
  topProductsCount: number
  /** Zwei-Faktor-Authentifizierung für Admin-/Tester-Logins (Env kann erzwingen deaktivieren) */
  requireAdmin2fa: boolean
  /** Wunschzettel-/Favoriten-Symbol im Shop (Standard: Stern) */
  wishlistIcon?: "star" | "heart" | "bookmark" | "fire" | "custom"
  /** Custom-SVG/URL wenn wishlistIcon === "custom" */
  wishlistIconCustomUrl?: string | null
  /** Kleine Icon-Marke / Favicon (Header, Footer, Browser-Tab, Apple-Touch-Icon) */
  brandIconUrl?: string | null
  /** Haupt-/Branding-Logo (grosse Darstellung, Home/Hero) */
  brandLogoUrl?: string | null
  /** Globale E-Mail-Signatur (z. B. für Antworten auf Kontaktanfragen) */
  emailSignature?: string
  /** Bearbeitbare Texte für Bestell-Bestätigungsmails */
  orderEmailTemplates?: {
    receivedIntro: string
    receivedFooter: string
  }
  /** Visuelles Layout der Kunden-Bestellbestätigung (Sektionsreihenfolge, Logo) */
  orderEmailLayout?: {
    sectionOrder: Array<
      | "header"
      | "intro"
      | "orderItems"
      | "totals"
      | "addressBlock"
      | "footer"
    >
    showLogo: boolean
    logoPosition: "left" | "center" | "right"
    headerTitle?: string
    logoUrl?: string
    metaFields?: {
      invoiceNumber: boolean
      orderRef: boolean
      date: boolean
      paymentMethod: boolean
      paymentStatus: boolean
      shippingMethod: boolean
    }
  }
  /** Globale Notification-Bar (optional, Defaults inaktiv) */
  announcementBanner?: import("@/lib/dripforge/announcement-banner-settings").AnnouncementBannerSettings
  /** Kundenkategorien / -gruppen mit Rabatt und erlaubten Versandarten */
  customerCategories?: import("@/lib/dripforge/customer-categories").CustomerCategory[]
  /** Gewichtsstaffeln für Versandpreise (optional) */
  shippingTiers?: import("@/lib/dripforge/shipping-tiers").ShippingTiersSettings
  /** Dankesseite-Animation (Checkout Success) */
  thanksPage?: import("@/lib/dripforge/thanks-page-settings").ThanksPageSettings
  updatedAt: string
}

export type AdminProduct = Product & {
  createdAt?: string
  updatedAt?: string
}

export function getPaymentMethodLabel(
  method: PaymentMethodId,
  checkout: Pick<CheckoutRuntimeConfig, "twintGatewayAktiv">
): string {
  switch (method) {
    case "card":
      return "Kreditkarte"
    case "invoice":
      return "Kauf auf Rechnung"
    case "cash":
      return "Barzahlung bei Abholung"
    case "twint":
      // Offizieller TWINT-Zahlungslink (Checkout) — Gateway-Flag nur noch Label-Hinweis
      return checkout.twintGatewayAktiv ? "TWINT (Gateway)" : "TWINT"
    default:
      return method
  }
}
