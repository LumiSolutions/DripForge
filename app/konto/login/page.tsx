import { Suspense } from "react"
import { LoginForm } from "./login-form"

export default function KontoLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          Wird geladen…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
