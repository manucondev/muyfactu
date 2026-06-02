"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EstadoBadge } from "@/components/estado-badge"
import { EmptyState } from "@/components/empty-state"
import { formatCurrency, formatDate, calcImporte } from "@/lib/format"
import { FileStack, Receipt, Eye } from "lucide-react"
import Link from "next/link"
import type { SolicitudFactura, Factura } from "@/lib/types"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export default function ClienteDashboard() {
  const { cliente } = useAuth()
  const [solicitudes, setSolicitudes] = useState<SolicitudFactura[]>([])
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [facturasMes, setFacturasMes] = useState(0)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const [selectedFactura, setSelectedFactura] = useState<Factura | null>(null)
  const [facturaOpen, setFacturaOpen] = useState(false)
  const [lineasFactura, setLineasFactura] = useState<any[]>([])
  const [loadingLineas, setLoadingLineas] = useState(false)

  useEffect(() => {
    if (!cliente) return
    async function load() {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [solRes, facRes, facMesRes] = await Promise.all([
        supabase
          .from("solicitudes_factura")
          .select("*")
          .eq("cliente_id", cliente!.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("facturas")
          .select("*, clientes(nombre, nif, email, telefono, direccion, cp, ciudad, banco, iban, bic_swift)")
          .eq("cliente_id", cliente!.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("facturas")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", cliente!.id)
          .gte("fecha_emision", firstDay),
      ])

      if (solRes.data) setSolicitudes(solRes.data)
      if (facRes.data) setFacturas(facRes.data)
      setFacturasMes(facMesRes.count ?? 0)
      setLoading(false)
    }
    load()
  }, [cliente, supabase])

  async function handleVerFactura(factura: Factura) {
    setSelectedFactura(factura)
    setFacturaOpen(true)
    setLoadingLineas(true)
    
    const { data } = await supabase
      .from("lineas_factura")
      .select("*")
      .eq("factura_id", factura.id)
      .order("orden")
    
    if (data) setLineasFactura(data)
    setLoadingLineas(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-[1200px] space-y-8">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  const pendientes = solicitudes.filter(s => s.estado === "pendiente").length
  const facMes = facturasMes
  const pendientePago = facturas.filter(f => f.estado === "pendiente").reduce((s, f) => s + f.total, 0)

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-[1200px] space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Bienvenido, {cliente?.nombre}</h1>
            <p className="text-muted-foreground mt-1">
              Resumen de tu actividad
            </p>
          </div>
          <Button asChild>
            <Link href="/cliente/nueva-solicitud">
              Nueva Solicitud
            </Link>
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="overflow-hidden">
            <CardContent className="flex items-center gap-4 p-0">
              <div className="h-24 w-1.5 bg-amber-400" />
              <div className="py-6 pr-6">
                <p className="text-sm text-muted-foreground">Solicitudes pendientes de revisión</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{pendientes}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardContent className="flex items-center gap-4 p-0">
              <div className="h-24 w-1.5 bg-blue-500" />
              <div className="py-6 pr-6">
                <p className="text-sm text-muted-foreground">Facturas este mes</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{facMes}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardContent className="flex items-center gap-4 p-0">
              <div className="h-24 w-1.5 bg-red-400" />
              <div className="py-6 pr-6">
                <p className="text-sm text-muted-foreground">Pendiente de pago</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(pendientePago)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Last invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Ultimas Facturas</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/cliente/facturas" scroll={true}>Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {facturas.length === 0 ? (
              <EmptyState icon={Receipt} title="Sin facturas" description="Aun no tienes facturas generadas" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">N</th>
                      <th className="pb-2 pr-4 font-medium">Fecha</th>
                      <th className="pb-2 pr-4 font-medium">Total</th>
                      <th className="pb-2 pr-4 font-medium">Estado</th>
                      <th className="pb-2 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturas.map(f => (
                      <tr key={f.id} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-medium">{f.serie}-{String(f.numero).padStart(4, "0")}</td>
                        <td className="py-3 pr-4">{formatDate(f.fecha_emision)}</td>
                        <td className="py-3 pr-4 font-medium">{formatCurrency(f.total)}</td>
                        <td className="py-3 pr-4"><EstadoBadge estado={f.estado} tipo="factura" /></td>
                        <td className="py-3">
                        <Button variant="ghost" size="sm" onClick={() => handleVerFactura(f)}>
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

        {/* Solicitudes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Mis Solicitudes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/cliente/solicitudes" scroll={true}>Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {solicitudes.length === 0 ? (
              <EmptyState icon={FileStack} title="Sin solicitudes" description="Envia tu primera solicitud de factura">
                <Button asChild size="sm">
                  <Link href="/cliente/nueva-solicitud">Nueva Solicitud</Link>
                </Button>
              </EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Fecha</th>
                      <th className="pb-2 pr-4 font-medium">Conceptos</th>
                      <th className="pb-2 pr-4 font-medium">Importe</th>
                      <th className="pb-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {solicitudes.slice(0, 5).map(s => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-3 pr-4">{formatDate(s.created_at)}</td>
                        <td className="py-3 pr-4">{s.conceptos.length} concepto(s)</td>
                        <td className="py-3 pr-4 font-medium">{formatCurrency(calcImporte(s.conceptos))}</td>
                        <td className="py-3"><EstadoBadge estado={s.estado} tipo="solicitud" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Factura Detail Modal */}
        <Dialog open={facturaOpen} onOpenChange={setFacturaOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Factura {selectedFactura?.numero_factura}</DialogTitle>
            </DialogHeader>
            {selectedFactura && (
              <div className="space-y-6">
                {/* Header Info */}
                <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 p-4">
                  <EstadoBadge estado={selectedFactura.estado} tipo="factura" />
                  <div className="text-sm">
                    <span className="text-muted-foreground">Emitida:</span>{" "}
                    <span className="font-medium">{formatDate(selectedFactura.fecha_emision)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Vencimiento:</span>{" "}
                    <span className="font-medium">{formatDate(selectedFactura.fecha_vencimiento)}</span>
                  </div>
                </div>

                {/* Datos del Cliente */}
                <div className="rounded-lg border bg-card p-4">
                  <h3 className="mb-3 text-sm font-semibold">Datos de Facturación</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Nombre:</span>{" "}
                      <span className="font-medium">{(selectedFactura as any).clientes?.nombre || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">NIF:</span>{" "}
                      <span className="font-medium">{(selectedFactura as any).clientes?.nif || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>{" "}
                      <span className="font-medium">{(selectedFactura as any).clientes?.email || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Teléfono:</span>{" "}
                      <span className="font-medium">{(selectedFactura as any).clientes?.telefono || "—"}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Dirección:</span>{" "}
                      <span className="font-medium">{(selectedFactura as any).clientes?.direccion || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">CP:</span>{" "}
                      <span className="font-medium">{(selectedFactura as any).clientes?.cp || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ciudad:</span>{" "}
                      <span className="font-medium">{(selectedFactura as any).clientes?.ciudad || "—"}</span>
                    </div>
                    {(selectedFactura as any).clientes?.banco && (
                      <>
                        <div>
                          <span className="text-muted-foreground">Banco:</span>{" "}
                          <span className="font-medium">{(selectedFactura as any).clientes?.banco}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">IBAN:</span>{" "}
                          <span className="font-mono text-xs">{(selectedFactura as any).clientes?.iban}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Conceptos */}
                <div>
                  <h3 className="mb-3 font-semibold">Conceptos</h3>
                  {loadingLineas ? (
                    <Skeleton className="h-32 w-full" />
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 pr-4 font-medium">Concepto</th>
                          <th className="pb-2 pr-4 text-right font-medium">Cantidad</th>
                          <th className="pb-2 pr-4 text-right font-medium">Precio Unit.</th>
                          <th className="pb-2 pr-4 text-right font-medium">IVA %</th>
                          <th className="pb-2 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineasFactura.map(l => (
                          <tr key={l.id} className="border-b last:border-0">
                            <td className="py-2 pr-4">{l.concepto}</td>
                            <td className="py-2 pr-4 text-right">{l.cantidad}</td>
                            <td className="py-2 pr-4 text-right">{formatCurrency(l.precio_unitario)}</td>
                            <td className="py-2 pr-4 text-right">{l.porcentaje_iva}%</td>
                            <td className="py-2 text-right font-semibold">{formatCurrency(l.importe_linea)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Totales */}
                <div className="space-y-3 rounded-lg border bg-card p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Base Imponible</span>
                    <span className="font-medium">{formatCurrency(selectedFactura.base_imponible)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">IVA</span>
                    <span className="font-medium">{formatCurrency(selectedFactura.iva_total)}</span>
                  </div>
                  {selectedFactura.retencion_irpf > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Retención IRPF</span>
                      <span className="font-medium text-destructive">-{formatCurrency(selectedFactura.retencion_irpf)}</span>
                    </div>
                  )}
                  <div className="border-t pt-3">
                    <div className="flex justify-between">
                      <span className="text-lg font-bold">TOTAL</span>
                      <span className="text-lg font-bold text-primary">{formatCurrency(selectedFactura.total)}</span>
                    </div>
                  </div>
                </div>

                {/* QR Verifactu */}
                {selectedFactura.qr_data && (
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">✓ Factura con Verifactu</p>
                    <p className="font-mono text-xs text-muted-foreground break-all">{selectedFactura.qr_data}</p>
                  </div>
                )}

                {/* Observaciones */}
                {selectedFactura.observaciones && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Observaciones</h3>
                    <p className="rounded-lg bg-muted/50 p-3 text-sm">{selectedFactura.observaciones}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setFacturaOpen(false)}>
                    Cerrar
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
