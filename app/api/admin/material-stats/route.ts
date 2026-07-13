import { NextResponse } from "next/server"
import { adminDatabaseErrorResponse } from "@/lib/admin/api-errors"
import { getMaterialTypes, saveMaterialTypes } from "@/lib/admin/db"
import { getMaterials } from "@/lib/admin/material-db"
import {
  isAuthError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session"
import { countStockForMaterialType } from "@/lib/admin/list-sort-utils"
import {
  sanitizeMaterialTypesInput,
  type MaterialTypeDefinition,
} from "@/lib/admin/material-stats-types"
import { ensureSettingsReady } from "@/lib/cosmos/client"

export const dynamic = "force-dynamic"

function validateMaterialTypeFields(
  types: MaterialTypeDefinition[]
): string | null {
  for (const [index, type] of types.entries()) {
    const label = `Zeile ${index + 1} (${type?.name || type?.id || "?"})`
    if (!String(type?.id ?? "").trim()) {
      console.error("Material-Stats Validierung fehlgeschlagen:", label, "id")
      return `${label}: ID fehlt.`
    }
    if (!String(type?.name ?? "").trim()) {
      console.error("Material-Stats Validierung fehlgeschlagen:", label, "name")
      return `${label}: Name fehlt.`
    }
    for (const key of [
      "sortOrder",
      "strength",
      "flexibility",
      "heatResistance",
      "appearance",
      "easeOfUse",
    ] as const) {
      const raw = type[key]
      if (raw === undefined || raw === null) continue
      const value = Number(raw)
      if (!Number.isFinite(value)) {
        console.error(
          "Material-Stats Validierung fehlgeschlagen:",
          label,
          key,
          raw
        )
        return `${label}: Feld «${key}» muss eine Zahl sein (ist: ${String(raw)}).`
      }
    }
  }
  return null
}

export async function GET(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await ensureSettingsReady()
    const materialTypes = await getMaterialTypes()
    return NextResponse.json({ materialTypes })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error("Admin Material-Stats: Laden fehlgeschlagen.", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Material-Arten konnten nicht geladen werden.",
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  const auth = requireAdminSession(request)
  if (isAuthError(auth)) return auth

  try {
    await ensureSettingsReady()
    const body = (await request.json()) as {
      materialTypes?: MaterialTypeDefinition[]
      materialStats?: unknown
    }

    if (!Array.isArray(body.materialTypes)) {
      console.error("Material-Stats Validierung fehlgeschlagen: materialTypes fehlt/kein Array")
      return NextResponse.json(
        { error: "Material-Arten fehlen." },
        { status: 400 }
      )
    }

    const fieldError = validateMaterialTypeFields(body.materialTypes)
    if (fieldError) {
      return NextResponse.json({ error: fieldError }, { status: 400 })
    }

    const existing = await getMaterialTypes()
    const existingIds = new Set(existing.map((type) => type.id))
    const nextIds = new Set(
      body.materialTypes.map((type) => String(type.id ?? "").trim())
    )
    const removed = existing.filter((type) => !nextIds.has(type.id))

    if (removed.length > 0) {
      const stockItems = await getMaterials("filament")
      for (const type of removed) {
        const count = countStockForMaterialType(stockItems, type)
        if (count > 0) {
          return NextResponse.json(
            {
              error: `«${type.name}» kann nicht gelöscht werden — ${count} Lagerartikel verknüpft.`,
            },
            { status: 409 }
          )
        }
      }
    }

    for (const type of body.materialTypes) {
      if (!type.id?.trim() || !type.name?.trim()) {
        console.error("Material-Stats Validierung fehlgeschlagen: id/name", type)
        return NextResponse.json(
          { error: "Jede Material-Art braucht ID und Name." },
          { status: 400 }
        )
      }
      if (
        !existingIds.has(type.id) &&
        body.materialTypes.filter((t) => t.id === type.id).length > 1
      ) {
        console.error("Material-Stats Validierung fehlgeschlagen: doppelte ID", type.id)
        return NextResponse.json(
          { error: "Doppelte Material-Art-ID." },
          { status: 400 }
        )
      }
    }

    let materialTypes: MaterialTypeDefinition[]
    try {
      materialTypes = sanitizeMaterialTypesInput(body.materialTypes)
    } catch (sanitizeError) {
      console.error("Material-Stats Sanitize fehlgeschlagen.", sanitizeError)
      return NextResponse.json(
        {
          error:
            sanitizeError instanceof Error
              ? sanitizeError.message
              : "Material-Arten Validierung fehlgeschlagen.",
        },
        { status: 400 }
      )
    }

    const saved = await saveMaterialTypes(materialTypes)
    return NextResponse.json({ materialTypes: saved })
  } catch (error) {
    const dbResponse = adminDatabaseErrorResponse(error)
    if (dbResponse) return dbResponse
    console.error("Admin Material-Stats: Speichern fehlgeschlagen.", error)
    const message =
      error instanceof Error
        ? error.message
        : "Material-Arten konnten nicht gespeichert werden."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
