import { NextResponse } from "next/server"
import { CosmosDatabaseError } from "@/lib/admin/storage-bridge"
import { formatCosmosError } from "@/lib/cosmos/log-error"

export function adminDatabaseErrorResponse(error: unknown) {
  if (error instanceof CosmosDatabaseError) {
    const cause = error.cause
    console.error("Admin API: CosmosDatabaseError.", {
      message: error.message,
      cause: cause ? formatCosmosError(cause) : undefined,
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return null
}
