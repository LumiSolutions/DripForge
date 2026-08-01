import { NextResponse } from "next/server"
import { staffLoginAfterPassword } from "@/lib/admin/staff-auth"
import { verifyStaffPassword } from "@/lib/admin/staff-db"
import type { StaffAuthIntent, StaffRole } from "@/lib/admin/staff-types"

function parseRole(value: string | undefined): StaffRole | null {
  if (value === "admin" || value === "tester") return value
  return null
}

function parseIntent(value: string | undefined): StaffAuthIntent {
  return value === "preview" ? "preview" : "admin"
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      role?: string
      password?: string
      intent?: string
    }

    const role = parseRole(body.role?.trim())
    const password = body.password ?? ""
    const intent = parseIntent(body.intent?.trim())

    if (!role || !password) {
      return NextResponse.json(
        { error: "Rolle und Passwort erforderlich." },
        { status: 400 }
      )
    }

    if (intent === "admin" && role !== "admin") {
      return NextResponse.json(
        { error: "Nur Administratoren können sich im Admin-Bereich anmelden." },
        { status: 403 }
      )
    }

    if (intent === "preview" && role !== "tester") {
      return NextResponse.json(
        { error: "Vorschau-Zugang ist nur für Tester verfügbar." },
        { status: 403 }
      )
    }

    const account = await verifyStaffPassword(role, password)
    if (!account) {
      return NextResponse.json(
        { error: "Falsches Passwort." },
        { status: 401 }
      )
    }

    return await staffLoginAfterPassword(account, intent)
  } catch (error) {
    console.error("Admin-Auth: Login fehlgeschlagen.", error)
    return NextResponse.json({ error: "Login fehlgeschlagen." }, { status: 500 })
  }
}
