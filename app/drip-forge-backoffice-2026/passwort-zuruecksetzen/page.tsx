import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { AdminResetPasswordForm } from "@/components/admin/admin-password-reset-forms"

export default function BackofficePasswortZuruecksetzenPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      }
    >
      <AdminResetPasswordForm />
    </Suspense>
  )
}
