import { NextResponse } from "next/server"
import { CUSTOMER_SESSION_COOKIE } from "@/lib/konto/session-node"

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.set(CUSTOMER_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  return response
}
