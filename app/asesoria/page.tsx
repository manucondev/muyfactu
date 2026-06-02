"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatDate } from "@/lib/format"
import Link from "next/link"
import { ArrowUpRight, TrendingUp } from "lucide-react"
import { ClientAvatar } from "@/components/client-avatar"

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export default function AsesoriaHomePage() {
  const { asesoria } = useAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalFacturado: 0,
    totalCobrado: 0,
    pendienteCobro: 0,
    facturasEsteMes: 0,
    facturasUltimoMes: 0,
    clientesActivos: 0,
    solicitudesPendientes: 0,
    ultimasFacturas: [] as any[],
    evolucionMensual: [] as { mes: string; total: number; max: number }[],
  })

  useEffect(() => {
    async function load() {
      if (!asesoria) return

      const [facturasRes, clientesRes, solicitudesRes] = await Promise.all([
        supabase.from("facturas").select("*, clientes(nombre)").eq("asesoria_id", asesoria.id),
        supabase.from("clientes").select("id", { count: "exact" }).eq("asesoria_id", asesoria.id),
        supabase.from("solicitudes_factura").select("*"),
      ])

      const facturas = facturasRes.data || []
      const totalFacturado = facturas.reduce((s, f) => s + f.total, 0)
      const totalCobrado = facturas.filter(f => f.estado === "cobrada").reduce((s, f) => s + f.total, 0)
      const pendienteCobro = facturas.filter(f => f.estado === "pendiente").reduce((s, f) => s + f.total, 0)

      const now = new Date()
      const mesActual = getMonthKey(now)
      const mesAnterior = getMonthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1))
      
      const facturasEsteMes = facturas.filter(f => f.fecha_emision.startsWith(mesActual)).length
      const facturasUltimoMes = facturas.filter(f => f.fecha_emision.startsWith(mesAnterior)).length

      // Evolución últimos 6 meses
      const evolucionMensual = []
      const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dec"]
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const mesKey = getMonthKey(d)
        const total = facturas.filter(f => f.fecha_emision.startsWith(mesKey)).reduce((s, f) => s + f.total, 0)
        evolucionMensual.push({
          mes: meses[d.getMonth()],
          total,
          max: 0, // Se calculará después
        })
      }
      const maxTotal = Math.max(...evolucionMensual.map(e => e.total), 1)
      evolucionMensual.forEach(e => e.max = maxTotal)

      const ultimasFacturas = facturas
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6)

      setStats({
        totalFacturado,
        totalCobrado,
        pendienteCobro,
        facturasEsteMes,
        facturasUltimoMes,
        clientesActivos: clientesRes.count || 0,
        solicitudesPendientes: solicitudesRes.data?.filter(s => s.estado === "pendiente").length || 0,
        ultimasFacturas,
        evolucionMensual,
      })
      setLoading(false)
    }
    load()
  }, [asesoria, supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-[1200px] space-y-8">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-6 lg:grid-cols-12">
            <Skeleton className="h-80 lg:col-span-8" />
            <Skeleton className="h-80 lg:col-span-4" />
          </div>
        </div>
      </div>
    )
  }

  const cambioFacturas = stats.facturasUltimoMes > 0 
    ? ((stats.facturasEsteMes - stats.facturasUltimoMes) / stats.facturasUltimoMes) * 100 
    : 0

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-[1200px] space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Estado financiero</h1>
          <p className="text-muted-foreground mt-1">
            Resumen de actividad y facturación
          </p>
        </div>

        {/* Layout asimétrico - Columna grande izquierda + columna derecha */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Columna izquierda - KPI principal + gráfico */}
          <div className="space-y-6 lg:col-span-8">
            {/* KPI destacado grande */}
            <div className="group relative overflow-hidden rounded-lg border border-border/50 bg-card p-8 transition-all hover:border-border hover:shadow-lg">
              <div className="relative z-10">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Ingresos acumulados
                    </p>
                    <p className="mt-3 text-5xl font-semibold tabular-nums tracking-tight">
                      {formatCurrency(stats.totalFacturado)}
                    </p>
                    <div className="mt-4 flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5 text-emerald-600">
                        <TrendingUp className="h-4 w-4" />
                        <span className="font-medium">{formatCurrency(stats.totalCobrado)}</span>
                        <span className="text-muted-foreground">cobrado</span>
                      </div>
                      <div className="h-4 w-px bg-border" />
                      <div className="text-muted-foreground">
                        <span className="font-medium text-foreground">{stats.facturasEsteMes}</span> facturas este mes
                        {cambioFacturas !== 0 && (
                          <span className={cambioFacturas > 0 ? "text-emerald-600" : "text-red-600"}>
                            {" "}({cambioFacturas > 0 ? "+" : ""}{cambioFacturas.toFixed(0)}%)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Link 
                    href="/asesoria/facturacion"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary transition-all hover:bg-primary hover:text-primary-foreground"
                  >
                    <ArrowUpRight className="h-5 w-5" />
                  </Link>
                </div>
              </div>
              {/* Fondo decorativo sutil */}
              <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            </div>

            {/* Actividad reciente compacta */}
            <div className="rounded-lg border border-border/50 bg-card">
              <div className="border-b border-border/50 px-5 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold">Actividad reciente</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Últimas facturas emitidas</p>
                  </div>
                  <Link 
                    href="/asesoria/facturacion" 
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Ver todas →
                  </Link>
                </div>
              </div>
              <div className="divide-y divide-border/40">
                {stats.ultimasFacturas.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No hay facturas emitidas
                  </div>
                ) : (
                  stats.ultimasFacturas.slice(0, 4).map(f => {
                    const clienteNombre = (f as any).clientes?.nombre || "Sin nombre"
                    return (
                      <Link
                        key={f.id}
                        href="/asesoria/facturacion"
                        className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-muted/40"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <ClientAvatar name={clienteNombre} className="h-8 w-8 shrink-0" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{clienteNombre}</p>
                            <p className="font-mono text-xs text-muted-foreground">{f.numero_factura} · {formatDate(f.fecha_emision)}</p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold tabular-nums">{formatCurrency(f.total)}</p>
                          <p className={f.estado === "cobrada" ? "text-xs text-emerald-700" : "text-xs text-amber-700"}>
                            {f.estado === "cobrada" ? "Cobrada" : "Pendiente de cobro"}
                          </p>
                        </div>
                      </Link>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* Columna derecha - Stats secundarios */}
          <div className="space-y-4 lg:col-span-4">
            {/* Cobrado */}
            <div className="rounded-lg border border-border/50 bg-card p-5 transition-all hover:border-border hover:shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Cobrado
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-emerald-700">
                {formatCurrency(stats.totalCobrado)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {stats.totalFacturado > 0 
                  ? `${((stats.totalCobrado / stats.totalFacturado) * 100).toFixed(0)}% del total`
                  : "—"}
              </p>
            </div>

            {/* Pendiente */}
            <div className="rounded-lg border border-border/50 bg-card p-5 transition-all hover:border-border hover:shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Por cobrar
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-amber-600">
                {formatCurrency(stats.pendienteCobro)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Pendiente de cobro
              </p>
            </div>

            {/* Quick stats */}
            <div className="space-y-2">
              <Link href="/asesoria/clientes">
                <div className="rounded-lg border border-border/50 bg-card p-4 transition-all hover:border-border hover:shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Clientes</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{stats.clientesActivos}</p>
                </div>
              </Link>

              <Link href="/asesoria/facturacion">
                <div className="rounded-lg border border-border/50 bg-card p-4 transition-all hover:border-border hover:shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Solicitudes pendientes de revisión</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{stats.solicitudesPendientes}</p>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Evolución mensual ampliada */}
        <div className="rounded-lg border border-border/50 bg-card p-6">
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">Evolución mensual</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Facturación emitida durante los últimos 6 meses
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Importes por mes</p>
          </div>

          <div className="mt-2" style={{ height: 320 }}>
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
                gap: 18,
                height: "100%",
                width: "100%",
              }}
            >
              {stats.evolucionMensual.map((item, i) => {
                const height = item.max > 0 && item.total > 0 ? (item.total / item.max) * 100 : 0
                const barHeight = item.total > 0 ? Math.max(height, 8) : 0

                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      flex: 1,
                      minWidth: 0,
                      height: "100%",
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "flex-end",
                        flex: 1,
                        minHeight: 0,
                        borderRadius: 14,
                        background: "rgba(15, 23, 42, 0.035)",
                        border: "1px solid rgba(15, 23, 42, 0.06)",
                        padding: "12px 12px 0",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: `${barHeight}%`,
                          minHeight: item.total > 0 ? 8 : 0,
                          borderRadius: "10px 10px 0 0",
                          background: item.total > 0
                            ? "linear-gradient(180deg, hsl(var(--primary)) 0%, rgba(59, 130, 246, 0.72) 100%)"
                            : "transparent",
                          boxShadow: item.total > 0 ? "0 10px 24px rgba(59, 130, 246, 0.18)" : "none",
                          transition: "height 220ms ease",
                        }}
                        title={`${item.mes}: ${formatCurrency(item.total)}`}
                      />
                    </div>
                    <div className="mt-3 text-center">
                      <p className="text-xs font-medium text-muted-foreground">{item.mes}</p>
                      <p className="mt-1 text-xs font-semibold tabular-nums text-foreground">
                        {item.total > 0 ? formatCurrency(item.total) : "—"}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}