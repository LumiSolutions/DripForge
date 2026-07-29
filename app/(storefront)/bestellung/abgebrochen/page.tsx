import Link from "next/link"
import { XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function BestellungAbgebrochenPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <XCircle className="mx-auto mb-6 h-16 w-16 text-muted-foreground" />
      <h1 className="text-3xl font-bold">Zahlung abgebrochen</h1>
      <p className="mt-4 text-muted-foreground">
        Die Zahlung wurde nicht abgeschlossen. Dein Warenkorb ist weiterhin
        gespeichert — du kannst jederzeit erneut zur Kasse gehen.
      </p>
      <Button asChild className="mt-8 bg-primary hover:bg-primary/90">
        <Link href="/checkout">Zurück zur Kasse</Link>
      </Button>
    </div>
  )
}
