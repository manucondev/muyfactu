"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bell, FileText, CheckCircle, XCircle, Receipt, CreditCard } from "lucide-react"
import { timeAgo } from "@/lib/format"
import type { Notificacion } from "@/lib/types"

const iconMap: Record<string, React.ElementType> = {
  solicitud_nueva: FileText,
  solicitud_aprobada: CheckCircle,
  solicitud_rechazada: XCircle,
  factura_generada: Receipt,
  factura_cobrada: CreditCard,
}

export function NotificationBell() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notificacion[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!user) return

    async function load() {
      const { data } = await supabase
        .from("notificaciones")
        .select("*")
        .eq("destinatario_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10)
      if (data) {
        setNotifications(data)
        setUnreadCount(data.filter(n => !n.leida).length)
      }
    }
    load()

    const channel = supabase
      .channel("notificaciones-" + user.id)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notificaciones",
        filter: `destinatario_id=eq.${user.id}`,
      }, (payload) => {
        const newNotif = payload.new as Notificacion
        setNotifications(prev => [newNotif, ...prev.slice(0, 9)])
        setUnreadCount(prev => prev + 1)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function markRead(id: string) {
    await supabase.from("notificaciones").update({ leida: true }).eq("id", id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  async function markAllRead() {
    if (!user) return
    await supabase.from("notificaciones").update({ leida: true }).eq("destinatario_id", user.id).eq("leida", false)
    setNotifications(prev => prev.map(n => ({ ...n, leida: true })))
    setUnreadCount(0)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount}
            </span>
          )}
          <span className="sr-only">Notificaciones</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="text-sm font-semibold">Notificaciones</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={markAllRead}>
              Marcar todas leidas
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">Sin notificaciones</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map(n => {
                const Icon = iconMap[n.tipo] || Bell
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      markRead(n.id)
                      if (n.link) {
                        window.location.href = n.link
                        setOpen(false)
                      }
                    }}
                    className={`flex items-start gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/50 ${!n.leida ? "bg-primary/5" : ""}`}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-tight">{n.titulo}</p>
                      <p className="text-xs text-muted-foreground leading-snug">{n.mensaje}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.leida && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
