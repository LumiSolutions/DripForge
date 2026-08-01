import { NextResponse } from "next/server"
import {
  getLaserConfiguratorSettings,
  saveLaserConfiguratorSettings,
} from "@/lib/admin/db"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import {
  sanitizeLaserConfiguratorSettings,
  type LaserConfiguratorSettings,
} from "@/lib/admin/laser-configurator-types"

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const settings = await getLaserConfiguratorSettings()
    return NextResponse.json(settings)
  } catch (error) {
    console.error("Admin-API: Laser-Konfigurator konnte nicht geladen werden.", error)
    return NextResponse.json(
      { error: "Laser-Konfigurator-Einstellungen konnten nicht geladen werden." },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    const body = (await request.json()) as Partial<LaserConfiguratorSettings>
    const current = await getLaserConfiguratorSettings()
    const next = sanitizeLaserConfiguratorSettings({
      ...current,
      allowCustomerShipping: body.allowCustomerShipping,
      customerShippingInstructions: body.customerShippingInstructions,
      maxWorkAreaMm: body.maxWorkAreaMm ?? current.maxWorkAreaMm,
    })
    const saved = await saveLaserConfiguratorSettings(next)
    return NextResponse.json(saved)
  } catch (error) {
    console.error("Admin-API: Laser-Konfigurator konnte nicht gespeichert werden.", error)
    return NextResponse.json(
      { error: "Laser-Konfigurator-Einstellungen konnten nicht gespeichert werden." },
      { status: 500 }
    )
  }
}
