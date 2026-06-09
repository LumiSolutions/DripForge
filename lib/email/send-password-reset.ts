import nodemailer from "nodemailer"

function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  )
}

function buildTransporter() {
  const port = Number(process.env.SMTP_PORT ?? 587)
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

type SendPasswordResetOptions = {
  to: string
  resetUrl: string
  accountLabel: string
}

export async function sendPasswordResetEmail(
  options: SendPasswordResetOptions
): Promise<boolean> {
  const subject = "DripForge — Passwort zuruecksetzen"
  const text = [
    "Guten Tag,",
    "",
    `Sie haben eine Anfrage zum Zuruecksetzen Ihres ${options.accountLabel}-Passworts gestellt.`,
    "",
    "Oeffnen Sie den folgenden Link innerhalb von 1 Stunde:",
    options.resetUrl,
    "",
    "Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.",
    "",
    "Freundliche Gruesse",
    "DripForge",
  ].join("\n")

  if (!isSmtpConfigured()) {
    console.info("Passwort-Reset: SMTP nicht konfiguriert — Link fuer lokale Tests:")
    console.info(`  Empfaenger: ${options.to}`)
    console.info(`  Reset-Link: ${options.resetUrl}`)
    return true
  }

  const from =
    process.env.SMTP_FROM?.trim() ||
    `"DripForge" <${process.env.SMTP_USER}>`

  try {
    const transporter = buildTransporter()
    await transporter.sendMail({
      from,
      to: options.to,
      subject,
      text,
    })
    console.info(`Passwort-Reset: E-Mail gesendet an ${options.to}.`)
    return true
  } catch (error) {
    console.error(`Passwort-Reset: E-Mail-Versand fehlgeschlagen (${options.to}).`, error)
    throw error
  }
}
