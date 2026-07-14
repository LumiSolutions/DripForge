import { redirect } from "next/navigation"
import { adminPortalPath } from "@/lib/admin/admin-portal-path"

export default function BelegePortalPage() {
  redirect(`${adminPortalPath()}?tab=belege`)
}
