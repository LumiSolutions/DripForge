import { ExpectItemDetail } from "@/components/dripforge/views/expect-item-detail"

export default async function LaserExpectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <ExpectItemDetail variant="laser" slug={slug} />
}
