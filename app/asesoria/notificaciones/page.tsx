"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
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

export default function NotificacionesAsesoriaPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [notifications, setNotifications] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("todas")

  useEffect(() => {
    if (!user) return
    async function load() {
      const { data } = await supabase
        .from("notificaciones")
        .select("*")
        .eq("destinatario_id", user!.id)
        .order("created_at", { ascending: false })
      if (data) setNotifications(data)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function markAllRead() {
    if (!user) return
    await supabase
      .from("notificaciones")
      .update({ leida: true })
      .eq("destinatario_id", user.id)
      .eq("leida", false)
    setNotifications(prev => prev.map(n => ({ ...n, leida: true })))
  }

  async function markRead(id: string) {
    await supabase.from("notificaciones").update({ leida: true }).eq("id", id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
  }

  const filtered = tab === "no-leidas" ? notifications.filter(n => !n.leida) : notifications
  const unreadCount = notifications.filter(n => !n.leida).length

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Notificaciones</h1>
          <p className="text-sm text-muted-foreground">{unreadCount} sin leer</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            Marcar todas leidas
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="todas">Todas ({notifications.length})</TabsTrigger>
          <TabsTrigger value="no-leidas">No leidas ({unreadCount})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <Card>
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Bell className="mb-3 h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Sin notificaciones</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filtered.map(n => {
                    const Icon = iconMap[n.tipo] || Bell
                    return (
                      <button
                        key={n.id}
                        onClick={() => markRead(n.id)}
                        className={`flex w-full items-start gap-4 px-6 py-4 text-left transition-colors hover:bg-muted/50 ${
                          !n.leida ? "bg-primary/5" : ""
                        }`}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium leading-tight">{n.titulo}</p>
                          <p className="text-sm text-muted-foreground leading-snug">{n.mensaje}</p>
                          <p className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
                        </div>
                        {!n.leida && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
