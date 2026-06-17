import { StorefrontLayoutWrapper } from "@/components/dripforge/storefront-layout-wrapper"

export default function StorefrontRouteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <StorefrontLayoutWrapper>{children}</StorefrontLayoutWrapper>
}
