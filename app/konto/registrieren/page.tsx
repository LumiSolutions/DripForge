import { Suspense } from "react"
import { RegisterForm } from "./register-form"

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
