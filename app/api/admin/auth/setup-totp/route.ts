import { setupTotpForPending } from "@/lib/admin/staff-auth"

export async function POST(request: Request) {
  try {
    return await setupTotpForPending(request)
  } catch (error) {
    console.error("Admin-Auth: 2FA-Setup fehlgeschlagen.", error)
    return Response.json(
      { error: "2FA-Einrichtung fehlgeschlagen." },
      { status: 500 }
    )
  }
}
