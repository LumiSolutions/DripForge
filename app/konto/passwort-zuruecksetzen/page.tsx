import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { KontoResetPasswordForm } from "@/components/konto/password-reset-forms"

export default function PasswortZurücksetzenPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <KontoResetPasswordForm />
    </Suspense>
  )
}
