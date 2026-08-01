import { promises as fs } from "fs"
import path from "path"
import { withCosmosFallback } from "@/lib/admin/storage-bridge"
import {
  cosmosGetKontaktanfrageById,
  cosmosListKontaktanfragen,
  cosmosSaveKontaktanfrage,
} from "@/lib/admin/cosmos-kontaktanfragen"
import {
  createKontaktanfrageId,
  extractKontaktPhone,
  KONTAKTANFRAGE_DOC_TYPE,
  normalizeKontaktStatus,
  normalizeKontaktanfrage,
  type CreateKontaktanfrageInput,
  type Kontaktanfrage,
  type KontaktStatus,
} from "@/lib/admin/kontaktanfrage-types"

const DATA_DIR = path.join(process.cwd(), "data", "admin")
const KONTAKTANFRAGEN_FILE = "kontaktanfragen.json"

async function readKontaktanfragenFile(): Promise<Kontaktanfrage[]> {
  const filePath = path.join(DATA_DIR, KONTAKTANFRAGEN_FILE)
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    const parsed = JSON.parse(raw) as Kontaktanfrage[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((entry) => normalizeKontaktanfrage(entry))
      .filter((entry): entry is Kontaktanfrage => Boolean(entry))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
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
  const phone =
    extractKontaktPhone(input.phone, input.extraFields) ?? undefined
  const anfrage: Kontaktanfrage = {
    id: id ?? createKontaktanfrageId(),
    docType: KONTAKTANFRAGE_DOC_TYPE,
    name: input.name,
    email: input.email,
    phone,
    company: input.company,
    inquiryType: input.inquiryType,
    subject: input.subject,
    message: input.message,
    status: normalizeKontaktStatus(input.status ?? "offen"),
    extraFields: input.extraFields,
    createdAt: now,
    updatedAt: now,
  }

  return withCosmosFallback(
    "createKontaktanfrage",
    () => cosmosSaveKontaktanfrage(anfrage),
    () => saveKontaktanfrageToFile(anfrage)
  )
}

export async function listKontaktanfragen(): Promise<Kontaktanfrage[]> {
  return withCosmosFallback(
    "listKontaktanfragen",
    () => cosmosListKontaktanfragen(),
    () => readKontaktanfragenFile()
  )
}

export async function getKontaktanfrageById(
  id: string
): Promise<Kontaktanfrage | null> {
  return withCosmosFallback(
    "getKontaktanfrageById",
    () => cosmosGetKontaktanfrageById(id),
    async () => {
      const all = await readKontaktanfragenFile()
      return all.find((entry) => entry.id === id) ?? null
    }
  )
}

export async function updateKontaktanfrageStatus(
  id: string,
  status: KontaktStatus
): Promise<Kontaktanfrage | null> {
  const current = await getKontaktanfrageById(id)
  if (!current) return null
  const next: Kontaktanfrage = {
    ...current,
    status: normalizeKontaktStatus(status),
    updatedAt: new Date().toISOString(),
  }
  return withCosmosFallback(
    "updateKontaktanfrageStatus",
    () => cosmosSaveKontaktanfrage(next),
    () => saveKontaktanfrageToFile(next)
  )
}
