"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatDate } from "@/lib/format"
import Link from "next/link"
import { ArrowUpRight, TrendingUp } from "lucide-react"
import { ClientAvatar } from "@/components/client-avatar"

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
      const mesActual = now.toISOString().substring(0, 7)
      const mesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().substring(0, 7)
      
      const facturasEsteMes = facturas.filter(f => f.fecha_emision.startsWith(mesActual)).length
      const facturasUltimoMes = facturas.filter(f => f.fecha_emision.startsWith(mesAnterior)).length

      // Evolución últimos 6 meses
      const evolucionMensual = []
      const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dec"]
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const mesKey = d.toISOString().substring(0, 7)
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

            {/* Gráfico simple de barras */}
            <div className="rounded-lg border border-border/50 bg-card p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-base font-semibold">Evolución mensual</h2>
                <p className="text-xs text-muted-foreground">Últimos 6 meses</p>
              </div>
              <div className="flex items-end justify-between gap-3" style={{ height: "160px" }}>
                {stats.evolucionMensual.map((item, i) => {
                  const height = item.max > 0 ? (item.total / item.max) * 100 : 0
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center gap-3">
                      <div className="relative w-full">
                        <div 
                          className="w-full rounded-t-md bg-primary/20 transition-all hover:bg-primary/30"
                          style={{ height: `${Math.max(height, 2)}%` }}
                        >
                          <div 
                            className="w-full rounded-t-md bg-primary transition-all"
                            style={{ height: "100%" }}
                          />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-medium text-muted-foreground">{item.mes}</p>
                        {item.total > 0 && (
                          <p className="mt-0.5 text-xs font-semibold tabular-nums">{formatCurrency(item.total)}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
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

        {/* Tabla actividad reciente */}
        <div className="rounded-lg border border-border/50 bg-card">
          <div className="border-b border-border/50 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Actividad reciente</h2>
              <Link 
                href="/asesoria/facturacion" 
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Ver todas →
              </Link>
            </div>
          </div>
          <div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Número
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Importe
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.ultimasFacturas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-muted-foreground">
                      No hay facturas emitidas
                    </td>
                  </tr>
                ) : (
                  stats.ultimasFacturas.map(f => {
                    const clienteNombre = (f as any).clientes?.nombre || "Sin nombre"
                    return (
                      <tr key={f.id} className="border-b border-border/30 transition-colors hover:bg-muted/40">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <ClientAvatar name={clienteNombre} className="h-8 w-8" />
                            <span className="font-medium">{clienteNombre}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <span className="font-mono text-xs text-muted-foreground">{f.numero_factura}</span>
                        </td>
                        <td className="px-6 py-3">
                          <span className="text-sm text-muted-foreground">{formatDate(f.fecha_emision)}</span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <span className="font-semibold tabular-nums">{formatCurrency(f.total)}</span>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                            f.estado === "cobrada" 
                              ? "bg-emerald-50 text-emerald-700" 
                              : f.estado === "pendiente"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-red-50 text-red-700"
                          }`}>
                            {f.estado === "pendiente" ? "Pendiente de cobro" : f.estado === "cobrada" ? "Cobrada" : f.estado}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}