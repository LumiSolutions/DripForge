import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { PREVIEW_ACCESS_COOKIE } from "@/lib/dripforge/launch-config"

const BYPASS_PREFIXES = [
  "/admin",
  "/api",
  "/_next",
  "/favicon.ico",
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  if (request.cookies.get(PREVIEW_ACCESS_COOKIE)?.value === "true") {
    return NextResponse.next()
  }

  try {
    const launchUrl = new URL("/api/settings/launch", request.url)
    const res = await fetch(launchUrl, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    })

    if (res.ok) {
      const data = (await res.json()) as { shopLive?: boolean; canAccessShop?: boolean }
      if (data.shopLive || data.canAccessShop) {
        return NextResponse.next()
      }
    }
  } catch {
    console.warn("Middleware: Launch-Status nicht verfuegbar — Coming Soon aktiv.")
  }

  if (pathname === "/") {
    return NextResponse.next()
  }

  return NextResponse.redirect(new URL("/", request.url))
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
