import { redirect } from "next/navigation"

/** Legacy-URL → neue Cancel-Seite */
export default function LegacyCheckoutCancelledPage() {
  redirect("/bestellung/abgebrochen")
}
