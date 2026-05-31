"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface SidebarProps {
  userType: "asesoria" | "cliente"
  userName?: string
}

export function Sidebar({ userType, userName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const asesoriaLinks = [
    { href: "/asesoria", label: "Resumen", section: "general" },
    { href: "/asesoria/clientes", label: "Clientes", section: "general" },
    { href: "/asesoria/facturacion", label: "Facturación", section: "general" },
    { href: "/asesoria/configuracion", label: "Configuración", section: "settings" },
  ]

  const clienteLinks = [
    { href: "/cliente", label: "Resumen", section: "general" },
    { href: "/cliente/nueva-solicitud", label: "Nueva Solicitud", section: "general" },
    { href: "/cliente/facturas", label: "Mis Facturas", section: "general" },
    { href: "/cliente/perfil", label: "Mi Perfil", section: "settings" },
  ]

  const links = userType === "asesoria" ? asesoriaLinks : clienteLinks
  const generalLinks = links.filter(l => l.section === "general")
  const settingsLinks = links.filter(l => l.section === "settings")

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo con más peso */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <span className="text-xl font-semibold tracking-tight">
          <span className="text-foreground">Muy</span>
          <span className="bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">Factu</span>
        </span>
      </div>

      {/* Navigation estructurada */}
      <nav className="flex-1 px-3 py-6 space-y-6">
        {/* Sección principal */}
        <div className="space-y-1">
          {generalLinks.map((link) => {
            const isActive = pathname === link.href
            
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-muted hover:text-sidebar-foreground"
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        {/* Separador */}
        <div className="border-t border-sidebar-border" />

        {/* Sección configuración */}
        <div className="space-y-1">
          <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Ajustes
          </p>
          {settingsLinks.map((link) => {
            const isActive = pathname === link.href
            
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-muted hover:text-sidebar-foreground"
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Footer con perfil */}
      <div className="border-t border-sidebar-border p-4 space-y-2">
        {/* Perfil */}
        <div className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted cursor-pointer">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-sm font-semibold text-white">
            {userName ? userName.charAt(0).toUpperCase() : (userType === "asesoria" ? "A" : "C")}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {userName || (userType === "asesoria" ? "Asesoría" : "Cliente")}
            </p>
            <p className="text-xs text-muted-foreground truncate">Ver perfil</p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}