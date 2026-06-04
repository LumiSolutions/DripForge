import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { PREVIEW_ACCESS_COOKIE } from "@/lib/dripforge/launch-config"

const BYPASS_PREFIXES = [
  "/admin",
  "/api",
  "/_next",
  "/favicon.ico",
  "/.swa",
]

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

  const hasPreviewCookie =
    request.cookies.get(PREVIEW_ACCESS_COOKIE)?.value === "true"

  if (hasPreviewCookie) {
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

  if (pathname === "/") {
    return NextResponse.next()
  }

  return NextResponse.redirect(new URL("/", request.url))
}

export const config = {
  matcher: [
    /*
     * .swa ausnehmen — Azure SWA prueft /.swa/health.html beim Deployment-Warm-up
     */
    "/((?!_next/static|_next/image|\\.swa|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
