import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "fs"
import { join } from "path"

const root = process.cwd()
const standaloneDir = join(root, ".next", "standalone")
const staticSrc = join(root, ".next", "static")
const staticDest = join(standaloneDir, ".next", "static")
const publicSrc = join(root, "public")
const publicDest = join(standaloneDir, "public")
const dataAdminSrc = join(root, "data", "admin")
const dataAdminDest = join(standaloneDir, "data", "admin")

/**
 * Diese Dateien dürfen NIEMALS aus dem Repo in ein Produktions-Paket übernommen werden.
 * Sonst erscheinen nach Deploy Seed-/Demo-Daten statt Cosmos-Inhalten (oder leerem Zustand).
 */
const NEVER_SHIP_ADMIN_FILES = new Set([
  "materials.json",
  "inventory.json",
  "products.json",
  "orders.json",
  "customers.json",
  "staff-accounts.json",
  "visitor-sessions.json",
  "visitor-pageviews.json",
  "visitor-geo-cache.json",
])

if (!existsSync(standaloneDir)) {
  console.error("prepare-standalone: .next/standalone fehlt — zuerst next build ausfuehren.")
  process.exit(1)
}

if (existsSync(staticSrc)) {
  mkdirSync(join(standaloneDir, ".next"), { recursive: true })
  cpSync(staticSrc, staticDest, { recursive: true })
  console.log("prepare-standalone: .next/static kopiert.")
}

if (existsSync(publicSrc)) {
  cpSync(publicSrc, publicDest, { recursive: true })
  console.log("prepare-standalone: public kopiert.")
}

if (existsSync(dataAdminSrc)) {
  mkdirSync(dataAdminDest, { recursive: true })
  // Selektives Kopieren: keine Lager-/Produkt-/Order-Seeds in Prod-Artefakt
  for (const entry of readdirSync(dataAdminSrc, { withFileTypes: true })) {
    const name = entry.name
    if (NEVER_SHIP_ADMIN_FILES.has(name)) continue
    if (name.startsWith("materials.backup-")) continue
    if (name.startsWith("visitor-")) continue
    const src = join(dataAdminSrc, name)
    const dest = join(dataAdminDest, name)
    if (entry.isDirectory()) {
      cpSync(src, dest, { recursive: true })
    } else {
      cpSync(src, dest)
    }
  }
  // Leere Stubs — FS-Fallback darf niemals Seed-Filamente/Produkte vortäuschen
  for (const emptyFile of ["materials.json", "inventory.json", "products.json"]) {
    writeFileSync(join(dataAdminDest, emptyFile), "[]\n", "utf-8")
  }
  console.log(
    "prepare-standalone: data/admin selektiv kopiert (materials/products/inventory = leere Stubs; Inventar in Prod = Cosmos)."
  )
}
