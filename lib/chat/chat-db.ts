import { promises as fs } from "fs"
import path from "path"
import { getChatContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import { withCosmosFallback } from "@/lib/admin/storage-bridge"
import {
  buildVisitorLabel,
  createChatMessageId,
  createChatSessionId,
} from "@/lib/chat/chat-session-id"
import {
  CHAT_MESSAGE_DOC_TYPE,
  CHAT_SESSION_DOC_TYPE,
  type ChatMessage,
  type ChatSession,
  type PublicChatMessage,
} from "@/lib/chat/chat-types"

const DATA_DIR = path.join(process.cwd(), "data", "admin")
const CHAT_FILE = "chat-store.json"

type ChatStoreFile = {
  sessions: ChatSession[]
  messages: ChatMessage[]
}

async function readChatFile(): Promise<ChatStoreFile> {
  const filePath = path.join(DATA_DIR, CHAT_FILE)
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    const parsed = JSON.parse(raw) as ChatStoreFile
    return {
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    }
  } catch {
    return { sessions: [], messages: [] }
  }
}

async function writeChatFile(store: ChatStoreFile): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(path.join(DATA_DIR, CHAT_FILE), JSON.stringify(store, null, 2), "utf-8")
}

function toPublicMessage(message: ChatMessage): PublicChatMessage {
  return {
    id: message.id,
    sessionId: message.sessionId,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
  }
}

function normalizeSession(raw: Partial<ChatSession> & { id: string }): ChatSession {
  const now = new Date().toISOString()
  return {
    id: raw.id,
    docType: CHAT_SESSION_DOC_TYPE,
    visitorName: raw.visitorName?.trim() || undefined,
    visitorLabel: raw.visitorLabel?.trim() || buildVisitorLabel(raw.visitorName, raw.id),
    status: raw.status === "closed" ? "closed" : "open",
    lastMessageAt: raw.lastMessageAt ?? now,
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
  }
}

function normalizeMessage(raw: Partial<ChatMessage> & { sessionId: string }): ChatMessage {
  const now = new Date().toISOString()
  return {
    id: raw.id ?? createChatMessageId(),
    docType: CHAT_MESSAGE_DOC_TYPE,
    sessionId: raw.sessionId,
    role: raw.role === "admin" ? "admin" : raw.role === "system" ? "system" : "visitor",
    content: String(raw.content ?? "").trim(),
    source: raw.source === "whatsapp" ? "whatsapp" : "web",
    createdAt: raw.createdAt ?? now,
  }
}

async function cosmosUpsertChatDoc(doc: ChatSession | ChatMessage): Promise<void> {
  const container = await getChatContainer()
  const sessionId =
    doc.docType === CHAT_SESSION_DOC_TYPE ? doc.id : (doc as ChatMessage).sessionId
  await container.items.upsert({ ...doc, id: doc.id, sessionId })
}

async function cosmosGetSession(sessionId: string): Promise<ChatSession | null> {
  const container = await getChatContainer()
  try {
    const { resource } = await container.item(sessionId, sessionId).read<ChatSession>()
    if (!resource || resource.docType !== CHAT_SESSION_DOC_TYPE) return null
    return normalizeSession(resource)
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return null
    logCosmosError(`cosmosGetSession:${sessionId}`, error)
    throw error
  }
}

async function cosmosListMessages(sessionId: string): Promise<ChatMessage[]> {
  const container = await getChatContainer()
  const { resources } = await container.items
    .query<ChatMessage>({
      query:
        "SELECT * FROM c WHERE c.docType = @docType AND c.sessionId = @sessionId ORDER BY c.createdAt ASC",
      parameters: [
        { name: "@docType", value: CHAT_MESSAGE_DOC_TYPE },
        { name: "@sessionId", value: sessionId },
      ],
    })
    .fetchAll()
  return resources.map(normalizeMessage)
}

async function cosmosGetLatestOpenSession(): Promise<ChatSession | null> {
  const container = await getChatContainer()
  const { resources } = await container.items
    .query<ChatSession>({
      query:
        "SELECT TOP 1 * FROM c WHERE c.docType = @docType AND c.status = 'open' ORDER BY c.lastMessageAt DESC",
      parameters: [{ name: "@docType", value: CHAT_SESSION_DOC_TYPE }],
    })
    .fetchAll()
  const first = resources[0]
  return first ? normalizeSession(first) : null
}

export async function createChatSession(visitorName?: string): Promise<ChatSession> {
  const id = createChatSessionId()
  const now = new Date().toISOString()
  const session = normalizeSession({
    id,
    visitorName,
    visitorLabel: buildVisitorLabel(visitorName, id),
    status: "open",
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
  })

  await withCosmosFallback(
    "createChatSession",
    () => cosmosUpsertChatDoc(session),
    async () => {
      const store = await readChatFile()
      store.sessions.push(session)
      await writeChatFile(store)
    }
  )

  return session
}

export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  return withCosmosFallback(
    "getChatSession",
    () => cosmosGetSession(sessionId),
    async () => {
      const store = await readChatFile()
      const session = store.sessions.find((s) => s.id === sessionId)
      return session ? normalizeSession(session) : null
    }
  )
}

export async function getLatestOpenChatSession(): Promise<ChatSession | null> {
  return withCosmosFallback(
    "getLatestOpenChatSession",
    () => cosmosGetLatestOpenSession(),
    async () => {
      const store = await readChatFile()
      const open = store.sessions
        .filter((s) => s.status === "open")
        .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
      return open[0] ? normalizeSession(open[0]) : null
    }
  )
}

export async function listChatMessages(sessionId: string): Promise<PublicChatMessage[]> {
  const messages = await withCosmosFallback(
    "listChatMessages",
    () => cosmosListMessages(sessionId),
    async () => {
      const store = await readChatFile()
      return store.messages
        .filter((m) => m.sessionId === sessionId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    }
  )
  return messages.map(toPublicMessage)
}

export async function appendChatMessage(input: {
  sessionId: string
  role: ChatMessage["role"]
  content: string
  source: ChatMessage["source"]
}): Promise<PublicChatMessage | null> {
  const session = await getChatSession(input.sessionId)
  if (!session) return null

  const message = normalizeMessage({
    sessionId: input.sessionId,
    role: input.role,
    content: input.content,
    source: input.source,
  })

  const now = new Date().toISOString()
  const updatedSession: ChatSession = {
    ...session,
    lastMessageAt: now,
    updatedAt: now,
    status: "open",
  }

  await withCosmosFallback(
    "appendChatMessage",
    async () => {
      await cosmosUpsertChatDoc(updatedSession)
      await cosmosUpsertChatDoc(message)
    },
    async () => {
      const store = await readChatFile()
      const sessionIndex = store.sessions.findIndex((s) => s.id === session.id)
      if (sessionIndex >= 0) store.sessions[sessionIndex] = updatedSession
      store.messages.push(message)
      await writeChatFile(store)
    }
  )

  return toPublicMessage(message)
}

export async function updateChatSessionVisitorName(
  sessionId: string,
  visitorName: string
): Promise<ChatSession | null> {
  const session = await getChatSession(sessionId)
  if (!session) return null

  const updated: ChatSession = {
    ...session,
    visitorName: visitorName.trim() || undefined,
    visitorLabel: buildVisitorLabel(visitorName, sessionId),
    updatedAt: new Date().toISOString(),
  }

  await withCosmosFallback(
    "updateChatSessionVisitorName",
    () => cosmosUpsertChatDoc(updated),
    async () => {
      const store = await readChatFile()
      const index = store.sessions.findIndex((s) => s.id === sessionId)
      if (index >= 0) {
        store.sessions[index] = updated
        await writeChatFile(store)
      }
    }
  )

  return updated
}
