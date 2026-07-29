#!/usr/bin/env node
/**
 * Hostpoint SMTP Verbindungstest + optionale Test-Mail.
 *
 * Usage:
 *   npm run test:smtp
 *   npm run test:smtp -- shop@dripforge.ch
 *
 * Lädt automatisch `.env.local` / `.env` falls vorhanden.
 */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import nodemailer from "nodemailer"

function loadEnvFile(filename) {
  const path = resolve(process.cwd(), filename)
  if (!existsSync(path)) return
  const content = readFileSync(path, "utf8")
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

loadEnvFile(".env.local")
loadEnvFile(".env")

function getConfig() {
  const host = (process.env.SMTP_HOST || "mail.hostpoint.ch").trim()
  const user = (process.env.SMTP_USER || "shop@dripforge.ch").trim()
  const pass = (process.env.SMTP_PASS || "").trim()
  if (!pass) {
    throw new Error(
      "SMTP nicht konfiguriert. Bitte SMTP_PASS in .env.local setzen."
    )
  }
  // Hostpoint: Port 465 + SSL (secure: true) — 587 liefert 535
  const port = Number(process.env.SMTP_PORT) || 465
  const secure = true
  const from = `DripForge <${user}>`
  const admin =
    process.env.ADMIN_EMAIL?.trim() ||
    process.env.ADMIN_NOTIFY_EMAIL?.trim() ||
    user

  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
    admin,
  }
}

async function main() {
  const config = getConfig()
  const recipientArg = process.argv[2]?.trim()
  const to = recipientArg || config.admin

  console.log("SMTP-Konfiguration:")
  console.log(`  Host:   ${config.host}`)
  console.log(`  Port:   ${config.port}`)
  console.log(`  Secure: ${config.secure}`)
  console.log(`  User:   ${config.user}`)
  console.log(`  From:   ${config.from}`)
  console.log(`  To:     ${to}`)
  console.log("")

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    ...(!config.secure ? { requireTLS: true } : {}),
  })

  console.log("1/2 Verbindung prüfen (verify)…")
  await transporter.verify()
  console.log("   OK — SMTP-Login erfolgreich.\n")

  console.log("2/2 Test-E-Mail senden…")
  const info = await transporter.sendMail({
    from: config.from,
    to,
    subject: "DripForge SMTP-Test",
    text: [
      "Hallo,",
      "",
      "diese Test-E-Mail bestätigt, dass der Hostpoint-SMTP-Versand für DripForge funktioniert.",
      "",
      `Zeitpunkt: ${new Date().toISOString()}`,
      `Host: ${config.host}:${config.port} (secure=${config.secure})`,
      "",
      "Freundliche Grüsse",
      "DripForge",
    ].join("\n"),
    html: `<p>Hallo,</p>
<p>diese Test-E-Mail bestätigt, dass der Hostpoint-SMTP-Versand für DripForge funktioniert.</p>
<p><strong>Zeitpunkt:</strong> ${new Date().toISOString()}<br/>
<strong>Host:</strong> ${config.host}:${config.port} (secure=${config.secure})</p>
<p>Freundliche Grüsse<br/>DripForge</p>`,
  })

  console.log("   OK — E-Mail gesendet.")
  console.log(`   messageId: ${info.messageId || "—"}`)
  console.log("")
  console.log("Fertig.")
}

main().catch((error) => {
  console.error("\nSMTP-Test fehlgeschlagen:")
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
