import type { Metadata } from "next"
import { AdminCouponsTab } from "@/components/admin/admin-coupons-tab"

export const metadata: Metadata = {
  title: "Gutscheine | DripForge HQ",
  robots: { index: false, follow: false },
}

export default function AdminCouponsPage() {
  return <AdminCouponsTab />
}
