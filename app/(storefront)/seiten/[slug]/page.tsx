import { redirect } from "next/navigation"

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ preview?: string; staging?: string }>
}

/** Legacy `/seiten/[slug]` → saubere URL `/{slug}`. */
export default async function LegacySeitenRedirect({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params
  const query = await searchParams
  const qs = new URLSearchParams()
  if (query.preview === "1") qs.set("preview", "1")
  if (query.staging === "1") qs.set("staging", "1")
  const suffix = qs.toString() ? `?${qs.toString()}` : ""
  redirect(`/${encodeURIComponent(slug)}${suffix}`)
}
