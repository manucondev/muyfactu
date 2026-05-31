"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EstadoBadge } from "@/components/estado-badge"
import { EmptyState } from "@/components/empty-state"
import { formatCurrency, formatDate, calcImporte } from "@/lib/format"
import { FileStack, Eye, Download, AlertTriangle, FilePlus } from "lucide-react"
import Link from "next/link"
import type { SolicitudFactura } from "@/lib/types"
import { useSearchParams } from "next/navigation"

const filters = ["Todas", "Pendientes", "Aprobadas", "Rechazadas", "Facturadas"] as const
const filterMap: Record<string, string | undefined> = {
  Todas: undefined,
  Pendientes: "pendiente",
  Aprobadas: "aprobada",
  Rechazadas: "rechazada",
  Facturadas: "facturada",
}


export default function SolicitudesPage() {
  const { cliente } = useAuth()
  const supabase = createClient()
  const [solicitudes, setSolicitudes] = useState<SolicitudFactura[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("Todas")
  const [selected, setSelected] = useState<SolicitudFactura | null>(null)
  const searchParams = useSearchParams()
  const previewId = searchParams.get("preview")

  useEffect(() => {
    if (!cliente) return
    async function load() {
      const { data } = await supabase
        .from("solicitudes_factura")
        .select("*")
        .eq("cliente_id", cliente!.id)
        .order("created_at", { ascending: false })
      if (data) setSolicitudes(data)
      setLoading(false)
      if (data && previewId) {
        const solicitudPreview = data.find(s => s.id === previewId)
        if (solicitudPreview) {
          setSelected(solicitudPreview)
        }
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente])

  const filtered = solicitudes.filter(s => {
    const estado = filterMap[filter]
    return !estado || s.estado === estado
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-[1200px] space-y-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-[1200px] space-y-8">
  
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Mis Solicitudes
          </h1>
          <p className="text-sm text-muted-foreground">
            Historial de solicitudes de factura
          </p>
        </div>
  
        <Button asChild>
          <Link href="/cliente/nueva-solicitud">
            <FilePlus className="mr-2 h-4 w-4" /> Nueva Solicitud
          </Link>
        </Button>
  
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {filters.map(f => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={FileStack} title="Sin solicitudes" description="No hay solicitudes con este filtro" />
            </div>
          ) : (
            <div className="mx-auto max-w-[1200px] space-y-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-6 py-3 font-medium">Fecha</th>
                    <th className="px-6 py-3 font-medium">Conceptos</th>
                    <th className="px-6 py-3 font-medium">Importe</th>
                    <th className="px-6 py-3 font-medium">Estado</th>
                    <th className="px-6 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-6 py-4">{formatDate(s.created_at)}</td>
                      <td className="px-6 py-4">{s.conceptos.length} concepto(s)</td>
                      <td className="px-6 py-4 font-medium">{formatCurrency(calcImporte(s.conceptos))}</td>
                      <td className="px-6 py-4"><EstadoBadge estado={s.estado} /></td>
                      <td className="px-6 py-4">
                        <Button variant="ghost" size="sm" onClick={() => setSelected(s)}>
                          <Eye className="mr-1 h-3.5 w-3.5" /> Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de Solicitud</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <EstadoBadge estado={selected.estado} />
                <span className="text-sm text-muted-foreground">{formatDate(selected.created_at)}</span>
              </div>

              {/* Conceptos */}
              <div>
                <h4 className="mb-2 text-sm font-medium">Conceptos</h4>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left">
                        <th className="px-3 py-2 font-medium">Concepto</th>
                        <th className="px-3 py-2 font-medium">Cant.</th>
                        <th className="px-3 py-2 font-medium">Precio</th>
                        <th className="px-3 py-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.conceptos.map((c, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-3 py-2">{c.concepto}</td>
                          <td className="px-3 py-2">{c.cantidad}</td>
                          <td className="px-3 py-2">{formatCurrency(c.precio)}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatCurrency(c.cantidad * c.precio)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30">
                        <td colSpan={3} className="px-3 py-2 text-right font-medium">Total:</td>
                        <td className="px-3 py-2 text-right font-bold text-primary">{formatCurrency(calcImporte(selected.conceptos))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Observaciones */}
              {selected.observaciones && (
                <div>
                  <h4 className="mb-1 text-sm font-medium">Observaciones</h4>
                  <p className="rounded-md bg-muted p-3 text-sm">{selected.observaciones}</p>
                </div>
              )}

              {/* Adjuntos */}
              {selected.adjuntos && selected.adjuntos.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium">Adjuntos</h4>
                  <div className="space-y-1">
                    {selected.adjuntos.map((a, i) => (
                      <Button key={i} variant="outline" size="sm" className="w-full justify-start" asChild>
                        <a href={supabase.storage.from("solicitud-adjuntos").getPublicUrl(a).data.publicUrl} target="_blank" rel="noreferrer">
                          <Download className="mr-2 h-3.5 w-3.5" />
                          {a.split("/").pop()}
                        </a>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Rejection reason */}
              {selected.estado === "rechazada" && selected.motivo_rechazo && (
                <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Motivo del rechazo</p>
                    <p className="text-sm text-destructive/80">{selected.motivo_rechazo}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
