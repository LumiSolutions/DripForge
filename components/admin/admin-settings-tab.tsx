"use client"

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react"
import Image from "next/image"
import { Loader2, Rocket, Save, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { adminUi } from "@/lib/admin/admin-ui-classes"
import type {
  CompanySettings,
  LaunchSettings,
} from "@/lib/admin/types"
import {
  DEFAULT_COMPANY_SETTINGS,
  DEFAULT_LAUNCH_SETTINGS,
  DEFAULT_SERVICE_VISIBILITY,
  DEFAULT_SHOP_CONFIGURATORS,
} from "@/lib/admin/types"
import { AdminPasswordChangeSection } from "@/components/admin/admin-password-change-section"
import { AdminTesterPasswordSection } from "@/components/admin/admin-tester-password-section"
import { AdminTwoFactorSection } from "@/components/admin/admin-two-factor-section"
import { AdminIndividualPricingSection } from "@/components/admin/admin-individual-pricing-section"
import { AdminManagedCatalogSection } from "@/components/admin/admin-managed-catalog-section"
import {
  applyManagedCatalogToSettings,
  normalizeManagedCatalog,
  type ManagedCatalogItem,
} from "@/lib/dripforge/managed-catalog"
import type { LaserConfiguratorSettings } from "@/lib/admin/laser-configurator-types"
import { createDefaultLaserConfiguratorSettings } from "@/lib/admin/laser-configurator-types"
import type { CheckoutRuntimeConfig } from "@/lib/dripforge/checkout-config"
import {
  DEFAULT_CHECKOUT_RUNTIME_CONFIG,
  normalizeCheckoutRuntimeConfig,
} from "@/lib/dripforge/checkout-config"
import { buildSupportPageSettings } from "@/lib/dripforge/support-page-settings"
import {
  normalizeSupportFeatures,
  normalizeSupportMilestones,
  type SupportFeatureItem,
  type SupportMilestoneConfig,
} from "@/lib/dripforge/support-page-settings"
import { AdminSupportCampaignSection } from "@/components/admin/admin-support-campaign-section"
import {
  normalizeEnableOnboardingTour,
  normalizeOnboardingTourText,
  normalizeThemeInboundTourImageUrl,
  resolveThemeInboundTourImageUrl,
  shouldUseUnoptimizedThemeTourImage,
  THEME_DRIP_STORAGE_KEY,
  DEFAULT_ONBOARDING_TOUR_TEXT,
} from "@/lib/dripforge/theme-inbound-tour-settings"
import {
  normalizeEnableRewardPointsSystem,
} from "@/lib/dripforge/reward-points-settings"
import { normalizeCompanySettings } from "@/lib/dripforge/company-settings"
import {
  DEFAULT_ORDER_EMAIL_TEMPLATES,
  normalizeOrderEmailTemplates,
  type OrderEmailTemplates,
} from "@/lib/email/order-email-templates"
import {
  DEFAULT_ORDER_EMAIL_LAYOUT,
  normalizeOrderEmailLayout,
  type OrderEmailLayout,
} from "@/lib/email/order-email-layout"
import { AdminEmailTemplateBuilder } from "@/components/admin/admin-email-template-builder"
import {
  COUNTDOWN_TEMPLATE_OPTIONS,
  fromDatetimeLocalInput,
  getCountdownTemplateContent,
  resolveCountdownHeroImageUrl,
  shouldUseUnoptimizedCountdownHero,
  toDatetimeLocalInput,
} from "@/lib/dripforge/countdown-settings"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  DEFAULT_WISHLIST_ICON,
  normalizeWishlistIcon,
  normalizeWishlistIconCustomUrl,
  WISHLIST_ICON_LABELS,
  WISHLIST_ICON_PRESETS,
  type WishlistIconPreset,
} from "@/lib/dripforge/wishlist-icon-settings"
import {
  DEFAULT_ANNOUNCEMENT_BANNER,
  normalizeAnnouncementBanner,
  type AnnouncementBannerSettings,
} from "@/lib/dripforge/announcement-banner-settings"
import {
  DEFAULT_THANKS_PAGE_SETTINGS,
  normalizeThanksPageSettings,
  type ThanksPageSettings,
} from "@/lib/dripforge/thanks-page-settings"

export type AdminSettingsSection =
  | "shop"
  | "countdown"
  | "onboarding"
  | "support"
  | "services"
  | "laser"
  | "loyalty"
  | "email"
  | "accounting"

const SECTION_HEADERS: Record<
  AdminSettingsSection,
  { title: string; subtitle: string }
> = {
  shop: {
    title: "Shop-Einstellungen",
    subtitle: "Shop-Status, Admin-Zugang und Shop-Grundeinstellungen",
  },
  countdown: {
    title: "Coming-Soon / Countdown",
    subtitle: "Vorlage, Texte, Ziel-Datum und Teaser-Bild für die Countdown-Landingpage",
  },
  onboarding: {
    title: "Erstbesucher-Onboarding",
    subtitle: "Steuert die einmalige Theme-Hilfe für neue Besucher im Shop-Header",
  },
  support: {
    title: "Support-Kampagne",
    subtitle:
      "Sichtbarkeit, Meilensteine und unterstützte Features der Support-Kampagne",
  },
  services: {
    title: "Dienstleistungen & Konfiguratoren",
    subtitle: "Steuert Navigation, Startseite und Shop-Konfigurator-Karten",
  },
  laser: {
    title: "Laser-Konfigurator",
    subtitle: "Kunden-Einsendung und Instruktionen für die personalisierte Laserkreation",
  },
  loyalty: {
    title: "Treuepunkte",
    subtitle: "Steuert Kaufen, Einlösen und Anzeige von Treuepunkten",
  },
  email: {
    title: "E-Mail-Vorlagen",
    subtitle:
      "Visueller Editor für Layout und Texte der Kunden-Bestellbestätigung",
  },
  accounting: {
    title: "Finanz-Setup",
    subtitle:
      "Checkout & MwSt., Firmendaten und Bankverbindung für Impressum und Rechnungszahlung",
  },
}

export function AdminSettingsTab({
  section = "shop",
}: {
  section?: AdminSettingsSection
}) {
  const show = (...ids: AdminSettingsSection[]) => ids.includes(section)
  const header = SECTION_HEADERS[section]
  const [checkout, setCheckout] = useState<CheckoutRuntimeConfig>(
    DEFAULT_CHECKOUT_RUNTIME_CONFIG
  )
  const [company, setCompany] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS)
  const [managedCatalog, setManagedCatalog] = useState<ManagedCatalogItem[]>(() =>
    normalizeManagedCatalog(null, DEFAULT_SERVICE_VISIBILITY, DEFAULT_SHOP_CONFIGURATORS)
  )
  const [laserConfigurator, setLaserConfigurator] = useState<LaserConfiguratorSettings>(
    createDefaultLaserConfiguratorSettings()
  )
  const [shopLive, setShopLive] = useState(false)
  const [launch, setLaunch] = useState<LaunchSettings>(DEFAULT_LAUNCH_SETTINGS)
  const [showSupportOnMainSite, setShowSupportOnMainSite] = useState(false)
  const [showSupportOnCountdownPage, setShowSupportOnCountdownPage] = useState(false)
  const [supportMilestones, setSupportMilestones] = useState<
    SupportMilestoneConfig[]
  >(() => normalizeSupportMilestones(undefined))
  const [supportFeatures, setSupportFeatures] = useState<SupportFeatureItem[]>(
    () => normalizeSupportFeatures(undefined)
  )
  const [enableOnboardingTour, setEnableOnboardingTour] = useState(true)
  const [onboardingTourText, setOnboardingTourText] = useState("")
  const [enableRewardPointsSystem, setEnableRewardPointsSystem] = useState(true)
  const [loyaltyEarnPercent, setLoyaltyEarnPercent] = useState("100")
  const [loyaltyPointValueChf, setLoyaltyPointValueChf] = useState("1")
  const [loyaltyPointsExpiryMonths, setLoyaltyPointsExpiryMonths] = useState("6")
  const [orderEmailTemplates, setOrderEmailTemplates] =
    useState<OrderEmailTemplates>({ ...DEFAULT_ORDER_EMAIL_TEMPLATES })
  const [orderEmailLayout, setOrderEmailLayout] = useState<OrderEmailLayout>(
    () => ({
      ...DEFAULT_ORDER_EMAIL_LAYOUT,
      sectionOrder: [...DEFAULT_ORDER_EMAIL_LAYOUT.sectionOrder],
    })
  )
  const [documentLogoUrl, setDocumentLogoUrl] = useState<string | null>(null)
  const [themeInboundTourImageUrl, setThemeInboundTourImageUrl] = useState<string | null>(
    null
  )
  const [uploadingThemeTourImage, setUploadingThemeTourImage] = useState(false)
  const [uploadingCountdownHero, setUploadingCountdownHero] = useState(false)
  const [uploadingWishlistIcon, setUploadingWishlistIcon] = useState(false)
  const themeTourImageInputRef = useRef<HTMLInputElement>(null)
  const countdownHeroInputRef = useRef<HTMLInputElement>(null)
  const wishlistIconInputRef = useRef<HTMLInputElement>(null)
  const [wishlistIcon, setWishlistIcon] =
    useState<WishlistIconPreset>(DEFAULT_WISHLIST_ICON)
  const [wishlistIconCustomUrl, setWishlistIconCustomUrl] = useState<string | null>(
    null
  )
  const [announcementBanner, setAnnouncementBanner] =
    useState<AnnouncementBannerSettings>({ ...DEFAULT_ANNOUNCEMENT_BANNER })
  const [thanksPage, setThanksPage] = useState<ThanksPageSettings>({
    ...DEFAULT_THANKS_PAGE_SETTINGS,
  })
  const [goingLive, setGoingLive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/settings")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Laden fehlgeschlagen")
      const laserRes = await fetch("/api/admin/laser-configurator")
      const laserData = laserRes.ok ? await laserRes.json() : null
      setCheckout(
        normalizeCheckoutRuntimeConfig(
          data.checkout ?? DEFAULT_CHECKOUT_RUNTIME_CONFIG
        )
      )
      setCompany(normalizeCompanySettings(data.company))
      setShopLive(Boolean(data.launch?.shopLive))
      setLaunch({
        ...DEFAULT_LAUNCH_SETTINGS,
        ...data.launch,
      })
      const support = buildSupportPageSettings(data)
      setShowSupportOnMainSite(support.showSupportOnMainSite)
      setShowSupportOnCountdownPage(support.showSupportOnCountdownPage)
      setSupportMilestones(normalizeSupportMilestones(data.supportMilestones))
      setSupportFeatures(normalizeSupportFeatures(data.supportFeatures))
      setEnableOnboardingTour(
        normalizeEnableOnboardingTour(
          data.enableOnboardingTour ?? data.enableThemeInboundTour
        )
      )
      setOnboardingTourText(normalizeOnboardingTourText(data.onboardingTourText))
      setEnableRewardPointsSystem(
        normalizeEnableRewardPointsSystem(data.enableRewardPointsSystem)
      )
      setLoyaltyEarnPercent(
        String(
          Number.isFinite(Number(data.loyaltyEarnPercent))
            ? data.loyaltyEarnPercent
            : 100
        )
      )
      setLoyaltyPointValueChf(
        String(
          Number.isFinite(Number(data.loyaltyPointValueChf)) &&
            Number(data.loyaltyPointValueChf) > 0
            ? data.loyaltyPointValueChf
            : 1
        )
      )
      setLoyaltyPointsExpiryMonths(
        String(
          Number.isFinite(Number(data.loyaltyPointsExpiryMonths))
            ? data.loyaltyPointsExpiryMonths
            : 6
        )
      )
      setOrderEmailTemplates(
        normalizeOrderEmailTemplates(data.orderEmailTemplates)
      )
      setOrderEmailLayout(normalizeOrderEmailLayout(data.orderEmailLayout))
      setThemeInboundTourImageUrl(
        normalizeThemeInboundTourImageUrl(data.themeInboundTourImageUrl)
      )
      setWishlistIcon(normalizeWishlistIcon(data.wishlistIcon))
      setWishlistIconCustomUrl(
        normalizeWishlistIconCustomUrl(data.wishlistIconCustomUrl)
      )
      setAnnouncementBanner(
        normalizeAnnouncementBanner(data.announcementBanner)
      )
      setThanksPage(normalizeThanksPageSettings(data.thanksPage))
      setManagedCatalog(
        normalizeManagedCatalog(
          data.managedCatalog,
          data.services,
          data.shopConfigurators
        )
      )
      if (laserData && !laserData.error) {
        setLaserConfigurator({
          ...createDefaultLaserConfiguratorSettings(),
          ...laserData,
        })
      }
      try {
        const docRes = await fetch("/api/admin/document-template", {
          cache: "no-store",
        })
        if (docRes.ok) {
          const docData = (await docRes.json()) as { logoUrl?: string | null }
          setDocumentLogoUrl(
            typeof docData.logoUrl === "string" && docData.logoUrl.trim()
              ? docData.logoUrl.trim()
              : null
          )
        }
      } catch {
        /* optional branding */
      }
    } catch (err) {
      console.warn("Admin: Einstellungen konnten nicht geladen werden.", err)
      setError(
        err instanceof Error
          ? err.message
          : "Einstellungen konnten nicht geladen werden."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const saveSettings = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const applied = applyManagedCatalogToSettings(managedCatalog)
      setManagedCatalog(applied.managedCatalog)

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkout,
          company,
          services: applied.services,
          shopConfigurators: applied.shopConfigurators,
          managedCatalog: applied.managedCatalog,
          showSupportOnMainSite,
          showSupportOnCountdownPage,
          supportMilestones,
          supportFeatures,
          enableOnboardingTour,
          onboardingTourText,
          themeInboundTourImageUrl,
          enableRewardPointsSystem,
          loyaltyEarnPercent: Number(loyaltyEarnPercent),
          loyaltyPointValueChf: Number(loyaltyPointValueChf),
          loyaltyPointsExpiryMonths: Number(loyaltyPointsExpiryMonths),
          orderEmailTemplates,
          orderEmailLayout,
          launch,
          wishlistIcon,
          wishlistIconCustomUrl,
          announcementBanner,
          thanksPage,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Speichern fehlgeschlagen")

      const laserRes = await fetch("/api/admin/laser-configurator", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(laserConfigurator),
      })
      const laserData = laserRes.ok ? await laserRes.json() : null
      if (!laserRes.ok) {
        const laserErr = laserData as { error?: string }
        throw new Error(laserErr.error ?? "Laser-Konfigurator konnte nicht gespeichert werden.")
      }
      setCheckout(normalizeCheckoutRuntimeConfig(data.checkout))
      setCompany(normalizeCompanySettings(data.company))
      setLaunch({
        ...DEFAULT_LAUNCH_SETTINGS,
        ...data.launch,
      })
      setShopLive(Boolean(data.launch?.shopLive))
      const support = buildSupportPageSettings(data)
      setShowSupportOnMainSite(support.showSupportOnMainSite)
      setShowSupportOnCountdownPage(support.showSupportOnCountdownPage)
      setSupportMilestones(normalizeSupportMilestones(data.supportMilestones))
      setSupportFeatures(normalizeSupportFeatures(data.supportFeatures))
      setEnableOnboardingTour(
        normalizeEnableOnboardingTour(
          data.enableOnboardingTour ?? data.enableThemeInboundTour
        )
      )
      setOnboardingTourText(normalizeOnboardingTourText(data.onboardingTourText))
      setEnableRewardPointsSystem(
        normalizeEnableRewardPointsSystem(data.enableRewardPointsSystem)
      )
      setLoyaltyEarnPercent(
        String(
          Number.isFinite(Number(data.loyaltyEarnPercent))
            ? data.loyaltyEarnPercent
            : 100
        )
      )
      setLoyaltyPointValueChf(
        String(
          Number.isFinite(Number(data.loyaltyPointValueChf)) &&
            Number(data.loyaltyPointValueChf) > 0
            ? data.loyaltyPointValueChf
            : 1
        )
      )
      setLoyaltyPointsExpiryMonths(
        String(
          Number.isFinite(Number(data.loyaltyPointsExpiryMonths))
            ? data.loyaltyPointsExpiryMonths
            : 6
        )
      )
      setOrderEmailTemplates(
        normalizeOrderEmailTemplates(data.orderEmailTemplates)
      )
      setOrderEmailLayout(normalizeOrderEmailLayout(data.orderEmailLayout))
      setThemeInboundTourImageUrl(
        normalizeThemeInboundTourImageUrl(data.themeInboundTourImageUrl)
      )
      setWishlistIcon(normalizeWishlistIcon(data.wishlistIcon))
      setWishlistIconCustomUrl(
        normalizeWishlistIconCustomUrl(data.wishlistIconCustomUrl)
      )
      setAnnouncementBanner(
        normalizeAnnouncementBanner(data.announcementBanner)
      )
      setThanksPage(normalizeThanksPageSettings(data.thanksPage))
      setManagedCatalog(
        normalizeManagedCatalog(
          data.managedCatalog,
          data.services,
          data.shopConfigurators
        )
      )
      if (laserData && !laserData.error) {
        setLaserConfigurator({
          ...createDefaultLaserConfiguratorSettings(),
          ...laserData,
        })
      }
      setSuccess("Einstellungen gespeichert — Shop wird aktualisiert.")
    } catch (err) {
      console.warn("Admin: Einstellungen konnten nicht gespeichert werden.", err)
      setError(
        err instanceof Error
          ? err.message
          : "Einstellungen konnten nicht gespeichert werden."
      )
    } finally {
      setSaving(false)
    }
  }

  const goLive = async () => {
    if (
      !confirm(
        "Website jetzt offiziell live schalten? Die Coming-Soon-Seite wird für alle Besucher dauerhaft deaktiviert."
      )
    ) {
      return
    }

    setGoingLive(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/admin/settings/go-live", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Live-Schaltung fehlgeschlagen")
      setShopLive(true)
      setSuccess(
        "Website ist offiziell live — Coming Soon ist für alle Besucher deaktiviert."
      )
    } catch (err) {
      console.warn("Admin: Live-Schaltung fehlgeschlagen.", err)
      setError(
        err instanceof Error ? err.message : "Live-Schaltung fehlgeschlagen."
      )
    } finally {
      setGoingLive(false)
    }
  }

  const handleResetThemeTourPreview = () => {
    localStorage.removeItem(THEME_DRIP_STORAGE_KEY)
    window.location.reload()
  }

  const handleThemeTourImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setUploadingThemeTourImage(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/admin/settings/theme-tour-image", {
        method: "POST",
        credentials: "include",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? "Upload fehlgeschlagen")
      }

      setThemeInboundTourImageUrl(
        normalizeThemeInboundTourImageUrl(data.themeInboundTourImageUrl)
      )
      setSuccess("Onboarding-Tropfen Bild hochgeladen — live im Shop aktiv.")
    } catch (err) {
      console.warn("Admin: Theme-Tour-Bild-Upload fehlgeschlagen.", err)
      setError(
        err instanceof Error
          ? err.message
          : "Onboarding-Tropfen Bild konnte nicht hochgeladen werden."
      )
    } finally {
      setUploadingThemeTourImage(false)
    }
  }

  const handleCountdownHeroUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setUploadingCountdownHero(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/admin/settings/countdown-hero-image", {
        method: "POST",
        credentials: "include",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? "Upload fehlgeschlagen")
      }

      setLaunch((prev) => ({
        ...prev,
        heroImageUrl: data.heroImageUrl ?? prev.heroImageUrl,
      }))
      setSuccess("Countdown-Teaser-Bild hochgeladen — live auf der Coming-Soon-Seite.")
    } catch (err) {
      console.warn("Admin: Countdown-Hero-Upload fehlgeschlagen.", err)
      setError(
        err instanceof Error
          ? err.message
          : "Countdown-Teaser-Bild konnte nicht hochgeladen werden."
      )
    } finally {
      setUploadingCountdownHero(false)
    }
  }

  const countdownTemplatePreview = getCountdownTemplateContent(launch.countdownTemplate)
  const countdownHeroPreview = resolveCountdownHeroImageUrl(launch.heroImageUrl)

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-24", adminUi.loader)}>
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Einstellungen werden geladen…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className={cn("text-xl font-bold", adminUi.heading)}>
          {header.title}
        </h2>
        <p className={cn("text-sm", adminUi.muted)}>
          {header.subtitle}
        </p>
      </div>

      {error && <p className={adminUi.errorLg}>{error}</p>}
      {success && <p className={adminUi.success}>{success}</p>}

      <div className="space-y-6">
        {show("shop") && (
          <Card
            className={cn(
              adminUi.card,
              shopLive
                ? "border-emerald-500/40"
                : "border-orange-500/30 ring-1 ring-orange-500/20"
            )}
          >
            <CardContent className="space-y-4 p-6">
              <div>
                <h3 className={cn("text-lg font-bold", adminUi.heading)}>
                  Shop-Status (Aktiv / Inaktiv / Wartung)
                </h3>
                <p className={cn("mt-1 text-sm", adminUi.muted)}>
                  {shopLive
                    ? "Aktiv: Die Website ist offiziell live. Alle Besucher sehen den vollen Shop."
                    : "Inaktiv / Wartung: Vorschau-Modus aktiv — Besucher sehen die Coming-Soon-Seite bis zum Launch oder zur manuellen Freischaltung."}
                </p>
              </div>

              {shopLive ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Status: Live seit Freischaltung im Admin
                </div>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  onClick={() => void goLive()}
                  disabled={goingLive}
                  className={cn(
                    "h-auto w-full py-4 text-base font-bold uppercase tracking-wide",
                    adminUi.primaryBtn
                  )}
                >
                  {goingLive ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Rocket className="mr-2 h-5 w-5" />
                  )}
                  Website offiziell live schalten
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {show("shop") && (
          <Card className={adminUi.card}>
            <CardContent className="space-y-4 p-6">
              <div>
                <h3 className={cn("text-lg font-bold", adminUi.heading)}>
                  Favoriten- / Wunschzettel-Symbol
                </h3>
                <p className={cn("mt-1 text-sm", adminUi.muted)}>
                  Wählen Sie das Symbol auf den Produktkarten im Shop. Standard ist der Stern (★).
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {WISHLIST_ICON_PRESETS.filter((p) => p !== "custom").map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setWishlistIcon(preset)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border px-3 py-3 text-sm transition",
                      wishlistIcon === preset
                        ? "border-orange-500 bg-orange-500/10"
                        : "border-border/60 hover:border-orange-500/40"
                    )}
                  >
                    <span className="text-xl leading-none" aria-hidden>
                      {preset === "star"
                        ? "★"
                        : preset === "heart"
                          ? "♥"
                          : preset === "bookmark"
                            ? "🔖"
                            : "🔥"}
                    </span>
                    <span className={adminUi.muted}>
                      {WISHLIST_ICON_LABELS[preset].replace(/\s*\(.*\)$/, "")}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setWishlistIcon("custom")}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border px-3 py-3 text-sm transition",
                    wishlistIcon === "custom"
                      ? "border-orange-500 bg-orange-500/10"
                      : "border-border/60 hover:border-orange-500/40"
                  )}
                >
                  <span className="text-xl leading-none" aria-hidden>
                    {wishlistIconCustomUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={wishlistIconCustomUrl}
                        alt=""
                        className="mx-auto h-6 w-6 object-contain"
                      />
                    ) : (
                      "SVG"
                    )}
                  </span>
                  <span className={adminUi.muted}>Custom</span>
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={wishlistIconInputRef}
                  type="file"
                  accept=".svg,image/svg+xml,image/png,image/webp"
                  className="hidden"
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    const file = event.target.files?.[0]
                    event.target.value = ""
                    if (!file) return
                    void (async () => {
                      setUploadingWishlistIcon(true)
                      setError(null)
                      try {
                        const form = new FormData()
                        form.append("file", file)
                        const res = await fetch(
                          "/api/admin/settings/wishlist-icon",
                          { method: "POST", body: form }
                        )
                        const data = (await res.json()) as {
                          error?: string
                          wishlistIcon?: WishlistIconPreset
                          wishlistIconCustomUrl?: string | null
                        }
                        if (!res.ok) {
                          throw new Error(data.error ?? "Upload fehlgeschlagen")
                        }
                        setWishlistIcon(
                          normalizeWishlistIcon(data.wishlistIcon ?? "custom")
                        )
                        setWishlistIconCustomUrl(
                          normalizeWishlistIconCustomUrl(data.wishlistIconCustomUrl)
                        )
                        setSuccess("Custom-Wunschzettel-Symbol hochgeladen.")
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Upload fehlgeschlagen"
                        )
                      } finally {
                        setUploadingWishlistIcon(false)
                      }
                    })()
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingWishlistIcon}
                  onClick={() => wishlistIconInputRef.current?.click()}
                  className={adminUi.outlineBtn}
                >
                  {uploadingWishlistIcon ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Custom-SVG hochladen
                </Button>
                {wishlistIconCustomUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setWishlistIconCustomUrl(null)
                      if (wishlistIcon === "custom") setWishlistIcon(DEFAULT_WISHLIST_ICON)
                    }}
                  >
                    Custom entfernen
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {show("shop") && (
          <Card className={adminUi.card}>
            <CardContent className="space-y-4 p-6">
              <div>
                <h3 className={cn("text-lg font-bold", adminUi.heading)}>
                  Ankündigungs-Banner
                </h3>
                <p className={cn("mt-1 text-sm", adminUi.muted)}>
                  Optionaler Hinweis oben im Shop (z. B. Rabattaktion).
                </p>
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="announcement-active" className={adminUi.label}>
                  Banner aktiv
                </Label>
                <Switch
                  id="announcement-active"
                  checked={announcementBanner.active}
                  onCheckedChange={(checked) =>
                    setAnnouncementBanner((prev) => ({
                      ...prev,
                      active: checked,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="announcement-text" className={adminUi.label}>
                  Banner-Text
                </Label>
                <Input
                  id="announcement-text"
                  value={announcementBanner.text}
                  onChange={(e) =>
                    setAnnouncementBanner((prev) => ({
                      ...prev,
                      text: e.target.value,
                    }))
                  }
                  placeholder="z. B. Frühlingssale — 10 % auf alles"
                  className={adminUi.input}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="announcement-code" className={adminUi.label}>
                    Rabattcode (optional)
                  </Label>
                  <Input
                    id="announcement-code"
                    value={announcementBanner.discountCode}
                    onChange={(e) =>
                      setAnnouncementBanner((prev) => ({
                        ...prev,
                        discountCode: e.target.value,
                      }))
                    }
                    placeholder="SAVE10"
                    className={adminUi.input}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="announcement-link" className={adminUi.label}>
                    Link-URL (optional)
                  </Label>
                  <Input
                    id="announcement-link"
                    value={announcementBanner.linkUrl}
                    onChange={(e) =>
                      setAnnouncementBanner((prev) => ({
                        ...prev,
                        linkUrl: e.target.value,
                      }))
                    }
                    placeholder="/shop oder https://…"
                    className={adminUi.input}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className={adminUi.label}>Stil</Label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="announcement-style"
                      checked={announcementBanner.style === "unicolor"}
                      onChange={() =>
                        setAnnouncementBanner((prev) => ({
                          ...prev,
                          style: "unicolor",
                        }))
                      }
                    />
                    Einfarbig
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="announcement-style"
                      checked={announcementBanner.style === "animated-gradient"}
                      onChange={() =>
                        setAnnouncementBanner((prev) => ({
                          ...prev,
                          style: "animated-gradient",
                        }))
                      }
                    />
                    Animierter Verlauf
                  </label>
                </div>
              </div>
              {announcementBanner.style === "unicolor" && (
                <div className="space-y-2">
                  <Label htmlFor="announcement-color" className={adminUi.label}>
                    Hintergrundfarbe
                  </Label>
                  <div className="flex items-center gap-3">
                    <input
                      id="announcement-color"
                      type="color"
                      value={
                        /^#[0-9a-fA-F]{6}$/.test(announcementBanner.backgroundColor)
                          ? announcementBanner.backgroundColor
                          : "#ea580c"
                      }
                      onChange={(e) =>
                        setAnnouncementBanner((prev) => ({
                          ...prev,
                          backgroundColor: e.target.value,
                        }))
                      }
                      className="h-10 w-14 cursor-pointer rounded border border-border/60 bg-transparent"
                    />
                    <Input
                      value={announcementBanner.backgroundColor}
                      onChange={(e) =>
                        setAnnouncementBanner((prev) => ({
                          ...prev,
                          backgroundColor: e.target.value,
                        }))
                      }
                      className={cn("max-w-[140px]", adminUi.input)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {show("shop") && (
          <Card className={adminUi.card}>
            <CardContent className="space-y-4 p-6">
              <div>
                <h3 className={cn("text-lg font-bold", adminUi.heading)}>
                  Dankesseite nach Bestellung
                </h3>
                <p className={cn("mt-1 text-sm", adminUi.muted)}>
                  Darstellung auf der Erfolgsseite und im Checkout-Modal.
                </p>
              </div>
              <div className="space-y-2">
                <Label className={adminUi.label}>Darstellung</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
                  {(
                    [
                      ["text", "Nur Text"],
                      ["interactive", "Interaktive Animation"],
                      ["media", "Eigene Medien"],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="thanks-mode"
                        checked={thanksPage.animationMode === value}
                        onChange={() =>
                          setThanksPage((prev) => ({
                            ...prev,
                            animationMode: value,
                          }))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              {thanksPage.animationMode === "media" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="thanks-media-url" className={adminUi.label}>
                      Medien-URL (MP4 / GIF / Lottie-JSON)
                    </Label>
                    <Input
                      id="thanks-media-url"
                      value={thanksPage.mediaUrl ?? ""}
                      onChange={(e) =>
                        setThanksPage((prev) => ({
                          ...prev,
                          mediaUrl: e.target.value.trim() || null,
                        }))
                      }
                      placeholder="https://…"
                      className={adminUi.input}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={adminUi.label}>Medien-Typ</Label>
                    <Select
                      value={thanksPage.mediaKind ?? "auto"}
                      onValueChange={(value) =>
                        setThanksPage((prev) => ({
                          ...prev,
                          mediaKind:
                            value === "mp4" ||
                            value === "gif" ||
                            value === "lottie"
                              ? value
                              : null,
                        }))
                      }
                    >
                      <SelectTrigger className={cn("w-full", adminUi.input)}>
                        <SelectValue placeholder="Automatisch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Automatisch</SelectItem>
                        <SelectItem value="mp4">MP4 / Video</SelectItem>
                        <SelectItem value="gif">GIF</SelectItem>
                        <SelectItem value="lottie">Lottie</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {show("shop") && (
          <AdminTwoFactorSection />
        )}

        {show("shop") && (
          <AdminPasswordChangeSection />
        )}

        {show("shop") && (
          <AdminTesterPasswordSection />
        )}

        {show("countdown") && (
          <Card className={adminUi.card}>
            <CardContent className="space-y-5 p-6">
              <div>
                <h3 className={cn("text-lg font-bold", adminUi.heading)}>
                  Coming-Soon / Countdown
                </h3>
                <p className={cn("mt-1 text-sm", adminUi.muted)}>
                  Vorlage, Texte, Ziel-Datum und Teaser-Bild für die Countdown-Landingpage.
                  Wiederverwendbar für Shop-Updates und Wartungsarbeiten.
                </p>
              </div>

              <div className={cn("space-y-2 rounded-xl border p-4", adminUi.section)}>
                <Label className={adminUi.label}>Vorlage</Label>
                <Select
                  value={launch.countdownTemplate}
                  onValueChange={(value) =>
                    setLaunch((prev) => ({
                      ...prev,
                      countdownTemplate: value as LaunchSettings["countdownTemplate"],
                    }))
                  }
                >
                  <SelectTrigger className={cn("w-full max-w-md", adminUi.input)}>
                    <SelectValue placeholder="Vorlage wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTDOWN_TEMPLATE_OPTIONS.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className={cn("text-xs", adminUi.muted)}>
                  Subtext: «{countdownTemplatePreview.teaser}»
                </p>
              </div>

              <div className={cn("space-y-2 rounded-xl border p-4", adminUi.section)}>
                <Label htmlFor="countdownLabel" className={adminUi.label}>
                  Titel über der Uhr
                </Label>
                <Input
                  id="countdownLabel"
                  value={launch.countdownLabel}
                  onChange={(event) =>
                    setLaunch((prev) => ({
                      ...prev,
                      countdownLabel: event.target.value.slice(0, 120),
                    }))
                  }
                  placeholder="COUNTDOWN ZUM LAUNCH"
                  className={adminUi.input}
                />
              </div>

              <div className={cn("space-y-2 rounded-xl border p-4", adminUi.section)}>
                <Label htmlFor="blockedPath" className={adminUi.label}>
                  Gesperrte Unterseite / Pfad
                </Label>
                <Input
                  id="blockedPath"
                  value={launch.blockedPath ?? ""}
                  onChange={(event) =>
                    setLaunch((prev) => ({
                      ...prev,
                      blockedPath: event.target.value,
                    }))
                  }
                  placeholder="/laser"
                  className={adminUi.input}
                />
                <p className={cn("text-xs", adminUi.muted)}>
                  Nur diese Route zeigt den Countdown, solange das Ziel-Datum nicht
                  erreicht ist (z. B. <code className="text-[11px]">/laser</code> oder{" "}
                  <code className="text-[11px]">/shop/neu</code>). Feld leer lassen =
                  gesamte Website (Coming-Soon wie bisher). Tester und Admins mit
                  Vorschau-Zugang sehen die Seite normal.
                </p>
              </div>

              <div className={cn("space-y-2 rounded-xl border p-4", adminUi.section)}>
                <Label htmlFor="countdownTargetAt" className={adminUi.label}>
                  Ziel-Datum & Uhrzeit
                </Label>
                <Input
                  id="countdownTargetAt"
                  type="datetime-local"
                  value={toDatetimeLocalInput(launch.targetAt)}
                  onChange={(event) =>
                    setLaunch((prev) => ({
                      ...prev,
                      targetAt: fromDatetimeLocalInput(event.target.value),
                    }))
                  }
                  className={cn("max-w-xs", adminUi.input)}
                />
                <p className={cn("text-xs", adminUi.muted)}>
                  Der Countdown zählt live bis zu diesem Zeitpunkt (lokale Zeitzone).
                </p>
              </div>

              <div className={cn("rounded-xl border p-4", adminUi.section)}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="flex shrink-0 flex-col items-center gap-2">
                    <div className="relative h-36 w-36 overflow-hidden rounded-xl border border-border/60 bg-background/40">
                      <Image
                        src={countdownHeroPreview}
                        alt="Vorschau Countdown-Teaser"
                        fill
                        unoptimized={shouldUseUnoptimizedCountdownHero(countdownHeroPreview)}
                        className="object-contain p-2"
                      />
                    </div>
                    <p className={cn("text-center text-[11px]", adminUi.muted)}>
                      Aktive Vorschau
                    </p>
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="space-y-1">
                      <Label className={cn("text-sm font-semibold", adminUi.heading)}>
                        Teaser-Bild (Coming-Soon)
                      </Label>
                      <p className={cn("text-xs", adminUi.muted)}>
                        PNG, JPG oder WebP, max. 5 MB. Wird in Cosmos gespeichert und auf
                        der Countdown-Seite zentral angezeigt.
                      </p>
                    </div>

                    <input
                      ref={countdownHeroInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,.png,.jpg,.jpeg,.webp"
                      className="hidden"
                      onChange={(event) => void handleCountdownHeroUpload(event)}
                    />

                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploadingCountdownHero}
                      className={adminUi.input}
                      onClick={() => countdownHeroInputRef.current?.click()}
                    >
                      {uploadingCountdownHero ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Teaser-Bild hochladen
                    </Button>

                    {launch.heroImageUrl && (
                      <p className={cn("break-all text-[11px]", adminUi.muted)}>
                        Aktive URL: {launch.heroImageUrl}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {show("email") && (
          <Card className={adminUi.card}>
            <CardContent className="p-6">
              <AdminEmailTemplateBuilder
                templates={orderEmailTemplates}
                layout={orderEmailLayout}
                documentLogoUrl={documentLogoUrl}
                onTemplatesChange={setOrderEmailTemplates}
                onLayoutChange={setOrderEmailLayout}
              />
            </CardContent>
          </Card>
        )}

        {show("onboarding") && (
          <Card className={adminUi.card}>
            <CardContent className="space-y-4 p-6">
              <div>
                <h3 className={cn("text-base font-semibold", adminUi.accentTitle)}>
                  Erstbesucher-Onboarding
                </h3>
                <p className={cn("mt-1 text-sm", adminUi.muted)}>
                  Steuert die einmalige Theme-Hilfe für neue Besucher im Shop-Header.
                </p>
              </div>
              <div
                className={cn(
                  "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between",
                  adminUi.section
                )}
              >
                <div className="space-y-1 pr-2">
                  <Label className={cn("text-sm font-semibold", adminUi.heading)}>
                    Onboarding-Tour (Tropfen) aktivieren
                  </Label>
                  <p className={cn("text-xs", adminUi.muted)}>
                    Aktiviert die einmalige, tropfenförmige Onboarding-Frage für neue
                    Besucher im Shop-Header.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                  <Switch
                    checked={enableOnboardingTour}
                    onCheckedChange={setEnableOnboardingTour}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn("whitespace-normal text-left text-xs sm:max-w-[14rem]", adminUi.input)}
                    onClick={handleResetThemeTourPreview}
                  >
                    Tour-Vorschau zurücksetzen (LocalStorage löschen)
                  </Button>
                </div>
              </div>

              <div className={cn("space-y-2 rounded-xl border p-4", adminUi.section)}>
                <Label
                  htmlFor="onboardingTourText"
                  className={cn("text-sm font-semibold", adminUi.heading)}
                >
                  Inhalt der Frage im Tropfen
                </Label>
                <p className={cn("text-xs", adminUi.muted)}>
                  Zeilenumbrüche werden im Tropfen übernommen (Enter für neue Zeile). Feld leer
                  lassen, wenn im Tropfen kein Text angezeigt werden soll.
                </p>
                <Textarea
                  id="onboardingTourText"
                  value={onboardingTourText}
                  onChange={(event) =>
                    setOnboardingTourText(event.target.value.slice(0, 200))
                  }
                  rows={4}
                  className={cn("font-mono text-sm", adminUi.input)}
                  placeholder={DEFAULT_ONBOARDING_TOUR_TEXT}
                />
              </div>

              <div className={cn("rounded-xl border p-4", adminUi.section)}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="flex shrink-0 flex-col items-center gap-2">
                    <div className="relative h-36 w-28 overflow-hidden rounded-xl border border-border/60 bg-background/40 p-2">
                      <Image
                        src={resolveThemeInboundTourImageUrl(themeInboundTourImageUrl)}
                        alt="Vorschau Onboarding-Tropfen"
                        fill
                        unoptimized={shouldUseUnoptimizedThemeTourImage(
                          resolveThemeInboundTourImageUrl(themeInboundTourImageUrl)
                        )}
                        className="object-contain opacity-90"
                      />
                    </div>
                    <p className={cn("text-center text-[11px]", adminUi.muted)}>
                      Aktive Vorschau
                    </p>
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="space-y-1">
                      <Label className={cn("text-sm font-semibold", adminUi.heading)}>
                        Onboarding-Tropfen Bild hochladen
                      </Label>
                      <p className={cn("text-xs", adminUi.muted)}>
                        PNG oder WebP mit Transparenz, max. 2 MB. Wird sofort in Cosmos
                        gespeichert und für Erstbesucher live geschaltet.
                      </p>
                    </div>

                    <input
                      ref={themeTourImageInputRef}
                      type="file"
                      accept="image/png,image/webp,.png,.webp"
                      className="hidden"
                      onChange={(event) => void handleThemeTourImageUpload(event)}
                    />

                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploadingThemeTourImage}
                      className={adminUi.input}
                      onClick={() => themeTourImageInputRef.current?.click()}
                    >
                      {uploadingThemeTourImage ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Bild auswählen & hochladen
                    </Button>

                    {themeInboundTourImageUrl && (
                      <p className={cn("break-all text-[11px]", adminUi.muted)}>
                        Aktive URL: {themeInboundTourImageUrl}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {show("support") && (
          <>
          <Card className={adminUi.card}>
            <CardContent className="space-y-4 p-6">
              <div>
                <h3 className={cn("text-base font-semibold", adminUi.accentTitle)}>
                  Support-Kampagne
                </h3>
                <p className={cn("mt-1 text-sm", adminUi.muted)}>
                  Zwei unabhängige Schalter: Hauptwebsite (Header, /support) und
                  Countdown-Landingpage.
                </p>
              </div>
              <div
                className={cn(
                  "flex items-start justify-between gap-4 rounded-xl border p-4",
                  adminUi.section
                )}
              >
                <div className="space-y-1 pr-2">
                  <Label className={cn("text-sm font-semibold", adminUi.heading)}>
                    Support-Kampagne auf der Hauptwebsite anzeigen
                  </Label>
                  <p className={cn("text-xs", adminUi.muted)}>
                    Steuert «Unsere Mission» im Desktop-Header, Mobile-Icon und
                    Mobile-Menü. Direktaufrufe von /support sind erlaubt, wenn aktiv.
                  </p>
                </div>
                <Switch
                  checked={showSupportOnMainSite}
                  onCheckedChange={setShowSupportOnMainSite}
                />
              </div>
              <div
                className={cn(
                  "flex items-start justify-between gap-4 rounded-xl border p-4",
                  adminUi.section
                )}
              >
                <div className="space-y-1 pr-2">
                  <Label className={cn("text-sm font-semibold", adminUi.heading)}>
                    Support-Kampagne auf der Countdown-Landingpage anzeigen
                  </Label>
                  <p className={cn("text-xs", adminUi.muted)}>
                    Zeigt den Support-Link im Header der Coming-Soon-Seite, solange
                    der Shop noch nicht live ist.
                  </p>
                </div>
                <Switch
                  checked={showSupportOnCountdownPage}
                  onCheckedChange={setShowSupportOnCountdownPage}
                />
              </div>
            </CardContent>
          </Card>

          <Card className={adminUi.card}>
            <CardContent className="p-6">
              <AdminSupportCampaignSection
                milestones={supportMilestones}
                features={supportFeatures}
                onMilestonesChange={setSupportMilestones}
                onFeaturesChange={setSupportFeatures}
              />
            </CardContent>
          </Card>
          </>
        )}

        {show("services") && (
          <Card className={adminUi.card}>
            <CardContent className="space-y-6 p-6">
              <AdminManagedCatalogSection
                catalog={managedCatalog}
                onChange={setManagedCatalog}
              />
            </CardContent>
          </Card>
        )}


        {show("laser") && (
          <Card className={adminUi.card}>
            <CardContent className="space-y-4 p-6">
              <div>
                <h3 className={cn("text-base font-semibold", adminUi.accentTitle)}>
                  Laser-Konfigurator — Kunden-Einsendung
                </h3>
                <p className={cn("mt-1 text-sm", adminUi.muted)}>
                  Vorbereitung für «Eigenes Produkt einschicken & verarbeiten» bei der
                  Personalisierten Laserkreation. Sichtbar für Kunden nur bei aktiviertem Toggle.
                </p>
              </div>
              <div
                className={cn(
                  "flex items-start justify-between gap-4 rounded-xl border p-4",
                  adminUi.section
                )}
              >
                <div className="space-y-1 pr-2">
                  <Label className={cn("text-sm font-semibold", adminUi.heading)}>
                    Option: Kunden-Einsendung erlauben
                  </Label>
                  <p className={cn("text-xs", adminUi.muted)}>
                    Aktiviert die Einsende-Option im Laser-Konfigurator für Kunden.
                  </p>
                </div>
                <Switch
                  checked={laserConfigurator.allowCustomerShipping}
                  onCheckedChange={(checked) =>
                    setLaserConfigurator((prev) => ({
                      ...prev,
                      allowCustomerShipping: checked,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className={adminUi.label}>
                  Einsende-Instruktionen & Lieferadresse
                </Label>
                <Textarea
                  value={laserConfigurator.customerShippingInstructions}
                  onChange={(e) =>
                    setLaserConfigurator((prev) => ({
                      ...prev,
                      customerShippingInstructions: e.target.value,
                    }))
                  }
                  rows={5}
                  placeholder="Versandanleitung, Packhinweise, Lieferadresse …"
                  className={adminUi.input}
                />
              </div>
              <div>
                <h4 className={cn("mb-2 text-sm font-semibold", adminUi.heading)}>
                  Max. Gravurfläche (L × B × H)
                </h4>
                <p className={cn("mb-3 text-xs", adminUi.muted)}>
                  Wird im Laser-Konfigurator als Info-Banner angezeigt.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(
                    [
                      ["lengthMm", "Länge (mm)"],
                      ["widthMm", "Breite (mm)"],
                      ["heightMm", "Höhe (mm)"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="space-y-1">
                      <Label className={adminUi.label}>{label}</Label>
                      <Input
                        type="number"
                        min={1}
                        step="0.1"
                        value={laserConfigurator.maxWorkAreaMm[key]}
                        onChange={(e) =>
                          setLaserConfigurator((prev) => ({
                            ...prev,
                            maxWorkAreaMm: {
                              ...prev.maxWorkAreaMm,
                              [key]: Number(e.target.value) || 0,
                            },
                          }))
                        }
                        className={adminUi.input}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {show("laser") && <AdminIndividualPricingSection />}

        {show("loyalty") && (
          <Card className={adminUi.card}>
            <CardContent className="space-y-4 p-6">
              <div>
                <h3 className={cn("text-base font-semibold", adminUi.accentTitle)}>
                  Treuepunkte
                </h3>
                <p className={cn("mt-1 text-sm", adminUi.muted)}>
                  Steuert Kaufen, Einlösen und Anzeige von Treuepunkten im Konto und
                  Checkout.
                </p>
              </div>
              <div
                className={cn(
                  "flex items-start justify-between gap-4 rounded-xl border p-4",
                  adminUi.section
                )}
              >
                <div className="space-y-1 pr-2">
                  <Label className={cn("text-sm font-semibold", adminUi.heading)}>
                    Treuepunkte-System aktivieren
                  </Label>
                  <p className={cn("text-xs", adminUi.muted)}>
                    Deaktiviert alle Punkte-Funktionen im Shop: Kauf, Einlösung und
                    Anzeige im Kundenkonto sowie Checkout.
                  </p>
                </div>
                <Switch
                  checked={enableRewardPointsSystem}
                  onCheckedChange={setEnableRewardPointsSystem}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className={adminUi.label}>
                    Sammelrate: Gutschrift in % vom Einkaufswert
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={loyaltyEarnPercent}
                    onChange={(e) => setLoyaltyEarnPercent(e.target.value)}
                    className={adminUi.input}
                    disabled={!enableRewardPointsSystem}
                  />
                  <p className={cn("text-xs", adminUi.muted)}>
                    Standard 100&nbsp;%: Einkauf CHF 100 → 100 Punkte (1 CHF = 1 Punkt).
                    Bei 10&nbsp;%: CHF 100 → 10 Punkte.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className={adminUi.label}>
                    Einlösewert: CHF pro Punkt (Rabatt)
                  </Label>
                  <Input
                    type="number"
                    min={0.01}
                    max={100}
                    step={0.01}
                    value={loyaltyPointValueChf}
                    onChange={(e) => setLoyaltyPointValueChf(e.target.value)}
                    className={adminUi.input}
                    disabled={!enableRewardPointsSystem}
                  />
                  <p className={cn("text-xs", adminUi.muted)}>
                    Gegenwert beim Einlösen. Beispiel: 1.00 = 10 Punkte → CHF 10.00
                    Rabatt; 0.10 = 10 Punkte → CHF 1.00 Rabatt.
                  </p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className={adminUi.label}>
                    Ablaufdauer der Punkte (Monate)
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    step={1}
                    value={loyaltyPointsExpiryMonths}
                    onChange={(e) => setLoyaltyPointsExpiryMonths(e.target.value)}
                    className={adminUi.input}
                    disabled={!enableRewardPointsSystem}
                  />
                  <p className={cn("text-xs", adminUi.muted)}>
                    Jede Gutschrift verfällt nach dieser Dauer. Einlösung erfolgt
                    FIFO (älteste Punkte zuerst).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {show("accounting") && (
          <Card className={adminUi.card}>
            <CardContent className="space-y-6 p-6">
              <div>
                <h3 className={cn("text-base font-semibold", adminUi.accentTitle)}>
                  Checkout & MwSt.
                </h3>
                <p className={cn("mt-1 text-sm", adminUi.muted)}>
                  Steuert Mehrwertsteuer und TWINT-Verhalten im Checkout.
                </p>
              </div>

              <div
                className={cn(
                  "flex items-start justify-between gap-4 rounded-xl border p-4",
                  adminUi.section
                )}
              >
                <div className="space-y-1">
                  <Label className={cn("text-base font-semibold", adminUi.heading)}>
                    MwSt.-Pflicht aktivieren
                  </Label>
                  <p className={cn("text-sm", adminUi.muted)}>
                    Bei Aktivierung wird im Checkout die MwSt. ausgewiesen und berechnet.
                    Deaktiviert = Kleinunternehmer-Modus ohne MwSt.
                  </p>
                </div>
                <Switch
                  checked={checkout.mwstAktiv}
                  onCheckedChange={(checked) =>
                    setCheckout((prev) => ({ ...prev, mwstAktiv: checked }))
                  }
                />
              </div>

              {checkout.mwstAktiv && (
                <div className={cn("space-y-2 rounded-xl border p-4", adminUi.section)}>
                  <Label className={adminUi.label}>
                    MwSt.-Nummer{" "}
                    <span className="text-red-500" aria-hidden>
                      *
                    </span>
                  </Label>
                  <p className={cn("text-xs", adminUi.labelMuted)}>
                    Schweizer UID mit MwSt.-Zusatz, z.&nbsp;B. CHE-123.456.789 MWST
                  </p>
                  <Input
                    value={checkout.mwstNummer ?? ""}
                    onChange={(e) =>
                      setCheckout((prev) => ({
                        ...prev,
                        mwstNummer: e.target.value,
                      }))
                    }
                    placeholder="CHE-123.456.789 MWST"
                    required
                    className={cn("max-w-md", adminUi.input)}
                  />
                </div>
              )}

              <div
                className={cn(
                  "flex items-start justify-between gap-4 rounded-xl border p-4",
                  adminUi.section
                )}
              >
                <div className="space-y-1">
                  <Label className={cn("text-base font-semibold", adminUi.heading)}>
                    Offizielles TWINT-Gateway aktivieren
                  </Label>
                  <p className={cn("text-sm", adminUi.muted)}>
                    Bei Aktivierung wird die manuelle TWINT-Telefonnummer im Checkout
                    ausgeblendet und das Gateway (Stripe Checkout mit TWINT) vorbereitet.
                    Deaktiviert = manuelle TWINT-Anweisung mit Telefonnummer.
                  </p>
                </div>
                <Switch
                  checked={checkout.twintGatewayAktiv}
                  onCheckedChange={(checked) =>
                    setCheckout((prev) => ({ ...prev, twintGatewayAktiv: checked }))
                  }
                />
              </div>

              {!checkout.twintGatewayAktiv && (
                <div className="space-y-2 pl-1">
                  <Label className={adminUi.label}>TWINT-Telefonnummer (manuell)</Label>
                  <Input
                    value={checkout.twintTelefonnummer}
                    onChange={(e) =>
                      setCheckout((prev) => ({
                        ...prev,
                        twintTelefonnummer: e.target.value,
                      }))
                    }
                    className={adminUi.input}
                  />
                </div>
              )}

              <div className={cn("space-y-3 rounded-xl border p-4", adminUi.section)}>
                <div className="space-y-1">
                  <h3 className={cn("text-base font-semibold", adminUi.heading)}>
                    Zahlungsarten im Shop
                  </h3>
                  <p className={cn("text-sm", adminUi.muted)}>
                    Steuert, welche Optionen Kunden im Checkout sehen. Änderungen
                    gelten sofort nach Speichern (Shop lädt die Einstellungen live).
                  </p>
                </div>

                {(
                  [
                    {
                      key: "paymentCardAktiv" as const,
                      label: "Kreditkarte / Apple Pay / Google Pay (Stripe)",
                      hint: "Weiterleitung zur Stripe-Checkout-Seite",
                    },
                    {
                      key: "paymentTwintAktiv" as const,
                      label: "TWINT",
                      hint: "Zahlungslink oder manuelle TWINT-Anweisung",
                    },
                    {
                      key: "paymentInvoiceAktiv" as const,
                      label: "Kauf auf Rechnung / Vorkasse",
                      hint: "Banküberweisung gemäss Firmendaten unten",
                    },
                  ] as const
                ).map((row) => (
                  <div
                    key={row.key}
                    className="flex items-start justify-between gap-4 rounded-lg border border-border/50 px-3 py-3"
                  >
                    <div className="space-y-0.5">
                      <Label className={cn("text-sm font-semibold", adminUi.heading)}>
                        {row.label}
                      </Label>
                      <p className={cn("text-xs", adminUi.muted)}>{row.hint}</p>
                    </div>
                    <Switch
                      checked={checkout[row.key]}
                      onCheckedChange={(checked) =>
                        setCheckout((prev) => ({ ...prev, [row.key]: checked }))
                      }
                      aria-label={row.label}
                    />
                  </div>
                ))}

                {!checkout.paymentCardAktiv &&
                  !checkout.paymentTwintAktiv &&
                  !checkout.paymentInvoiceAktiv && (
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                      Achtung: Alle Zahlungsarten sind deaktiviert — Kunden können
                      nicht bestellen.
                    </p>
                  )}
              </div>
            </CardContent>
          </Card>
        )}

        {show("accounting") && (
          <Card className={adminUi.card}>
            <CardContent className="space-y-4 p-6">
              <div>
                <h3 className={cn("text-base font-semibold", adminUi.accentTitle)}>
                  Firmendaten
                </h3>
                <p className={cn("mt-1 text-sm", adminUi.muted)}>
                  Für Footer, Impressum und Kontaktangaben
                </p>
              </div>

              <div className="space-y-2">
                <Label className={adminUi.label}>Firmenname</Label>
                <Input
                  value={company.firmenname}
                  onChange={(e) =>
                    setCompany((prev) => ({ ...prev, firmenname: e.target.value }))
                  }
                  className={adminUi.input}
                />
              </div>

              <div className="space-y-2">
                <Label className={adminUi.label}>Kontakt-E-Mail</Label>
                <Input
                  type="email"
                  value={company.kontaktEmail}
                  onChange={(e) =>
                    setCompany((prev) => ({ ...prev, kontaktEmail: e.target.value }))
                  }
                  placeholder="shop@dripforge.ch"
                  className={adminUi.input}
                />
              </div>

              <div className="space-y-2">
                <Label className={adminUi.label}>Telefonnummer</Label>
                <Input
                  type="tel"
                  value={company.telefonnummer ?? ""}
                  onChange={(e) =>
                    setCompany((prev) => ({ ...prev, telefonnummer: e.target.value }))
                  }
                  placeholder="+41 79 000 00 00"
                  className={adminUi.input}
                />
                <p className={cn("text-xs", adminUi.muted)}>
                  Optional — erscheint im Footer, auf der Kontaktseite und im Impressum.
                </p>
              </div>

              <div className="space-y-2">
                <Label className={adminUi.label}>Firmenadresse</Label>
                <Textarea
                  value={company.firmenAdresse}
                  onChange={(e) =>
                    setCompany((prev) => ({ ...prev, firmenAdresse: e.target.value }))
                  }
                  rows={3}
                  placeholder="Strasse, PLZ Ort&#10;Schweiz"
                  className={adminUi.input}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {show("accounting") && (
          <Card className={adminUi.card}>
            <CardContent className="space-y-4 p-6">
              <div>
                <h3 className={cn("text-base font-semibold", adminUi.accentTitle)}>
                  Bankverbindung
                </h3>
                <p className={cn("mt-1 text-sm", adminUi.muted)}>
                  Für Zahlungsart «Kauf auf Rechnung» / Vorkasse
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className={adminUi.label}>IBAN</Label>
                  <Input
                    value={company.iban}
                    onChange={(e) =>
                      setCompany((prev) => ({ ...prev, iban: e.target.value }))
                    }
                    placeholder="CH93 0076 2011 6238 5295 7"
                    className={cn("font-mono", adminUi.input)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className={adminUi.label}>Bankname</Label>
                  <Input
                    value={company.bankname}
                    onChange={(e) =>
                      setCompany((prev) => ({ ...prev, bankname: e.target.value }))
                    }
                    placeholder="PostFinance AG"
                    className={adminUi.input}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      </div>

      <Button
        type="button"
        onClick={() => void saveSettings()}
        disabled={saving}
        className={cn("w-full", adminUi.primaryBtn)}
      >
        {saving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Einstellungen speichern
      </Button>
    </div>
  )
}
