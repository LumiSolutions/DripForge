import { NextResponse } from "next/server"
import {
  getTesterPassword,
  PREVIEW_ACCESS_COOKIE,
} from "@/lib/dripforge/launch-config"

const PREVIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 90 // 90 Tage

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { password?: string }
    const password = body.password?.trim() ?? ""

    if (!password) {
      return NextResponse.json({ error: "Passwort fehlt." }, { status: 400 })
    }

    if (password !== getTesterPassword()) {
      return NextResponse.json(
        { error: "Falsches Tester-Passwort." },
        { status: 401 }
      )
    }

    const response = NextResponse.json({
      success: true,
      message: "Vorschau-Zugang freigeschaltet.",
    })

    response.cookies.set(PREVIEW_ACCESS_COOKIE, "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: PREVIEW_COOKIE_MAX_AGE,
    })

    return response
  } catch (error) {
    console.warn("Preview-Access: Anmeldung fehlgeschlagen.", error)
    return NextResponse.json(
      { error: "Anmeldung fehlgeschlagen." },
      { status: 500 }
    )
  }
}
