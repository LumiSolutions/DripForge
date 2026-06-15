import { NextResponse } from "next/server"
import { CosmosDatabaseError } from "@/lib/admin/storage-bridge"
import { formatCosmosError } from "@/lib/cosmos/log-error"

export function resolveCosmosApiError(error: unknown): {
  message: string
  status: number
} {
  if (error instanceof CosmosDatabaseError) {
    const cause = error.cause
    const formatted = cause ? formatCosmosError(cause) : null
    const message =
      (typeof formatted?.message === "string" && formatted.message) ||
      (cause instanceof Error && cause.message) ||
      error.message ||
      "Datenbank nicht erreichbar"

    console.error("Admin API: CosmosDatabaseError.", {
      message: error.message,
      detail: formatted,
    })

    return { message, status: 500 }
  }

  if (error instanceof Error && error.message.trim()) {
    return { message: error.message, status: 500 }
  }

  const formatted = formatCosmosError(error)
  return {
    message:
      (typeof formatted.message === "string" && formatted.message) ||
      "Unbekannter Datenbankfehler",
    status: 500,
  }
}

export function adminDatabaseErrorResponse(error: unknown) {
  if (error instanceof CosmosDatabaseError) {
    const { message, status } = resolveCosmosApiError(error)
    return NextResponse.json({ error: message }, { status })
  }
  return null
}
