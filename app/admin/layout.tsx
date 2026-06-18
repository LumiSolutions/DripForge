import type { ReactNode } from "react"

/** Legacy /admin — leitet in den Seiten weiter; Layout bleibt neutral. */
export default function LegacyAdminLayout({ children }: { children: ReactNode }) {
  return children
}
