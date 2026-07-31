import type { Metadata } from "next"
import { AdminInContextEditor } from "@/components/admin/admin-in-context-editor"

export const metadata: Metadata = {
  title: "In-Context Editor | DripForge HQ",
  robots: { index: false, follow: false },
}

export default function AdminInContextEditorPage() {
  return <AdminInContextEditor />
}
