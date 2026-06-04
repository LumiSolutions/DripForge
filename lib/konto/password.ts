import { randomBytes, scryptSync, timingSafeEqual } from "crypto"

const KEY_LEN = 64
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, KEY_LEN, SCRYPT_PARAMS)
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":")
  if (parts.length !== 3 || parts[0] !== "scrypt") return false

  const salt = Buffer.from(parts[1], "hex")
  const expected = Buffer.from(parts[2], "hex")
  const actual = scryptSync(password, salt, KEY_LEN, SCRYPT_PARAMS)

  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}
