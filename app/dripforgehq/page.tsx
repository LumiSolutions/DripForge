import { redirect } from "next/navigation"
import { LEGACY_ADMIN_TAB_REDIRECTS } from "@/lib/admin/admin-nav"
import { adminPortalPath } from "@/lib/admin/admin-portal-path"

type SearchParams = Record<string, string | string[] | undefined>

function firstParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value
  if (Array.isArray(value) && typeof value[0] === "string") return value[0]
  return null
}

export default async function DripforgeHqIndexPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const tab = firstParam(params.tab)?.trim()

  if (tab && LEGACY_ADMIN_TAB_REDIRECTS[tab]) {
    const target = LEGACY_ADMIN_TAB_REDIRECTS[tab]!
    const [path, embeddedQuery] = target.split("?")
    const next = new URLSearchParams()
    if (embeddedQuery) {
      new URLSearchParams(embeddedQuery).forEach((value, key) => next.set(key, value))
    }
    for (const [key, value] of Object.entries(params)) {
      if (key === "tab") continue
      const resolved = firstParam(value)
      if (resolved != null && resolved !== "") next.set(key, resolved)
    }
    const qs = next.toString()
    redirect(`${adminPortalPath(path ?? "")}${qs ? `?${qs}` : ""}`)
  }

  redirect(adminPortalPath("/dashboard"))
}
