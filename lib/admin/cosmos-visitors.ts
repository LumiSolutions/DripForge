import { getSettingsContainer } from "@/lib/cosmos/client"
import { logCosmosError } from "@/lib/cosmos/log-error"
import type {
  VisitorPageview,
  VisitorSession,
} from "@/lib/admin/visitor-sessions"

export const VISITOR_SESSION_DOC_TYPE = "visitor_session"
export const VISITOR_PAGEVIEW_DOC_TYPE = "visitor_pageview"

type SessionDoc = VisitorSession & {
  docType: typeof VISITOR_SESSION_DOC_TYPE
  id: string
}

type PageviewDoc = VisitorPageview & {
  docType: typeof VISITOR_PAGEVIEW_DOC_TYPE
  id: string
}

function sessionDocId(sessionId: string): string {
  return `vs_${sessionId}`
}

export async function cosmosUpsertVisitorSession(
  session: VisitorSession
): Promise<void> {
  const container = await getSettingsContainer()
  const doc: SessionDoc = {
    ...session,
    id: sessionDocId(session.id),
    docType: VISITOR_SESSION_DOC_TYPE,
  }
  await container.items.upsert(doc)
}

export async function cosmosCreateVisitorPageview(
  pageview: VisitorPageview
): Promise<void> {
  const container = await getSettingsContainer()
  const doc: PageviewDoc = {
    ...pageview,
    id: pageview.id.startsWith("vp_") ? pageview.id : `vp_${pageview.id}`,
    docType: VISITOR_PAGEVIEW_DOC_TYPE,
  }
  await container.items.upsert(doc)
}

export async function cosmosGetVisitorSession(
  sessionId: string
): Promise<VisitorSession | null> {
  const container = await getSettingsContainer()
  try {
    const { resource } = await container
      .item(sessionDocId(sessionId), sessionDocId(sessionId))
      .read<SessionDoc>()
    if (!resource || resource.docType !== VISITOR_SESSION_DOC_TYPE) return null
    const { docType: _d, ...session } = resource
    return {
      ...session,
      id: sessionId,
    }
  } catch (error) {
    const code = (error as { code?: number }).code
    if (code === 404) return null
    logCosmosError(`cosmosGetVisitorSession:${sessionId}`, error)
    throw error
  }
}

export async function cosmosListVisitorSessions(): Promise<VisitorSession[]> {
  const container = await getSettingsContainer()
  try {
    const { resources } = await container.items
      .query<SessionDoc>({
        query: "SELECT * FROM c WHERE c.docType = @docType",
        parameters: [{ name: "@docType", value: VISITOR_SESSION_DOC_TYPE }],
      })
      .fetchAll()
    return (resources ?? []).map((doc) => {
      const sessionId = doc.id.startsWith("vs_") ? doc.id.slice(3) : doc.id
      return {
        id: sessionId,
        ipHash: doc.ipHash,
        countryCode: doc.countryCode,
        regionCode: doc.regionCode,
        regionLabel: doc.regionLabel,
        lastSeenAt: doc.lastSeenAt,
        firstSeenAt: doc.firstSeenAt,
        path: doc.path,
      }
    })
  } catch (error) {
    logCosmosError("cosmosListVisitorSessions", error)
    throw error
  }
}

export async function cosmosListVisitorPageviews(
  sinceIso?: string
): Promise<VisitorPageview[]> {
  const container = await getSettingsContainer()
  try {
    const query = sinceIso
      ? {
          query:
            "SELECT * FROM c WHERE c.docType = @docType AND c.at >= @since",
          parameters: [
            { name: "@docType", value: VISITOR_PAGEVIEW_DOC_TYPE },
            { name: "@since", value: sinceIso },
          ],
        }
      : {
          query: "SELECT * FROM c WHERE c.docType = @docType",
          parameters: [{ name: "@docType", value: VISITOR_PAGEVIEW_DOC_TYPE }],
        }
    const { resources } = await container.items
      .query<PageviewDoc>(query)
      .fetchAll()
    return (resources ?? []).map((doc) => ({
      id: doc.id,
      sessionId: doc.sessionId,
      ipHash: doc.ipHash,
      countryCode: doc.countryCode,
      regionCode: doc.regionCode,
      regionLabel: doc.regionLabel,
      path: doc.path,
      at: doc.at,
    }))
  } catch (error) {
    logCosmosError("cosmosListVisitorPageviews", error)
    throw error
  }
}
