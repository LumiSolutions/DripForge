import { StorefrontLaunchLayout } from "@/components/dripforge/storefront-launch-layout"

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <StorefrontLaunchLayout>{children}</StorefrontLaunchLayout>
}
