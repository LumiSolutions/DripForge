import { Suspense } from "react"
import { KontoPointsPage } from "@/components/konto/konto-points-page"

export default function PunktePage() {
  return (
    <Suspense fallback={null}>
      <KontoPointsPage />
    </Suspense>
  )
}
