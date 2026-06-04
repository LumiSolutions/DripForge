"use client"

import { Suspense } from "react"
import { KontoLoginForm } from "@/components/konto/konto-auth-form"

export default function KontoLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          Wird geladen…
        </div>
      }
    >
      <KontoLoginForm />
    </Suspense>
  )
}
