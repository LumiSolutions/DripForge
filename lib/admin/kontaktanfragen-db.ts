import { promises as fs } from "fs"
import path from "path"
import { withCosmosFallback } from "@/lib/admin/storage-bridge"
import { cosmosSaveKontaktanfrage } from "@/lib/admin/cosmos-kontaktanfragen"
import {
  createKontaktanfrageId,
  KONTAKTANFRAGE_DOC_TYPE,
  type CreateKontaktanfrageInput,
  type Kontaktanfrage,
} from "@/lib/admin/kontaktanfrage-types"

const DATA_DIR = path.join(process.cwd(), "data", "admin")
const KONTAKTANFRAGEN_FILE = "kontaktanfragen.json"

async function readKontaktanfragenFile(): Promise<Kontaktanfrage[]> {
  const filePath = path.join(DATA_DIR, KONTAKTANFRAGEN_FILE)
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    const parsed = JSON.parse(raw) as Kontaktanfrage[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeKontaktanfragenFile(anfragen: Kontaktanfrage[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(
    path.join(DATA_DIR, KONTAKTANFRAGEN_FILE),
    JSON.stringify(anfragen, null, 2),
    "utf-8"
  )
}

async function saveKontaktanfrageToFile(anfrage: Kontaktanfrage): Promise<Kontaktanfrage> {
  const existing = await readKontaktanfragenFile()
  const next = [anfrage, ...existing.filter((entry) => entry.id !== anfrage.id)]
  await writeKontaktanfragenFile(next)
  return anfrage
}

export async function createKontaktanfrage(
  input: CreateKontaktanfrageInput,
  id?: string
): Promise<Kontaktanfrage> {
  const now = new Date().toISOString()
  const anfrage: Kontaktanfrage = {
    id: id ?? createKontaktanfrageId(),
    docType: KONTAKTANFRAGE_DOC_TYPE,
    ...input,
    createdAt: now,
    updatedAt: now,
  }

  return withCosmosFallback(
    "createKontaktanfrage",
    () => cosmosSaveKontaktanfrage(anfrage),
    () => saveKontaktanfrageToFile(anfrage)
  )
}
