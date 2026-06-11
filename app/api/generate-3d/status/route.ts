import { NextResponse } from "next/server"
import { getThreeDGeneratorPublicStatus } from "@/lib/ai/three-d-generator-config"

export const dynamic = "force-dynamic"

/** Öffentlicher Status (ohne Secrets) für KI-Konfigurator-UI. */
export async function GET() {
  return NextResponse.json(getThreeDGeneratorPublicStatus(), {
    headers: { "Cache-Control": "no-store, max-age=0" },
  })
}
