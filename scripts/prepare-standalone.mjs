import { cpSync, existsSync, mkdirSync } from "fs"
import { join } from "path"

const root = process.cwd()
const standaloneDir = join(root, ".next", "standalone")
const staticSrc = join(root, ".next", "static")
const staticDest = join(standaloneDir, ".next", "static")
const publicSrc = join(root, "public")
const publicDest = join(standaloneDir, "public")
const dataAdminSrc = join(root, "data", "admin")
const dataAdminDest = join(standaloneDir, "data", "admin")

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
  cpSync(dataAdminSrc, dataAdminDest, { recursive: true })
  console.log("prepare-standalone: data/admin kopiert (Cosmos-Fallback).")
}
