import { NextResponse } from "next/server"
import { getCustomerByNumber, getSettings } from "@/lib/admin/db"
import { normalizeCustomerEmail } from "@/lib/admin/customers"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { listAllAccounts } from "@/lib/konto/account-db"
import { buildRewardPointsPublicSettings } from "@/lib/dripforge/reward-points-settings"
import {
  adjustLoyaltyPoints,
  getEffectiveLoyaltyPoints,
  syncLoyaltyAccountBalance,
} from "@/lib/konto/loyalty-points"
import type { LoyaltyPointTransaction } from "@/lib/konto/loyalty-points-config"

type RouteContext = { params: Promise<{ id: string }> }

async function resolvePortalAccount(kundennummer: string, email: string) {
  const accounts = await listAllAccounts()
  return (
    accounts.find((account) => account.kundennummer === kundennummer) ??
    accounts.find(
      (account) =>
        normalizeCustomerEmail(account.id) === normalizeCustomerEmail(email)
    ) ??
    null
  )
}

function sortLoyaltyHistory(
  transactions: LoyaltyPointTransaction[] | undefined
): LoyaltyPointTransaction[] {
  return [...(transactions ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export async function GET(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { id } = await context.params
    const customer = await getCustomerByNumber(decodeURIComponent(id))
    if (!customer) {
      return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 })
    }

    const rewardCfg = buildRewardPointsPublicSettings(await getSettings())
    const portalAccount = await resolvePortalAccount(
      customer.kundennummer,
      customer.email
    )

    if (!portalAccount) {
      return NextResponse.json({
        accountId: null,
        email: customer.email,
        name: `${customer.billing.firstName} ${customer.billing.lastName}`.trim(),
        points: 0,
        history: [],
        hasPortalAccount: false,
      })
    }

    const synced =
      (await syncLoyaltyAccountBalance(
        portalAccount.email,
        rewardCfg.loyaltyPointsExpiryMonths
      )) ?? portalAccount

    return NextResponse.json({
      accountId: synced.id,
      email: synced.email,
      name: `${synced.firstName} ${synced.lastName}`.trim(),
      points: getEffectiveLoyaltyPoints(
        synced,
        rewardCfg.loyaltyPointsExpiryMonths
      ),
      history: sortLoyaltyHistory(synced.loyaltyPointTransactions).slice(0, 50),
      hasPortalAccount: true,
    })
  } catch (error) {
    console.warn("Admin-API: Treuepunkte konnten nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Treuepunkte konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const { id } = await context.params
    const customer = await getCustomerByNumber(decodeURIComponent(id))
    if (!customer) {
      return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 })
    }

    const portalAccount = await resolvePortalAccount(
      customer.kundennummer,
      customer.email
    )
    if (!portalAccount) {
      return NextResponse.json(
        {
          error:
            "Kein Kundenkonto im Portal gefunden. Punkte können nur für registrierte Konten angepasst werden.",
        },
        { status: 404 }
      )
    }

    let body: { delta?: unknown; note?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 })
    }

    const delta = typeof body.delta === "number" ? Math.trunc(body.delta) : NaN
    if (!Number.isFinite(delta) || delta === 0) {
      return NextResponse.json(
        { error: "Bitte eine Punktänderung ungleich 0 angeben." },
        { status: 400 }
      )
    }
    if (Math.abs(delta) > 1_000_000) {
      return NextResponse.json(
        { error: "Punktänderung ist zu gross." },
        { status: 400 }
      )
    }

    const note = typeof body.note === "string" ? body.note.trim() : ""
    if (!note) {
      return NextResponse.json(
        { error: "Bitte einen Grund / eine Notiz angeben." },
        { status: 400 }
      )
    }
    if (note.length > 500) {
      return NextResponse.json(
        { error: "Notiz darf maximal 500 Zeichen lang sein." },
        { status: 400 }
      )
    }

    const rewardCfg = buildRewardPointsPublicSettings(await getSettings())
    const result = await adjustLoyaltyPoints(portalAccount.email, delta, note, {
      expiryMonths: rewardCfg.loyaltyPointsExpiryMonths,
      adminLabel: `Admin ${auth.userId}`,
    })

    if (!result.success) {
      const message =
        result.reason === "insufficient_points"
          ? "Nicht genügend Punkte zum Abziehen."
          : result.reason === "note_required"
            ? "Bitte einen Grund / eine Notiz angeben."
            : "Punkte konnten nicht angepasst werden."
      return NextResponse.json({ error: message }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      points: result.newBalance,
      adjusted: result.points,
    })
  } catch (error) {
    console.warn("Admin-API: Treuepunkte-Anpassung fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Punkte konnten nicht angepasst werden." },
      { status: 500 }
    )
  }
}
