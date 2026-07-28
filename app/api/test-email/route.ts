import { NextResponse } from "next/server"
import {
  buildSmtpTransporter,
  getSmtpRuntimeConfig,
  isSmtpConfigured,
} from "@/lib/email/smtp"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const TEST_TO = "shop@dripforge.ch"

/**
 * Temporärer Diagnose-Endpoint für Hostpoint SMTP auf Azure.
 * GET /api/test-email
 */
export async function GET() {
  try {
    if (!isSmtpConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: "SMTP_PASS fehlt in der Umgebung.",
          code: "SMTP_NOT_CONFIGURED",
        },
        { status: 500 }
      )
    }

    const config = getSmtpRuntimeConfig()
    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error: "SMTP-Konfiguration konnte nicht geladen werden.",
          code: "SMTP_CONFIG_NULL",
        },
        { status: 500 }
      )
    }

    console.log("[test-email] Sende Test-Mail…", {
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      from: config.from,
      to: TEST_TO,
    })

    const transporter = buildSmtpTransporter()
    await transporter.sendMail({
      from: config.from,
      to: TEST_TO,
      subject: "DripForge SMTP-Test",
      text: `SMTP-Test erfolgreich.\n\nHost: ${config.host}\nPort: ${config.port}\nSecure: ${config.secure}\nZeit: ${new Date().toISOString()}`,
      html: `<p><strong>SMTP-Test erfolgreich.</strong></p><p>Host: ${config.host}:${config.port} (secure=${config.secure})</p><p>Zeit: ${new Date().toISOString()}</p>`,
    })

    return NextResponse.json({
      success: true,
      message: "E-Mail erfolgreich versendet!",
    })
  } catch (error) {
    const err = error as Error & { code?: string }
    console.error("[test-email] Versand fehlgeschlagen:", {
      message: err?.message,
      code: err?.code,
    })
    return NextResponse.json(
      {
        success: false,
        error: err?.message ?? String(error),
        code: err?.code ?? "UNKNOWN",
      },
      { status: 500 }
    )
  }
}
