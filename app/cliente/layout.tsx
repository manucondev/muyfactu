"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { NotificationBell } from "@/components/notification-bell"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Menu, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"


const mainNavItems = [
  { href: "/cliente", label: "Resumen" },
  { href: "/cliente/nueva-solicitud", label: "Nueva Solicitud" },
  { href: "/cliente/facturas", label: "Mis Facturas" },
]

const settingsNavItems = [
  { href: "/cliente/perfil", label: "Mi Perfil" },
]


function SidebarNav({ pathname, onNavigate, userName }: { pathname: string; onNavigate?: () => void; userName?: string }) {
  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <span className="text-xl font-semibold tracking-tight">
          <span className="text-foreground">Muy</span>
          <span className="bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">Factu</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-6">
        {/* Main section */}
        <div className="space-y-1">
          {mainNavItems.map(item => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-muted hover:text-sidebar-foreground"
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* Separator */}
        <div className="border-t border-sidebar-border" />

        {/* Settings section */}
        <div className="space-y-1">
          <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Ajustes
          </p>
          {settingsNavItems.map(item => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-muted hover:text-sidebar-foreground"
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Footer with profile */}
      <div className="border-t border-sidebar-border p-4 space-y-2">
        <Link href="/cliente/perfil">
          <div className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted cursor-pointer">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-sm font-semibold text-white">
              {userName ? userName.charAt(0).toUpperCase() : "C"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userName || "Cliente"}</p>
              <p className="text-xs text-muted-foreground truncate">Ver perfil</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  const { user, cliente, loading, signOut, userType } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!loading && (!user || userType !== "cliente")) {
      router.push("/")
    }
  }, [loading, user, userType, router])

  async function handleLogout() {
    await signOut()
    router.push("/")
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    )
  }

  if (!user || userType !== "cliente") return null

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        <SidebarNav pathname={pathname} userName={cliente?.nombre} />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-border/50 bg-card px-6">
          <div className="flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 bg-sidebar">
                <SidebarNav pathname={pathname} onNavigate={() => setMobileOpen(false)} userName={cliente?.nombre} />
              </SheetContent>
            </Sheet>
            <h2 className="text-sm font-medium text-muted-foreground">
              {cliente?.nombre}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Salir
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}