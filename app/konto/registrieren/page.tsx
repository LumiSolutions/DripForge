"use client"

import { Suspense } from "react"
import { KontoRegisterForm } from "@/components/konto/konto-auth-form"

function RegisterForm() {
  return <KontoRegisterForm />
}

export default function KontoRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          Lade Registrierung…
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  )
}
