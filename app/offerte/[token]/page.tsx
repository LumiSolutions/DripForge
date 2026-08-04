import { OfferteRespondClient } from "@/components/offerte/offerte-respond-client"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ token: string }>
  searchParams: Promise<{ action?: string }>
}

export default async function OffertePublicPage({
  params,
  searchParams,
}: PageProps) {
  const { token } = await params
  const query = await searchParams
  const initialAction =
    query.action === "accept" || query.action === "reject"
      ? query.action
      : null

  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-stone-100 px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <OfferteRespondClient token={token} initialAction={initialAction} />
      </div>
    </main>
  )
}
