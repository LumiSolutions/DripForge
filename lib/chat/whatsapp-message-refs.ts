import { promises as fs } from "fs"
import path from "path"
import { getChatContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import { withCosmosFallback } from "@/lib/admin/storage-bridge"

export const WHATSAPP_MESSAGE_REF_DOC_TYPE = "whatsapp_message_ref" as const

export type WhatsAppMessageRef = {
  id: string
  docType: typeof WHATSAPP_MESSAGE_REF_DOC_TYPE
  sessionId: string
  createdAt: string
}

const DATA_DIR = path.join(process.cwd(), "data", "admin")
const REFS_FILE = "whatsapp-message-refs.json"

type RefsFile = { refs: WhatsAppMessageRef[] }

async function readRefsFile(): Promise<RefsFile> {
  const filePath = path.join(DATA_DIR, REFS_FILE)
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    const parsed = JSON.parse(raw) as RefsFile
    return { refs: Array.isArray(parsed.refs) ? parsed.refs : [] }
  } catch {
    return { refs: [] }
  }
}

async function writeRefsFile(store: RefsFile): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(path.join(DATA_DIR, REFS_FILE), JSON.stringify(store, null, 2), "utf-8")
}

async function cosmosUpsertRef(ref: WhatsAppMessageRef): Promise<void> {
  const container = await getChatContainer()
  await container.items.upsert({
    ...ref,
    id: ref.id,
    sessionId: ref.sessionId,
  })
}

async function cosmosGetRef(wamid: string): Promise<WhatsAppMessageRef | null> {
  const container = await getChatContainer()
  try {
    const { resources } = await container.items
      .query<WhatsAppMessageRef>({
        query:
          "SELECT TOP 1 * FROM c WHERE c.docType = @docType AND c.id = @id",
        parameters: [
          { name: "@docType", value: WHATSAPP_MESSAGE_REF_DOC_TYPE },
          { name: "@id", value: wamid },
        ],
      })
      .fetchAll()
    return resources[0] ?? null
  } catch (error) {
    logCosmosError(`cosmosGetWhatsAppRef:${wamid}`, error)
    throw error
  }
}

export async function storeWhatsAppOutboundRef(
  wamid: string,
  sessionId: string
): Promise<void> {
  const ref: WhatsAppMessageRef = {
    id: wamid,
    docType: WHATSAPP_MESSAGE_REF_DOC_TYPE,
    sessionId,
    createdAt: new Date().toISOString(),
  }

  await withCosmosFallback(
    "storeWhatsAppOutboundRef",
    () => cosmosUpsertRef(ref),
    async () => {
      const store = await readRefsFile()
      const index = store.refs.findIndex((r) => r.id === wamid)
      if (index >= 0) store.refs[index] = ref
      else store.refs.push(ref)
      await writeRefsFile(store)
    }
  )
}

export async function getSessionIdByWhatsAppMessageId(
  wamid: string
): Promise<string | null> {
  const ref = await withCosmosFallback(
    "getSessionIdByWhatsAppMessageId",
    () => cosmosGetRef(wamid),
    async () => {
      const store = await readRefsFile()
      return store.refs.find((r) => r.id === wamid) ?? null
    }
  )
  return ref?.sessionId ?? null
}
