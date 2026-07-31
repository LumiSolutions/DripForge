import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { adminPortalPath } from "@/lib/admin/admin-portal-path"

export const metadata: Metadata = {
  title: "Website Stagingpage | DripForge HQ",
  robots: { index: false, follow: false },
}

/** Legacy-URL — weitergeleitet auf «Website bearbeiten». */
export default function AdminWebsiteStagingPage() {
  redirect(adminPortalPath("/edit"))
}
