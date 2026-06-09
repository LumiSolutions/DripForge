import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto"

const SALT = "dripforge-admin-2fa-v1"

function getEncryptionKey(): Buffer {
  const secret =
    process.env.ADMIN_2FA_ENCRYPTION_KEY?.trim() ||
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    "dripforge-admin-2fa-dev-key-change-me"
  return scryptSync(secret, SALT, 32)
}

export function encryptTotpSecret(plain: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`
}

export function decryptTotpSecret(stored: string): string | null {
  const parts = stored.split(":")
  if (parts.length !== 4 || parts[0] !== "v1") return null

  try {
    const key = getEncryptionKey()
    const iv = Buffer.from(parts[1], "hex")
    const tag = Buffer.from(parts[2], "hex")
    const encrypted = Buffer.from(parts[3], "hex")
    const decipher = createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAuthTag(tag)
    const plain = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ])
    return plain.toString("utf8")
  } catch {
    return null
  }
}
