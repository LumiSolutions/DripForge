import type { CheckoutRuntimeConfig } from "@/lib/dripforge/checkout-config"
import type {
  OrderAddress,
  OrderPayload,
} from "@/lib/dripforge/submit-order"
import type { CartItem, Product } from "@/lib/dripforge/types"
import type { PaymentMethodId, ShippingMethodId } from "@/lib/dripforge/checkout-config"

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

/** Produktions-Cockpit (Kanban), unabhängig vom Shop-Bestellstatus. */
export type ProductionStatus =
  | "bereit_fuer_produktion"
  | "in_produktion"
  | "qualitaetskontrolle"
  | "bereit_fuer_versand"

export const DEFAULT_PRODUCTION_STATUS: ProductionStatus = "bereit_fuer_produktion"

export type StoredOrderItem = CartItem & {
  leitbildUrl?: string | null
}

export type StoredOrder = {
  orderId: string
  createdAt: string
  status: OrderStatus
  /** Kanban-Spalte im Produktions-Cockpit */
  productionStatus?: ProductionStatus
  kundennummer?: string
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
}

export type CompanySettings = {
  firmenname: string
  firmenAdresse: string
  iban: string
  bankname: string
  kontaktEmail: string
}

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  firmenname: "DripForge",
  firmenAdresse: "Pfäffikon ZH\nSchweiz",
  iban: "",
  bankname: "",
  kontaktEmail: "drip-forge@outlook.com",
}

export type StoredCustomer = {
  kundennummer: string
  email: string
  billing: OrderAddress
  delivery?: OrderAddress
  orderIds: string[]
  createdAt: string
  updatedAt: string
}

export type LaunchSettings = {
  /** true = Coming-Soon-Wand ist dauerhaft deaktiviert */
  shopLive: boolean
}

export const DEFAULT_LAUNCH_SETTINGS: LaunchSettings = {
  shopLive: false,
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

export type AdminSettings = {
  checkout: CheckoutRuntimeConfig
  company: CompanySettings
  launch: LaunchSettings
  services: ServiceVisibilitySettings
  /** Support-Kampagne (/support) im Header und als Route sichtbar */
  isSupportPageActive: boolean
  updatedAt: string
}

export type AdminProduct = Product & {
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
    case "twint":
      return checkout.twintGatewayAktiv
        ? "TWINT (Gateway)"
        : "TWINT manuell"
    default:
      return method
  }
}
