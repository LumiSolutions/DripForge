import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import {
  ADMIN_PORTAL_BASE_PATH,
  isLegacyAdminPath,
} from "@/lib/admin/admin-portal-path"
import { PREVIEW_ACCESS_COOKIE } from "@/lib/dripforge/launch-config"
import {
  CUSTOMER_SESSION_COOKIE,
  isKontoPublicPath,
  parseCustomerSessionEdge,
} from "@/lib/konto/session-edge"

const BYPASS_PREFIXES = [
  ADMIN_PORTAL_BASE_PATH,
  "/api",
  "/_next",
  "/favicon.ico",
  "/.swa",
]

const LAUNCH_BYPASS_PREFIXES = ["/konto", "/bestellung"]

type LaunchPayload = {
  shopLive?: boolean
  canAccessShop?: boolean
  hasPreviewAccess?: boolean
  showSupportOnMainSite?: boolean
  showSupportOnCountdownPage?: boolean
}

function allowsShopAccess(data: LaunchPayload, hasPreviewCookie: boolean): boolean {
  if (data.shopLive || data.canAccessShop) return true
  if (hasPreviewCookie && data.hasPreviewAccess !== false) return true
  if (hasPreviewCookie) return true
  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isLegacyAdminPath(pathname)) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  if (BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/konto")) {
    // Login, Registrierung, Passwort vergessen/zurücksetzen: öffentlich
    if (isKontoPublicPath(pathname)) {
      return NextResponse.next()
    }

    const token = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value
    const session = await parseCustomerSessionEdge(token)
    if (!session) {
      const loginUrl = new URL("/konto/login", request.url)
      loginUrl.searchParams.set("next", pathname)
      return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
  }

  const hasPreviewCookie =
    request.cookies.get(PREVIEW_ACCESS_COOKIE)?.value === "true"

  if (hasPreviewCookie) {
    return NextResponse.next()
  }

  if (LAUNCH_BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  let launchData: LaunchPayload = {}

  try {
    const launchUrl = new URL("/api/settings/launch", request.url)
    const res = await fetch(launchUrl, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    })

    launchData = (await res.json().catch(() => ({}))) as LaunchPayload

    if (allowsShopAccess(launchData, hasPreviewCookie)) {
      return NextResponse.next()
    }
  } catch (error) {
    console.warn("Middleware: Launch-Status nicht verfügbar — Coming Soon aktiv.", error)
  }

  if (pathname.startsWith("/konfigurator")) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/support")) {
    if (
      launchData.showSupportOnMainSite === true ||
      launchData.showSupportOnCountdownPage === true
    ) {
      return NextResponse.next()
    }
    return NextResponse.redirect(new URL("/", request.url))
  }

  if (pathname === "/") {
    return NextResponse.next()
  }

  return NextResponse.redirect(new URL("/", request.url))
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|\\.swa|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
