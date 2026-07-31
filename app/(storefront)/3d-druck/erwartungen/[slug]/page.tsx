import { ExpectItemDetail } from "@/components/dripforge/views/expect-item-detail"

export default async function ThreeDExpectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <ExpectItemDetail variant="3d" slug={slug} />
}
