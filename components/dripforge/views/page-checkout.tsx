"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import {
  ArrowLeft,
  CreditCard,
  Lock,
  MapPin,
  Package,
  Phone,
  Smartphone,
  Tag,
  Truck,
  Wallet,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CartItemDetails } from "@/components/dripforge/shared/cart-item-details"
import {
  CheckoutRewardPointsSection,
  resolveCheckoutPointsPurchaseSelection,
} from "@/components/dripforge/checkout-reward-points"
import { useCart } from "@/components/dripforge/cart-provider"
import { CheckoutAuthDialog } from "@/components/konto/checkout-auth-dialog"
import {
  DEFAULT_CHECKOUT_RUNTIME_CONFIG,
  getShippingCost,
  getTwintPaymentDescription,
  PAYMENT_OPTIONS,
  SHIPPING_OPTIONS,
  type CheckoutRuntimeConfig,
  type PaymentMethodId,
  type ShippingMethodId,
} from "@/lib/dripforge/checkout-config"
import {
  calculateCheckoutTotalsWithCoupon,
  calculateCheckoutTotalsWithDiscounts,
  type CheckoutTotalsWithCoupon,
} from "@/lib/dripforge/coupon-checkout"
import {
  maxRedeemablePoints,
} from "@/lib/konto/loyalty-points-config"
import { useCustomerLoyaltyPoints } from "@/hooks/use-customer-loyalty-points"
import { useRewardPointsEnabled } from "@/hooks/use-reward-points-enabled"
import type { CartItem } from "@/lib/dripforge/types"
import { cn } from "@/lib/utils"
import { submitOrder, startStripeCheckout, type OrderPayload } from "@/lib/dripforge/submit-order"
import { CheckoutSuccessModal } from "@/components/dripforge/checkout-success-modal"
import type { CompanySettings } from "@/lib/admin/types"
import { DEFAULT_COMPANY_SETTINGS } from "@/lib/admin/types"

type CheckoutForm = {
  firstName: string
  lastName: string
  street: string
  zip: string
  city: string
  country: string
  email: string
  phone: string
  deliveryFirstName: string
  deliveryLastName: string
  deliveryStreet: string
  deliveryZip: string
  deliveryCity: string
  deliveryCountry: string
}

const EMPTY_FORM: CheckoutForm = {
  firstName: "",
  lastName: "",
  street: "",
  zip: "",
  city: "",
  country: "Schweiz",
  email: "",
  phone: "",
  deliveryFirstName: "",
  deliveryLastName: "",
  deliveryStreet: "",
  deliveryZip: "",
  deliveryCity: "",
  deliveryCountry: "Schweiz",
}

type FieldKey = keyof CheckoutForm

const BILLING_REQUIRED: FieldKey[] = [
  "firstName",
  "lastName",
  "street",
  "zip",
  "city",
  "country",
  "email",
  "phone",
]

const DELIVERY_REQUIRED: FieldKey[] = [
  "deliveryFirstName",
  "deliveryLastName",
  "deliveryStreet",
  "deliveryZip",
  "deliveryCity",
  "deliveryCountry",
]

function fieldLabel(key: FieldKey): string {
  const labels: Record<FieldKey, string> = {
    firstName: "Vorname",
    lastName: "Nachname",
    street: "Strasse / Nr.",
    zip: "PLZ",
    city: "Ort",
    country: "Land",
    email: "E-Mail-Adresse",
    phone: "Telefonnummer",
    deliveryFirstName: "Vorname (Lieferung)",
    deliveryLastName: "Nachname (Lieferung)",
    deliveryStreet: "Strasse / Nr. (Lieferung)",
    deliveryZip: "PLZ (Lieferung)",
    deliveryCity: "Ort (Lieferung)",
    deliveryCountry: "Land (Lieferung)",
  }
  return labels[key]
}

function FormField({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  required = true,
}: {
  id: FieldKey
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  type?: string
  required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="text-primary"> *</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        className={cn(
          "bg-background/80",
          error && "border-red-500 focus-visible:ring-red-500/30"
        )}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function PageCheckout({
  setCurrentView,
  cart,
  onOrderComplete,
}: {
  setCurrentView: (view: string) => void
  cart: CartItem[]
  onOrderComplete?: (orderId: string) => void
}) {
  const { applyMergedCart } = useCart()
  const [checkoutConfig, setCheckoutConfig] = useState<CheckoutRuntimeConfig>(
    DEFAULT_CHECKOUT_RUNTIME_CONFIG
  )
  const [company, setCompany] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS)
  const [form, setForm] = useState<CheckoutForm>(EMPTY_FORM)
  const [sameAsBilling, setSameAsBilling] = useState(true)
  const [saveAddressToAccount, setSaveAddressToAccount] = useState(true)
  const profilePrefillDone = useRef(false)

  const [shippingMethod, setShippingMethod] =
    useState<ShippingMethodId>("bpost")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>("card")
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [couponInput, setCouponInput] = useState("")
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponTotals, setCouponTotals] = useState<CheckoutTotalsWithCoupon | null>(
    null
  )
  const [appliedCouponMeta, setAppliedCouponMeta] = useState<{
    code: string
    discountType: "percent" | "fixed"
    discountValue: number
  } | null>(null)
  const [stripeConfigured, setStripeConfigured] = useState(false)
  const [pointsToRedeem, setPointsToRedeem] = useState(0)
  const [pointsPurchasePackage, setPointsPurchasePackage] = useState<string | null>(
    null
  )
  const [pointsPurchaseCustom, setPointsPurchaseCustom] = useState("10")
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [authSuccessMessage, setAuthSuccessMessage] = useState<string | null>(
    null
  )
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null)
  const { loggedIn, loyaltyPoints, loading: loyaltyLoading, refresh: refreshLoyalty } =
    useCustomerLoyaltyPoints()
  const rewardPointsEnabled = useRewardPointsEnabled()

  useEffect(() => {
    void fetch("/api/settings/checkout")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.mwstAktiv !== undefined) {
          setCheckoutConfig(data as CheckoutRuntimeConfig)
        }
      })
      .catch(() => {
        console.warn("Checkout: Admin-Einstellungen konnten nicht geladen werden.")
      })

    void fetch("/api/settings/company")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.firmenname) {
          setCompany({ ...DEFAULT_COMPANY_SETTINGS, ...data })
        }
      })
      .catch(() => {
        console.warn("Checkout: Firmendaten konnten nicht geladen werden.")
      })

    void fetch("/api/checkout")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setStripeConfigured(Boolean(data?.configured))
      })
      .catch(() => setStripeConfigured(false))
  }, [])

  useEffect(() => {
    if (!loggedIn || loyaltyLoading || profilePrefillDone.current) return

    void fetch("/api/customer/profile", {
      cache: "no-store",
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (data: {
          profile?: Partial<CheckoutForm> & {
            deliveryStreet?: string
            deliveryZip?: string
            deliveryCity?: string
            deliverySameAsBilling?: boolean
          }
        } | null) => {
          if (!data?.profile) return
          profilePrefillDone.current = true
          const a = data.profile
          const deliverySame = a.deliverySameAsBilling !== false
          setSameAsBilling(deliverySame)
          setForm((prev) => ({
            ...prev,
            firstName: a.firstName || prev.firstName || "",
            lastName: a.lastName || prev.lastName || "",
            email: a.email || prev.email || "",
            street: a.street || prev.street || "",
            zip: a.zip || prev.zip || "",
            city: a.city || prev.city || "",
            phone: a.phone || prev.phone || "",
            deliveryFirstName: a.firstName || prev.deliveryFirstName || "",
            deliveryLastName: a.lastName || prev.deliveryLastName || "",
            deliveryStreet:
              (deliverySame ? a.street : a.deliveryStreet) ||
              prev.deliveryStreet ||
              "",
            deliveryZip:
              (deliverySame ? a.zip : a.deliveryZip) || prev.deliveryZip || "",
            deliveryCity:
              (deliverySame ? a.city : a.deliveryCity) ||
              prev.deliveryCity ||
              "",
          }))
        }
      )
      .catch(() => {
        /* Gast-Checkout ohne Konto */
      })
  }, [loggedIn, loyaltyLoading])

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  )
  const shippingCost = getShippingCost(shippingMethod)
  const baseTotals =
    couponTotals ??
    calculateCheckoutTotalsWithCoupon(subtotal, shippingCost, checkoutConfig, null)
  const maxPoints =
    rewardPointsEnabled && loggedIn
      ? maxRedeemablePoints(loyaltyPoints, baseTotals.total)
      : 0
  const effectivePoints = Math.min(pointsToRedeem, maxPoints)
  const pointsPurchaseSelection =
    rewardPointsEnabled && loggedIn
      ? resolveCheckoutPointsPurchaseSelection(
          pointsPurchasePackage,
          pointsPurchaseCustom
        )
      : null
  const totals: CheckoutTotalsWithCoupon = useMemo(() => {
    return calculateCheckoutTotalsWithDiscounts(
      subtotal,
      shippingCost,
      checkoutConfig,
      {
        coupon: appliedCouponMeta,
        pointsToRedeem: effectivePoints,
        pointsPurchase: pointsPurchaseSelection
          ? {
              amountChf: pointsPurchaseSelection.amountChf,
              points: pointsPurchaseSelection.points,
            }
          : null,
      }
    )
  }, [
    effectivePoints,
    subtotal,
    shippingCost,
    checkoutConfig,
    appliedCouponMeta,
    pointsPurchaseSelection,
  ])

  useEffect(() => {
    setAppliedCouponCode(null)
    setAppliedCouponMeta(null)
    setCouponTotals(null)
    setCouponError(null)
    setPointsToRedeem(0)
    setPointsPurchasePackage(null)
  }, [subtotal, shippingMethod, checkoutConfig.mwstAktiv, checkoutConfig.mwstSatz])

  const applyCoupon = async () => {
    const code = couponInput.trim()
    if (!code) {
      setCouponError("Bitte einen Gutscheincode eingeben.")
      return
    }
    setCouponLoading(true)
    setCouponError(null)
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          subtotal,
          shippingMethod,
        }),
      })
      const data = (await res.json()) as {
        valid?: boolean
        error?: string
        code?: string
        discountType?: "percent" | "fixed"
        discountValue?: number
        totals?: CheckoutTotalsWithCoupon
      }
      if (!data.valid || !data.totals) {
        setCouponTotals(null)
        setAppliedCouponCode(null)
        setCouponError(data.error ?? "Gutschein ungültig.")
        return
      }
      setCouponTotals(data.totals)
      setAppliedCouponCode(data.code ?? code.toUpperCase())
      setAppliedCouponMeta({
        code: data.code ?? code.toUpperCase(),
        discountType: data.discountType ?? "percent",
        discountValue: Number(data.discountValue) || 0,
      })
      setCouponInput(data.code ?? code.toUpperCase())
    } catch {
      setCouponError("Gutschein konnte nicht geprueft werden.")
    } finally {
      setCouponLoading(false)
    }
  }

  const removeCoupon = () => {
    setCouponInput("")
    setAppliedCouponCode(null)
    setAppliedCouponMeta(null)
    setCouponTotals(null)
    setCouponError(null)
  }

  const prefillFromAccount = (account: {
    email?: string
    firstName?: string
    lastName?: string
    street?: string
    zip?: string
    city?: string
    phone?: string
    deliveryStreet?: string
    deliveryZip?: string
    deliveryCity?: string
    deliverySameAsBilling?: boolean
  }) => {
    profilePrefillDone.current = true
    const deliverySame = account.deliverySameAsBilling !== false
    setSameAsBilling(deliverySame)
    setForm((prev) => ({
      ...prev,
      firstName: account.firstName || prev.firstName || "",
      lastName: account.lastName || prev.lastName || "",
      email: account.email || prev.email || "",
      street: account.street || prev.street || "",
      zip: account.zip || prev.zip || "",
      city: account.city || prev.city || "",
      phone: account.phone || prev.phone || "",
      deliveryFirstName: account.firstName || prev.deliveryFirstName || "",
      deliveryLastName: account.lastName || prev.deliveryLastName || "",
      deliveryStreet:
        (deliverySame ? account.street : account.deliveryStreet) ||
        prev.deliveryStreet ||
        "",
      deliveryZip:
        (deliverySame ? account.zip : account.deliveryZip) ||
        prev.deliveryZip ||
        "",
      deliveryCity:
        (deliverySame ? account.city : account.deliveryCity) ||
        prev.deliveryCity ||
        "",
    }))
  }

  const handleCheckoutAuthSuccess = ({
    account,
    cart: mergedCart,
  }: {
    account: {
      email?: string
      firstName?: string
      lastName?: string
      street?: string
      zip?: string
      city?: string
      phone?: string
      deliveryStreet?: string
      deliveryZip?: string
      deliveryCity?: string
      deliverySameAsBilling?: boolean
    }
    cart: CartItem[]
  }) => {
    applyMergedCart(mergedCart)
    prefillFromAccount(account)
    void refreshLoyalty()
    setAuthSuccessMessage(
      "Erfolgreich angemeldet — dein Warenkorb wurde mit deinem Konto zusammengeführt."
    )
  }

  const updateField = (key: FieldKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const validate = (): boolean => {
    const next: Partial<Record<FieldKey, string>> = {}

    for (const key of BILLING_REQUIRED) {
      if (!form[key].trim()) {
        next[key] = `${fieldLabel(key)} ist ein Pflichtfeld.`
      }
    }

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = "Bitte eine gültige E-Mail-Adresse eingeben."
    }

    if (!sameAsBilling) {
      for (const key of DELIVERY_REQUIRED) {
        if (!form[key].trim()) {
          next[key] = `${fieldLabel(key)} ist ein Pflichtfeld.`
        }
      }
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async () => {
    setSubmitted(true)
    setSubmitError(null)
    if (!validate()) return

    if (
      rewardPointsEnabled &&
      pointsPurchasePackage &&
      !pointsPurchaseSelection
    ) {
      setSubmitError("Bitte einen gültigen Punktebetrag wählen (1–500 CHF).")
      return
    }

    if (
      rewardPointsEnabled &&
      (effectivePoints > 0 || pointsPurchaseSelection) &&
      !loggedIn
    ) {
      setSubmitError("Bitte melde dich an, um Treuepunkte zu nutzen.")
      return
    }

    const billing = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      street: form.street.trim(),
      zip: form.zip.trim(),
      city: form.city.trim(),
      country: form.country.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
    }

    const delivery = sameAsBilling
      ? undefined
      : {
          firstName: form.deliveryFirstName.trim(),
          lastName: form.deliveryLastName.trim(),
          street: form.deliveryStreet.trim(),
          zip: form.deliveryZip.trim(),
          city: form.deliveryCity.trim(),
          country: form.deliveryCountry.trim(),
          email: billing.email,
          phone: billing.phone,
        }

    const orderPayload: OrderPayload = {
      billing,
      delivery,
      shippingMethod,
      paymentMethod,
      items: cart,
      couponCode: appliedCouponCode ?? undefined,
      pointsToRedeem: effectivePoints > 0 ? effectivePoints : undefined,
      pointsPurchase: pointsPurchaseSelection
        ? {
            packageId: pointsPurchaseSelection.packageId,
            customAmountChf: pointsPurchaseSelection.customAmountChf,
          }
        : undefined,
      saveAddressToAccount: loggedIn ? saveAddressToAccount : undefined,
      totals: {
        subtotal: totals.subtotal,
        shippingCost: totals.shippingCost,
        discountAmount: totals.discountAmount,
        couponCode: totals.couponCode,
        pointsRedeemed: totals.pointsRedeemed,
        pointsDiscountChf: totals.pointsDiscountChf,
        pointsPurchaseChf: totals.pointsPurchaseChf,
        pointsPurchased: totals.pointsPurchased,
        vat: totals.vat,
        total: totals.total,
        mwstAktiv: checkoutConfig.mwstAktiv,
      },
    }

    setIsSubmitting(true)

    if (
      (paymentMethod === "card" || paymentMethod === "twint") &&
      stripeConfigured
    ) {
      const stripeResult = await startStripeCheckout(orderPayload)
      setIsSubmitting(false)
      if (!stripeResult.ok) {
        setSubmitError(stripeResult.error)
        return
      }
      window.location.href = stripeResult.url
      return
    }

    if (paymentMethod === "card" && !stripeConfigured) {
      setIsSubmitting(false)
      setSubmitError(
        "Kreditkartenzahlung ist derzeit nicht verfügbar (Stripe nicht konfiguriert)."
      )
      return
    }

    if (
      paymentMethod === "twint" &&
      !stripeConfigured &&
      checkoutConfig.twintGatewayAktiv
    ) {
      setIsSubmitting(false)
      setSubmitError(
        "TWINT-Gateway ist derzeit nicht verfügbar (Stripe nicht konfiguriert)."
      )
      return
    }

    const result = await submitOrder(orderPayload)
    setIsSubmitting(false)

    if (!result.ok) {
      setSubmitError(result.error)
      return
    }

    const orderId = result.data.orderId
    onOrderComplete?.(orderId)
    setSuccessOrderId(orderId)
  }

  if (successOrderId) {
    return (
      <CheckoutSuccessModal
        open
        orderId={successOrderId}
        showOrdersLink={loggedIn}
        onContinueShopping={() => {
          setSuccessOrderId(null)
          setCurrentView("shop")
        }}
      />
    )
  }

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <Package className="mx-auto mb-4 h-14 w-14 text-muted-foreground/40" />
        <h1 className="text-2xl font-bold">Dein Warenkorb ist leer</h1>
        <p className="mt-2 text-muted-foreground">
          Füge Produkte hinzu, bevor du zur Kasse gehst.
        </p>
        <Button
          className="mt-6 bg-primary hover:bg-primary/90"
          onClick={() => setCurrentView("shop")}
        >
          Zum Shop
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8 py-8">
      <div className="mx-auto max-w-6xl px-4">
        <button
          type="button"
          onClick={() => setCurrentView("warenkorb")}
          className="mb-6 inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück zum Warenkorb
        </button>

        <div className="mb-8 text-center md:text-left">
          <Badge variant="secondary" className="mb-3">
            Kasse
          </Badge>
          <h1 className="text-3xl font-bold md:text-4xl">
            <span className="text-foreground">Checkout bei </span>
            <span className="bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
              DripForge
            </span>
          </h1>
          <p className="mt-2 text-muted-foreground">
            Sicherer Abschluss für deine 3D-Druck- und Laser-Aufträge.
          </p>
          {!checkoutConfig.mwstAktiv && (
            <p className="mt-1 text-xs text-muted-foreground">
              Kleinunternehmer-Modus: Preise ohne MwSt.-Ausweis.
            </p>
          )}
        </div>

        {!loggedIn && !loyaltyLoading && (
          <Card className="mb-6 rounded-2xl border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold">Bereits ein Konto?</p>
                  <p className="text-sm text-muted-foreground">
                    Melde dich an, um gespeicherte Adressdaten
                    {rewardPointsEnabled !== false ? " und Treuepunkte" : ""} zu
                    nutzen — dein Warenkorb bleibt erhalten.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="shrink-0 border-primary/30 bg-background/80 hover:bg-primary/10"
                onClick={() => setAuthDialogOpen(true)}
              >
                Hier anmelden
              </Button>
            </CardContent>
          </Card>
        )}

        {authSuccessMessage && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200"
          >
            <p>{authSuccessMessage}</p>
            <button
              type="button"
              onClick={() => setAuthSuccessMessage(null)}
              className="mt-2 text-xs font-medium underline underline-offset-2"
            >
              Schliessen
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Linke Spalte */}
          <div className="space-y-6 lg:col-span-7">
            {/* Express Checkout */}
            <Card className="rounded-2xl border-border/50 bg-card/50">
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <h2 className="font-bold">Express-Checkout</h2>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    disabled
                    title="Demnächst verfügbar"
                    className="flex h-11 cursor-not-allowed items-center justify-center rounded-xl border border-border bg-black/60 px-4 text-sm font-semibold text-white/60"
                  >
                    Apple Pay
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Demnächst verfügbar"
                    className="flex h-11 cursor-not-allowed items-center justify-center rounded-xl border border-border bg-white/60 px-4 text-sm font-semibold text-slate-500 shadow-sm dark:bg-background/60"
                  >
                    Google Pay
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("twint")}
                    className={cn(
                      "flex h-11 items-center justify-center rounded-xl border px-4 text-sm font-bold transition-colors",
                      checkoutConfig.twintGatewayAktiv
                        ? "border-cyan-600/40 bg-cyan-500/10 text-cyan-700 hover:bg-cyan-500/20 dark:text-cyan-300"
                        : "border-cyan-600/30 bg-cyan-500/5 text-cyan-700 hover:bg-cyan-500/15 dark:text-cyan-300"
                    )}
                  >
                    TWINT
                    {!checkoutConfig.twintGatewayAktiv && (
                      <span className="ml-1.5 text-[10px] font-normal opacity-70">
                        (manuell)
                      </span>
                    )}
                  </button>
                </div>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  oder mit den Angaben unten fortfahren
                </p>
              </CardContent>
            </Card>

            {/* Rechnungsadresse */}
            <Card className="rounded-2xl border-border/50 bg-card/50">
              <CardContent className="space-y-5 p-6">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <h2 className="font-bold">Rechnungs- &amp; Lieferadresse</h2>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    id="firstName"
                    label="Vorname"
                    value={form.firstName}
                    onChange={(v) => updateField("firstName", v)}
                    error={errors.firstName}
                  />
                  <FormField
                    id="lastName"
                    label="Nachname"
                    value={form.lastName}
                    onChange={(v) => updateField("lastName", v)}
                    error={errors.lastName}
                  />
                </div>

                <FormField
                  id="street"
                  label="Strasse / Nr."
                  value={form.street}
                  onChange={(v) => updateField("street", v)}
                  error={errors.street}
                />

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    id="zip"
                    label="PLZ"
                    value={form.zip}
                    onChange={(v) => updateField("zip", v)}
                    error={errors.zip}
                  />
                  <div className="sm:col-span-2">
                    <FormField
                      id="city"
                      label="Ort"
                      value={form.city}
                      onChange={(v) => updateField("city", v)}
                      error={errors.city}
                    />
                  </div>
                </div>

                <FormField
                  id="country"
                  label="Land"
                  value={form.country}
                  onChange={(v) => updateField("country", v)}
                  error={errors.country}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    id="email"
                    label="E-Mail-Adresse"
                    type="email"
                    value={form.email}
                    onChange={(v) => updateField("email", v)}
                    error={errors.email}
                  />
                  <FormField
                    id="phone"
                    label="Telefonnummer"
                    type="tel"
                    value={form.phone}
                    onChange={(v) => updateField("phone", v)}
                    error={errors.phone}
                  />
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/20 p-4">
                  <Checkbox
                    id="same-address"
                    checked={sameAsBilling}
                    onCheckedChange={(checked) =>
                      setSameAsBilling(checked === true)
                    }
                  />
                  <Label
                    htmlFor="same-address"
                    className="cursor-pointer text-sm leading-snug"
                  >
                    Lieferadresse entspricht der Rechnungsadresse
                  </Label>
                </div>

                {loggedIn && (
                  <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/20 p-4">
                    <Checkbox
                      id="save-address"
                      checked={saveAddressToAccount}
                      onCheckedChange={(checked) =>
                        setSaveAddressToAccount(checked === true)
                      }
                    />
                    <Label
                      htmlFor="save-address"
                      className="cursor-pointer text-sm leading-snug"
                    >
                      Adresse im Konto speichern für zukünftige Bestellungen
                    </Label>
                  </div>
                )}

                {!sameAsBilling && (
                  <div className="space-y-4 border-t border-border/50 pt-4">
                    <h3 className="text-sm font-semibold">Lieferadresse</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        id="deliveryFirstName"
                        label="Vorname"
                        value={form.deliveryFirstName}
                        onChange={(v) => updateField("deliveryFirstName", v)}
                        error={errors.deliveryFirstName}
                      />
                      <FormField
                        id="deliveryLastName"
                        label="Nachname"
                        value={form.deliveryLastName}
                        onChange={(v) => updateField("deliveryLastName", v)}
                        error={errors.deliveryLastName}
                      />
                    </div>
                    <FormField
                      id="deliveryStreet"
                      label="Strasse / Nr."
                      value={form.deliveryStreet}
                      onChange={(v) => updateField("deliveryStreet", v)}
                      error={errors.deliveryStreet}
                    />
                    <div className="grid gap-4 sm:grid-cols-3">
                      <FormField
                        id="deliveryZip"
                        label="PLZ"
                        value={form.deliveryZip}
                        onChange={(v) => updateField("deliveryZip", v)}
                        error={errors.deliveryZip}
                      />
                      <div className="sm:col-span-2">
                        <FormField
                          id="deliveryCity"
                          label="Ort"
                          value={form.deliveryCity}
                          onChange={(v) => updateField("deliveryCity", v)}
                          error={errors.deliveryCity}
                        />
                      </div>
                    </div>
                    <FormField
                      id="deliveryCountry"
                      label="Land"
                      value={form.deliveryCountry}
                      onChange={(v) => updateField("deliveryCountry", v)}
                      error={errors.deliveryCountry}
                    />
                  </div>
                )}

                {submitted && Object.keys(errors).length > 0 && (
                  <p className="text-sm font-medium text-red-500">
                    Bitte alle Pflichtfelder korrekt ausfüllen.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Versandart */}
            <Card className="rounded-2xl border-border/50 bg-card/50">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary" />
                  <h2 className="font-bold">Versandart</h2>
                </div>
                <div className="space-y-3">
                  {SHIPPING_OPTIONS.map((option) => {
                    const selected = shippingMethod === option.id
                    const priceLabel =
                      option.price === 0
                        ? "Gratis"
                        : `CHF ${option.price.toFixed(2)}`
                    return (
                      <label
                        key={option.id}
                        className={cn(
                          "flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all",
                          selected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border/60 hover:border-primary/40"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="shipping"
                            checked={selected}
                            onChange={() => setShippingMethod(option.id)}
                            className="h-4 w-4 accent-primary"
                          />
                          <span className="text-sm font-medium">
                            {option.label}
                          </span>
                        </div>
                        <span className="text-sm font-semibold tabular-nums">
                          {priceLabel}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Zahlungsart */}
            <Card className="rounded-2xl border-border/50 bg-card/50">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <h2 className="font-bold">Zahlungsart</h2>
                </div>
                <div className="space-y-3">
                  {PAYMENT_OPTIONS.map((option) => {
                    const selected = paymentMethod === option.id
                    const description =
                      option.id === "twint"
                        ? getTwintPaymentDescription(checkoutConfig, {
                            stripeConfigured,
                          })
                        : option.description
                    return (
                      <label
                        key={option.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all",
                          selected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border/60 hover:border-primary/40"
                        )}
                      >
                        <input
                          type="radio"
                          name="payment"
                          checked={selected}
                          onChange={() => setPaymentMethod(option.id)}
                          className="mt-1 h-4 w-4 accent-primary"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{option.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {description}
                          </p>
                        </div>
                      </label>
                    )
                  })}
                </div>

                {paymentMethod === "twint" && (
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                    {stripeConfigured ? (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                          TWINT via Stripe
                        </p>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Nach dem Klick auf «Jetzt bezahlen» wirst du zur sicheren
                          Stripe-Kasse weitergeleitet und kannst dort mit TWINT
                          abschliessen.
                        </p>
                      </div>
                    ) : checkoutConfig.twintGatewayAktiv ? (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                          TWINT via Stripe
                        </p>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Stripe ist noch nicht konfiguriert. Bitte{" "}
                          <code className="text-[0.7rem]">STRIPE_SECRET_KEY</code> in
                          der Umgebung hinterlegen.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                          <p className="text-sm font-semibold">
                            Manuelle TWINT-Zahlung
                          </p>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Überweise den Gesamtbetrag nach dem Absenden der Bestellung
                          an unsere TWINT-Nummer. Gib im Verwendungszweck deinen Namen
                          und die Bestellnummer an.
                        </p>
                        <div className="flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-background/80 px-3 py-2.5">
                          <Phone className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
                          <span className="text-sm font-semibold tabular-nums">
                            {checkoutConfig.twintTelefonnummer}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === "invoice" && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold">Kauf auf Rechnung / Vorkasse</p>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      Bitte überweise den Gesamtbetrag innerhalb von 30 Tagen auf
                      folgendes Konto. Gib im Verwendungszweck deinen Namen und die
                      Bestellnummer an.
                    </p>
                    {(company.iban || company.bankname) && (
                      <dl className="mt-3 space-y-1 rounded-lg border border-primary/15 bg-background/80 px-3 py-2.5 text-sm">
                        {company.bankname && (
                          <div>
                            <dt className="text-xs text-muted-foreground">Bank</dt>
                            <dd className="font-medium">{company.bankname}</dd>
                          </div>
                        )}
                        {company.iban && (
                          <div>
                            <dt className="text-xs text-muted-foreground">IBAN</dt>
                            <dd className="font-mono font-semibold tabular-nums">
                              {company.iban}
                            </dd>
                          </div>
                        )}
                        <div>
                          <dt className="text-xs text-muted-foreground">Empfänger</dt>
                          <dd className="font-medium">{company.firmenname}</dd>
                        </div>
                      </dl>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Rechte Spalte */}
          <div className="lg:col-span-5">
            <div className="sticky top-4 rounded-2xl border border-slate-100 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/50">
              <h2 className="mb-5 text-lg font-bold">Bestellübersicht</h2>

              <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-950/40"
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold leading-snug">
                        {item.name}
                      </p>
                      <p className="shrink-0 text-sm font-bold tabular-nums text-primary">
                        CHF {(item.price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                    <CartItemDetails item={item} compact showLeitbild />
                  </div>
                ))}
              </div>

              <div className="mb-4 space-y-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Tag className="h-4 w-4 text-primary" />
                  Gutscheincode
                </div>
                <div className="flex gap-2">
                  <Input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="z. B. LAUNCH20"
                    className="bg-background/80 font-mono uppercase"
                    disabled={couponLoading || Boolean(appliedCouponCode)}
                  />
                  {appliedCouponCode ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={removeCoupon}
                    >
                      Entfernen
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void applyCoupon()}
                      disabled={couponLoading || !couponInput.trim()}
                    >
                      {couponLoading ? "…" : "Einlösen"}
                    </Button>
                  )}
                </div>
                {couponError && (
                  <p className="text-xs text-red-500">{couponError}</p>
                )}
                {appliedCouponCode && totals.discountAmount > 0 && (
                  <p className="text-xs text-primary">
                    Rabatt aktiv: − CHF {totals.discountAmount.toFixed(2)}
                  </p>
                )}
              </div>

              {rewardPointsEnabled === true && (
                <CheckoutRewardPointsSection
                  loggedIn={loggedIn}
                  loyaltyLoading={loyaltyLoading}
                  loyaltyPoints={loyaltyPoints}
                  pointsToRedeem={pointsToRedeem}
                  maxPoints={maxPoints}
                  effectivePoints={effectivePoints}
                  pointsDiscountChf={totals.pointsDiscountChf ?? 0}
                  onPointsToRedeemChange={setPointsToRedeem}
                  selectedPackage={pointsPurchasePackage}
                  onSelectedPackageChange={setPointsPurchasePackage}
                  customAmount={pointsPurchaseCustom}
                  onCustomAmountChange={setPointsPurchaseCustom}
                />
              )}

              <div className="mt-6 space-y-2 border-t border-slate-200 pt-4 text-sm dark:border-slate-700">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Zwischensumme</span>
                  <span className="font-medium tabular-nums">
                    CHF {totals.subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Versandkosten</span>
                  <span className="font-medium tabular-nums">
                    {shippingCost === 0
                      ? "Gratis"
                      : `CHF ${totals.shippingCost.toFixed(2)}`}
                  </span>
                </div>
                {totals.discountAmount > 0 && (
                  <div className="flex justify-between gap-3 text-green-600 dark:text-green-400">
                    <span>
                      Rabatt
                      {totals.couponCode ? ` (${totals.couponCode})` : ""}
                    </span>
                    <span className="font-medium tabular-nums">
                      − CHF {totals.discountAmount.toFixed(2)}
                    </span>
                  </div>
                )}
                {(totals.pointsDiscountChf ?? 0) > 0 && (
                  <div className="flex justify-between gap-3 text-amber-700 dark:text-amber-300">
                    <span>Treuepunkte ({totals.pointsRedeemed ?? 0})</span>
                    <span className="font-medium tabular-nums">
                      − CHF {(totals.pointsDiscountChf ?? 0).toFixed(2)}
                    </span>
                  </div>
                )}
                {(totals.pointsPurchaseChf ?? 0) > 0 && (
                  <div className="flex justify-between gap-3 text-primary">
                    <span>Punkte kaufen ({totals.pointsPurchased ?? 0})</span>
                    <span className="font-medium tabular-nums">
                      + CHF {(totals.pointsPurchaseChf ?? 0).toFixed(2)}
                    </span>
                  </div>
                )}
                {checkoutConfig.mwstAktiv ? (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      MwSt. ({checkoutConfig.mwstSatz.toFixed(1)}%)
                    </span>
                    <span className="font-medium tabular-nums">
                      CHF {totals.vat.toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Gemäss Kleinunternehmerregelung wird keine MwSt. ausgewiesen.
                  </p>
                )}
                <div className="flex justify-between gap-3 border-t border-slate-200 pt-3 text-base font-bold dark:border-slate-700">
                  <span>Gesamtbetrag</span>
                  <span className="text-primary tabular-nums">
                    CHF {totals.total.toFixed(2)}
                  </span>
                </div>
              </div>

              <Button
                type="button"
                size="lg"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="mt-6 w-full bg-primary text-base font-bold hover:bg-primary/90"
              >
                <Lock className="mr-2 h-4 w-4" />
                {isSubmitting
                  ? paymentMethod === "invoice"
                    ? "Bestellung wird übermittelt…"
                    : "Weiterleitung zur Kasse…"
                  : paymentMethod === "invoice"
                    ? "Jetzt zahlungspflichtig bestellen"
                    : "Jetzt bezahlen"}
              </Button>

              {submitError && (
                <p className="mt-3 text-center text-sm font-medium text-red-500">
                  {submitError}
                </p>
              )}

              <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
                Mit dem Abschicken der Bestellung akzeptierst du unsere{" "}
                <button
                  type="button"
                  onClick={() => setCurrentView("agb")}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  AGB
                </button>
                .
              </p>
            </div>
          </div>
        </div>
      </div>

      <CheckoutAuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        guestCart={cart}
        onAuthSuccess={handleCheckoutAuthSuccess}
      />
    </div>
  )
}
