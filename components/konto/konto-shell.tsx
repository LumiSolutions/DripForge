"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, LogOut, Palette, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/konto", label: "Übersicht", icon: LayoutDashboard, exact: true },
  { href: "/konto/bestellungen", label: "Bestellungen", icon: Package, exact: false },
  { href: "/konto/designs", label: "Meine Designs", icon: Palette, exact: false },
]

export function KontoShell({
  children,
  accountName,
  authMode = false,
}: {
  children: React.ReactNode
  accountName?: string
  /** Login/Registrierung: kein Seitenmenue, kein Abmelden */
  authMode?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await fetch("/api/konto/logout", { method: "POST" })
    router.push("/konto/login")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/ChatGPT%20Image%2016.%20Mai%202026%2C%2022_19_51-CjFqSwPCG95cJ4BMP2Ono6hKObBX8y.png"
              alt="DripForge"
              width={32}
              height={32}
              className="rounded"
            />
            <span className="text-xl font-bold">
              <span className="text-primary">Drip</span>
              <span className="bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
                Forge
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {!authMode && accountName && (
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {accountName}
              </span>
            )}
            {!authMode && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleLogout()}
              >
                <LogOut className="mr-2 h-3.5 w-3.5" />
                Abmelden
              </Button>
            )}
            {authMode && (
              <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
                ← Shop
              </Link>
            )}
          </div>
        </div>
      </header>

      <div
        className={cn(
          "mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8",
          !authMode && "md:flex-row"
        )}
      >
        {!authMode && (
        <nav className="flex shrink-0 flex-row gap-2 md:w-52 md:flex-col">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        )}
        <main className={cn("min-w-0 flex-1", authMode && "mx-auto w-full max-w-lg")}>
          {children}
        </main>
      </div>
    </div>
  )
}
