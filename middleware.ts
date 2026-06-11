import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { PREVIEW_ACCESS_COOKIE } from "@/lib/dripforge/launch-config"
import {
  CUSTOMER_SESSION_COOKIE,
  isKontoPublicPath,
  parseCustomerSessionEdge,
} from "@/lib/konto/session-edge"

const BYPASS_PREFIXES = [
  "/admin",
  "/api",
  "/_next",
  "/favicon.ico",
  "/.swa",
]

const LAUNCH_BYPASS_PREFIXES = ["/konto"]

type LaunchPayload = {
  shopLive?: boolean
  canAccessShop?: boolean
  hasPreviewAccess?: boolean
}

function allowsShopAccess(data: LaunchPayload, hasPreviewCookie: boolean): boolean {
  if (data.shopLive || data.canAccessShop) return true
  if (hasPreviewCookie && data.hasPreviewAccess !== false) return true
  if (hasPreviewCookie) return true
  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/konto")) {
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

  try {
    const launchUrl = new URL("/api/settings/launch", request.url)
    const res = await fetch(launchUrl, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    })

    const data = (await res.json().catch(() => ({}))) as LaunchPayload

    if (allowsShopAccess(data, hasPreviewCookie)) {
      return NextResponse.next()
    }
  } catch (error) {
    console.warn("Middleware: Launch-Status nicht verfuegbar — Coming Soon aktiv.", error)
  }

  if (pathname === "/" || pathname.startsWith("/support")) {
    return NextResponse.next()
  }

  return NextResponse.redirect(new URL("/", request.url))
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|\\.swa|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
