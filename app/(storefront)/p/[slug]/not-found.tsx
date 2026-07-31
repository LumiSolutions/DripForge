import Link from "next/link"

export default function ProductNotFound() {
  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Produkt nicht gefunden</h1>
      <p className="text-muted-foreground">
        Dieses Produkt ist nicht verfügbar oder wurde archiviert.
      </p>
      <Link
        href="/shop"
        className="inline-block text-sm font-medium text-cyan-400 underline-offset-4 hover:underline"
      >
        Zurück zum Shop
      </Link>
    </div>
  )
}