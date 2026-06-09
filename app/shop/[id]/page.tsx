import { redirect } from "next/navigation"

export const revalidate = 0
export const dynamic = "force-dynamic"

type PageProps = { params: Promise<{ id: string }> }

export default async function ShopProductDeepLinkPage({ params }: PageProps) {
  const { id } = await params
  const productId = decodeURIComponent(id).trim()
  if (!productId) {
    redirect("/?view=shop")
  }
  redirect(`/?view=shop&product=${encodeURIComponent(productId)}`)
}
