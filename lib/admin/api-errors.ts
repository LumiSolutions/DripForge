import { NextResponse } from "next/server"
import { CosmosDatabaseError } from "@/lib/admin/storage-bridge"

export function adminDatabaseErrorResponse(error: unknown) {
  if (error instanceof CosmosDatabaseError) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return null
}
