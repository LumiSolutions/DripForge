"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FaqPageContent } from "@/components/dripforge/views/faq-page-content"

export function PageFAQ({
  setCurrentView,
}: {
  setCurrentView: (view: string) => void
}) {
  return (
    <>
      <FaqPageContent />
      <div className="mx-auto max-w-4xl px-4 pb-12">
        <Card className="border-cyan-500/30 bg-gradient-to-b from-cyan-500/10 to-transparent">
          <CardContent className="p-8 text-center">
            <h2 className="mb-2 text-2xl font-bold">Noch Fragen?</h2>
            <p className="mb-6 text-muted-foreground">
              Unser Team hilft dir gerne weiter
            </p>
            <Button
              onClick={() => setCurrentView("kontakt")}
              className="bg-primary hover:bg-primary/90"
            >
              Kontakt aufnehmen
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="mt-4 text-xs text-muted-foreground">
              Oder besuche die{" "}
              <Link href="/faq" className="text-primary hover:underline">
                FAQ-Seite
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
