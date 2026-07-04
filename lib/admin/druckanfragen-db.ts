import { promises as fs } from "fs"
import path from "path"
import { withCosmosFallback } from "@/lib/admin/storage-bridge"
import {
  cosmosGetDruckanfrageById,
  cosmosListDruckanfragen,
  cosmosSaveDruckanfrage,
} from "@/lib/admin/cosmos-druckanfragen"
import {
  createDruckanfrageId,
  DRUCKANFRAGE_DOC_TYPE,
  type CreateDruckanfrageInput,
  type Druckanfrage,
} from "@/lib/admin/druckanfrage-types"

const DATA_DIR = path.join(process.cwd(), "data", "admin")
const DRUCKANFRAGEN_FILE = "druckanfragen.json"

async function readDruckanfragenFile(): Promise<Druckanfrage[]> {
  const filePath = path.join(DATA_DIR, DRUCKANFRAGEN_FILE)
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    const parsed = JSON.parse(raw) as Druckanfrage[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeDruckanfragenFile(anfragen: Druckanfrage[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(
    path.join(DATA_DIR, DRUCKANFRAGEN_FILE),
    JSON.stringify(anfragen, null, 2),
    "utf-8"
  )
}

async function saveDruckanfrageToFile(anfrage: Druckanfrage): Promise<Druckanfrage> {
  const existing = await readDruckanfragenFile()
  const next = [anfrage, ...existing.filter((entry) => entry.id !== anfrage.id)]
  await writeDruckanfragenFile(next)
  return anfrage
}

async function listDruckanfragenFromFile(limit = 100): Promise<Druckanfrage[]> {
  const existing = await readDruckanfragenFile()
  return existing
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}

async function getDruckanfrageFromFile(id: string): Promise<Druckanfrage | null> {
  const existing = await readDruckanfragenFile()
  return existing.find((entry) => entry.id === id) ?? null
}

export async function createDruckanfrage(
  input: CreateDruckanfrageInput,
  id?: string
): Promise<Druckanfrage> {
  const now = new Date().toISOString()
  const anfrage: Druckanfrage = {
    id: id ?? createDruckanfrageId(),
    docType: DRUCKANFRAGE_DOC_TYPE,
    status: "neu",
    ...input,
    createdAt: now,
    updatedAt: now,
  }

  return withCosmosFallback(
    "createDruckanfrage",
    () => cosmosSaveDruckanfrage(anfrage),
    () => saveDruckanfrageToFile(anfrage)
  )
}

export async function listDruckanfragen(limit = 100): Promise<Druckanfrage[]> {
  return withCosmosFallback(
    "listDruckanfragen",
    () => cosmosListDruckanfragen(limit),
    () => listDruckanfragenFromFile(limit)
  )
}

export async function getDruckanfrageById(id: string): Promise<Druckanfrage | null> {
  return withCosmosFallback(
    "getDruckanfrageById",
    () => cosmosGetDruckanfrageById(id),
    () => getDruckanfrageFromFile(id)
  )
}
