import { NextResponse } from "next/server"
import { recordVisitorHeartbeat } from "@/lib/admin/visitor-sessions"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      sessionId?: string
      path?: string
    }
    const result = await recordVisitorHeartbeat({
      sessionId: body.sessionId,
      path: body.path,
      request,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.warn("Analytics heartbeat failed.", error)
    return NextResponse.json({ sessionId: null }, { status: 200 })
  }
}
