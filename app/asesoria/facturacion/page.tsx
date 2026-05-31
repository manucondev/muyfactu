"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { EstadoBadge } from "@/components/estado-badge"
import { EmptyState } from "@/components/empty-state"
import { formatCurrency, formatDate, calcImporte } from "@/lib/format"
import { FileText, Receipt, Eye, Download, CheckCircle, Loader2, Search, X, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"
import type { SolicitudFactura, Factura, Concepto } from "@/lib/types"
import { notificarClienteAction } from "@/app/actions/notificaciones"
import ExcelJS from "exceljs"

export default function FacturacionPage() {
  const { asesoria, user } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const [solicitudes, setSolicitudes] = useState<SolicitudFactura[]>([])
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [clientes, setClientes] = useState<{id: string, nombre: string}[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros solicitudes
  const [filterEstado, setFilterEstado] = useState("todas")

  // Filtros facturas
  const [searchFactura, setSearchFactura] = useState("")
  const [filterClienteId, setFilterClienteId] = useState("todos")
  const [filterFacturaEstado, setFilterFacturaEstado] = useState("todas")
  const [filterFechaDesde, setFilterFechaDesde] = useState("")
  const [filterFechaHasta, setFilterFechaHasta] = useState("")

  // Modales
  const [reviewSolicitud, setReviewSolicitud] = useState<SolicitudFactura | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [rejectOpen, setRejectOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedFactura, setSelectedFactura] = useState<Factura | null>(null)
  const [facturaOpen, setFacturaOpen] = useState(false)
  const [lineasFactura, setLineasFactura] = useState<any[]>([])
  const [loadingLineas, setLoadingLineas] = useState(false)

  const loadData = useCallback(async () => {
    if (!asesoria) return
    const [solRes, facRes, clientesRes] = await Promise.all([
      supabase.from("solicitudes_factura")
        .select("*, clientes!inner(nombre, nif, user_id, asesoria_id, email, telefono, direccion, cp, ciudad, banco, iban, bic_swift)")
        .eq("clientes.asesoria_id", asesoria.id)
        .order("created_at", { ascending: false }),
      supabase.from("facturas")
        .select("*, clientes(nombre, nif, email, telefono, direccion, cp, ciudad, banco, iban, bic_swift)")
        .eq("asesoria_id", asesoria.id)
        .order("created_at", { ascending: false }),
      supabase.from("clientes")
        .select("id, nombre")
        .eq("asesoria_id", asesoria.id)
        .order("nombre"),
    ])
    setSolicitudes(solRes.data || [])
    setFacturas(facRes.data || [])
    setClientes(clientesRes.data || [])
    setLoading(false)
  }, [asesoria, supabase])

  useEffect(() => { loadData() }, [loadData])

  // Filtros aplicados
  const filteredSolicitudes = solicitudes.filter(s =>
    filterEstado === "todas" || s.estado === filterEstado
  )

  const filteredFacturas = facturas.filter(f => {
    const searchLower = searchFactura.toLowerCase()
    const matchSearch = !searchFactura ||
      f.numero_factura?.toLowerCase().includes(searchLower) ||
      (f as any).clientes?.nombre?.toLowerCase().includes(searchLower) ||
      (f as any).clientes?.nif?.toLowerCase().includes(searchLower)
    const matchCliente = filterClienteId === "todos" || f.cliente_id === filterClienteId
    const matchEstado = filterFacturaEstado === "todas" || f.estado === filterFacturaEstado
    const matchDesde = !filterFechaDesde || f.fecha_emision >= filterFechaDesde
    const matchHasta = !filterFechaHasta || f.fecha_emision <= filterFechaHasta
    return matchSearch && matchCliente && matchEstado && matchDesde && matchHasta
  })

  const totalFacturado = filteredFacturas.reduce((s, f) => s + f.total, 0)
  const totalCobrado = filteredFacturas.filter(f => f.estado === "cobrada").reduce((s, f) => s + f.total, 0)
  const totalPendiente = filteredFacturas.filter(f => f.estado === "pendiente").reduce((s, f) => s + f.total, 0)

  const hayFiltrosActivos = searchFactura || filterClienteId !== "todos" || filterFacturaEstado !== "todas" || filterFechaDesde || filterFechaHasta

  function limpiarFiltros() {
    setSearchFactura("")
    setFilterClienteId("todos")
    setFilterFacturaEstado("todas")
    setFilterFechaDesde("")
    setFilterFechaHasta("")
  }

  // Export CSV
  function exportCSV() {
    const headers = ["Nº Factura", "Cliente", "NIF", "Fecha Emisión", "Fecha Vencimiento", "Base Imponible", "IVA", "IRPF", "Total", "Estado"]
    const rows = filteredFacturas.map(f => [
      f.numero_factura,
      (f as any).clientes?.nombre || "",
      (f as any).clientes?.nif || "",
      f.fecha_emision,
      f.fecha_vencimiento,
      f.base_imponible.toFixed(2),
      f.iva_total.toFixed(2),
      f.retencion_irpf.toFixed(2),
      f.total.toFixed(2),
      f.estado,
    ])
    const csv = [headers, ...rows].map(r => r.join(";")).join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `facturas_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exportadas ${filteredFacturas.length} facturas`)
  }

  // Export Excel (XLSX via CSV compatible con Excel)
  async function exportExcel() {
    const wb = new ExcelJS.Workbook()
    wb.creator = asesoria?.nombre || "MuyFactu"
    wb.created = new Date()
  
    const ws = wb.addWorksheet("Facturas")
  
    // Columnas con ancho y estilo
    ws.columns = [
      { header: "Nº Factura",       key: "numero",    width: 14 },
      { header: "Cliente",          key: "cliente",   width: 28 },
      { header: "NIF",              key: "nif",       width: 14 },
      { header: "Fecha Emisión",    key: "emision",   width: 14 },
      { header: "Fecha Vencimiento",key: "vencimiento",width: 16 },
      { header: "Base Imponible",   key: "base",      width: 15 },
      { header: "IVA",              key: "iva",       width: 12 },
      { header: "IRPF",             key: "irpf",      width: 12 },
      { header: "Total",            key: "total",     width: 14 },
      { header: "Estado",           key: "estado",    width: 12 },
    ]
  
    // Estilo de cabecera
    ws.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } }
      cell.alignment = { vertical: "middle", horizontal: "center" }
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } }
      }
    })
    ws.getRow(1).height = 28
  
    // Filas de datos
    filteredFacturas.forEach((f, i) => {
      const row = ws.addRow({
        numero:      f.numero_factura,
        cliente:     (f as any).clientes?.nombre || "",
        nif:         (f as any).clientes?.nif || "",
        emision:     f.fecha_emision,
        vencimiento: f.fecha_vencimiento,
        base:        f.base_imponible,
        iva:         f.iva_total,
        irpf:        f.retencion_irpf,
        total:       f.total,
        estado:      f.estado,
      })
  
      // Alternar color de fila
      if (i % 2 === 0) {
        row.eachCell(cell => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } }
        })
      }
  
      // Formato moneda en columnas numéricas
      ;["base", "iva", "irpf", "total"].forEach(key => {
        const cell = row.getCell(key)
        cell.numFmt = "#,##0.00 €"
        cell.alignment = { horizontal: "right" }
      })
  
      // Color por estado
      const estadoCell = row.getCell("estado")
      estadoCell.alignment = { horizontal: "center" }
      if (f.estado === "cobrada") {
        estadoCell.font = { color: { argb: "FF059669" }, bold: true }
      } else if (f.estado === "pendiente") {
        estadoCell.font = { color: { argb: "FFD97706" }, bold: true }
      } else if (f.estado === "vencida") {
        estadoCell.font = { color: { argb: "FFDC2626" }, bold: true }
      }
    })
  
    // Fila de totales al final
    ws.addRow({})
    const totalRow = ws.addRow({
      cliente:  "TOTALES",
      base:     filteredFacturas.reduce((s, f) => s + f.base_imponible, 0),
      iva:      filteredFacturas.reduce((s, f) => s + f.iva_total, 0),
      irpf:     filteredFacturas.reduce((s, f) => s + f.retencion_irpf, 0),
      total:    filteredFacturas.reduce((s, f) => s + f.total, 0),
    })
    totalRow.eachCell(cell => {
      cell.font = { bold: true }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } }
    })
    ;["base", "iva", "irpf", "total"].forEach(key => {
      const cell = totalRow.getCell(key)
      cell.numFmt = "#,##0.00 €"
      cell.alignment = { horizontal: "right" }
    })
  
    // Descargar
    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `facturas_${asesoria?.nombre?.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exportadas ${filteredFacturas.length} facturas`)
  }

  async function handleAprobar(solicitud: SolicitudFactura) {
    setActionLoading(true)
    try {
      await supabase.from("solicitudes_factura").update({ estado: "aprobada" }).eq("id", solicitud.id)
      const clienteUserId = (solicitud as any).clientes?.user_id
      if (clienteUserId) {
        await notificarClienteAction({
          cliente_user_id: clienteUserId,
          tipo: "solicitud_aprobada",
          titulo: "Solicitud aprobada",
          mensaje: "Tu solicitud de factura ha sido aprobada",
          link: "/cliente/solicitudes",
        })
      }
      toast.success("Solicitud aceptada")
      router.push(`/asesoria/generar-factura/${solicitud.id}`)
      loadData() // Recargar datos para mostrar el nuevo estado
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRechazar(solicitud: SolicitudFactura) {
    if (!rejectReason.trim()) { toast.error("Introduce un motivo de rechazo"); return }
    setActionLoading(true)
    try {
      await supabase.from("solicitudes_factura").update({ estado: "rechazada", motivo_rechazo: rejectReason }).eq("id", solicitud.id)
      const clienteUserId = (solicitud as any).clientes?.user_id
      if (clienteUserId) {
        await notificarClienteAction({
          cliente_user_id: clienteUserId,
          tipo: "solicitud_rechazada",
          titulo: "Solicitud rechazada",
          mensaje: rejectReason,
          link: "/cliente/solicitudes",
        })
      }
      toast.success("Solicitud rechazada")
      setRejectOpen(false)
      setReviewOpen(false)
      setRejectReason("")
      loadData()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleMarcarCobrada(factura: Factura) {
    const { error } = await supabase.from("facturas").update({ estado: "cobrada", fecha_cobro: new Date().toISOString().split("T")[0] }).eq("id", factura.id)
    if (error) toast.error(error.message)
    else { toast.success("Factura marcada como cobrada"); loadData() }
  }


  async function openFacturaPdf(pdfPath: string | null) {
    if (!pdfPath) {
      toast.error("PDF no disponible")
      return
    }

    const { data, error } = await supabase.storage
      .from("facturas")
      .createSignedUrl(pdfPath, 60 * 5)

    if (error || !data?.signedUrl) {
      toast.error("No se ha podido abrir el PDF")
      return
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer")
  }

  async function handleVerFactura(factura: Factura) {
    setFacturaOpen(true)
    setLoadingLineas(true)
    const { data: facturaCompleta } = await supabase
      .from("facturas")
      .select("*, clientes(nombre, nif, email, telefono, direccion, cp, ciudad, banco, iban, bic_swift)")
      .eq("id", factura.id)
      .single()
    if (facturaCompleta) setSelectedFactura(facturaCompleta as Factura)
    const { data: lineas } = await supabase.from("lineas_factura").select("*").eq("factura_id", factura.id).order("orden")
    if (lineas) setLineasFactura(lineas)
    setLoadingLineas(false)
  }

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
          <h1 className="text-3xl font-semibold text-foreground">Facturación</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona solicitudes y facturas
          </p>
        </div>

      <Tabs defaultValue="solicitudes">
        <TabsList>
          <TabsTrigger value="solicitudes">Solicitudes Pendientes</TabsTrigger>
          <TabsTrigger value="facturas">Facturas Emitidas</TabsTrigger>
        </TabsList>

        {/* SOLICITUDES TAB */}
        <TabsContent value="solicitudes" className="flex flex-col gap-4 pt-4">
          <div className="flex gap-2">
            {["todas", "pendiente", "aprobada", "rechazada"].map(e => (
              <Button key={e} variant={filterEstado === e ? "default" : "outline"} size="sm" onClick={() => setFilterEstado(e)} className="capitalize">
                {e}
              </Button>
            ))}
          </div>
          <Card>
            <CardContent className="p-0">
              {filteredSolicitudes.length === 0 ? (
                <div className="p-6"><EmptyState icon={FileText} title="Sin solicitudes" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Conceptos</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSolicitudes.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{(s as any).clientes?.nombre || "—"}</TableCell>
                        <TableCell>{formatDate(s.created_at)}</TableCell>
                        <TableCell>{s.conceptos.length} conceptos</TableCell>
                        <TableCell className="text-right">{formatCurrency(calcImporte(s.conceptos))}</TableCell>
                        <TableCell><EstadoBadge estado={s.estado} /></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => { setReviewSolicitud(s); setReviewOpen(true) }}>
                            <Eye className="mr-1 h-4 w-4" /> Revisar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* FACTURAS TAB */}
        <TabsContent value="facturas" className="flex flex-col gap-4 pt-4">

          {/* FILTROS */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3">
                {/* Fila 1: Búsqueda + Cliente */}
                <div className="flex flex-wrap gap-3">
                  <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nº factura, cliente o NIF..."
                      value={searchFactura}
                      onChange={e => setSearchFactura(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={filterClienteId} onValueChange={setFilterClienteId}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Todos los clientes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los clientes</SelectItem>
                      {clientes.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterFacturaEstado} onValueChange={setFilterFacturaEstado}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todos los estados</SelectItem>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="cobrada">Cobrada</SelectItem>
                      <SelectItem value="vencida">Vencida</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Fila 2: Fechas + Botones */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Desde</Label>
                    <Input
                      type="date"
                      value={filterFechaDesde}
                      onChange={e => setFilterFechaDesde(e.target.value)}
                      className="w-40"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Hasta</Label>
                    <Input
                      type="date"
                      value={filterFechaHasta}
                      onChange={e => setFilterFechaHasta(e.target.value)}
                      className="w-40"
                    />
                  </div>
                  {hayFiltrosActivos && (
                    <Button variant="ghost" size="sm" onClick={limpiarFiltros} className="text-muted-foreground">
                      <X className="mr-1 h-3.5 w-3.5" /> Limpiar filtros
                    </Button>
                  )}
                  <div className="ml-auto flex gap-2">
                    <Button variant="outline" size="sm" onClick={exportCSV} disabled={filteredFacturas.length === 0}>
                      <Download className="mr-1 h-3.5 w-3.5" /> CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => exportExcel()} disabled={filteredFacturas.length === 0}>
                      <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Excel
                    </Button>
                  </div>
                </div>

                {/* Resultado */}
                {hayFiltrosActivos && (
                  <p className="text-xs text-muted-foreground">
                    Mostrando <span className="font-medium">{filteredFacturas.length}</span> de {facturas.length} facturas
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Facturado</p><p className="text-xl font-bold text-foreground">{formatCurrency(totalFacturado)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Cobrado</p><p className="text-xl font-bold text-emerald-600">{formatCurrency(totalCobrado)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Pendiente</p><p className="text-xl font-bold text-amber-600">{formatCurrency(totalPendiente)}</p></CardContent></Card>
          </div>

          <Card>
            <CardContent className="p-0">
              {filteredFacturas.length === 0 ? (
                <div className="p-6">
                  <EmptyState icon={Receipt} title="Sin facturas" description={hayFiltrosActivos ? "No hay facturas que coincidan con los filtros" : "No hay facturas emitidas"} />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº Factura</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFacturas.map(f => (
                      <TableRow key={f.id}>
                        <TableCell className="font-mono text-sm">{f.numero_factura}</TableCell>
                        <TableCell className="font-medium">{(f as any).clientes?.nombre || "—"}</TableCell>
                        <TableCell>{formatDate(f.fecha_emision)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(f.total)}</TableCell>
                        <TableCell><EstadoBadge estado={f.estado} /></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleVerFactura(f)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {f.pdf_url && (
                              <Button variant="ghost" size="sm" onClick={() => openFacturaPdf(f.pdf_url)}>
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            {f.estado === "pendiente" && (
                              <Button variant="ghost" size="sm" onClick={() => handleMarcarCobrada(f)}>
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Review Modal */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Revisar Solicitud</DialogTitle></DialogHeader>
          {reviewSolicitud && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{(reviewSolicitud as any).clientes?.nombre}</p>
                  <p className="text-sm text-muted-foreground">NIF: {(reviewSolicitud as any).clientes?.nif}</p>
                </div>
                <EstadoBadge estado={reviewSolicitud.estado} />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewSolicitud.conceptos.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell>{c.concepto}</TableCell>
                      <TableCell className="text-right">{c.cantidad}</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.precio)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(c.cantidad * c.precio)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end text-lg font-bold">
                Total: {formatCurrency(calcImporte(reviewSolicitud.conceptos))}
              </div>
              {(reviewSolicitud as any).observaciones_cliente && (
                <div><Label>Observaciones del Cliente</Label><p className="mt-1 rounded-lg bg-muted p-3 text-sm">{(reviewSolicitud as any).observaciones_cliente}</p></div>
              )}
              {reviewSolicitud.estado === "pendiente" && (
                <div className="flex gap-2">
                  <Button onClick={() => handleAprobar(reviewSolicitud)} disabled={actionLoading} className="flex-1">
                    {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Aceptar y Revisar
                  </Button>
                  <Button variant="destructive" onClick={() => setRejectOpen(true)} className="flex-1">Rechazar</Button>
                </div>
              )}
              {reviewSolicitud.estado === "aprobada" && (
                <div className="flex flex-col gap-3">
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                    <p className="text-sm text-blue-900">✓ Esta solicitud ya está aprobada. Genera la factura para completar el proceso.</p>
                  </div>
                  <Button onClick={() => router.push(`/asesoria/generar-factura/${reviewSolicitud.id}`)} className="w-full">Generar Factura</Button>
                </div>
              )}
              {reviewSolicitud.estado === "rechazada" && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-sm font-medium text-red-900">Solicitud rechazada</p>
                  {reviewSolicitud.motivo_rechazo && <p className="mt-1 text-sm text-red-700">Motivo: {reviewSolicitud.motivo_rechazo}</p>}
                </div>
              )}
              {reviewSolicitud.estado === "facturada" && reviewSolicitud.factura_id && (
                <div className="flex flex-col gap-3">
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                    <p className="text-sm text-green-900">✓ Factura generada correctamente</p>
                  </div>
                  <Button variant="outline" onClick={async () => {
                    const { data: factura } = await supabase.from("facturas").select("*").eq("id", reviewSolicitud.factura_id).single()
                    if (factura) { setReviewOpen(false); handleVerFactura(factura) }
                  }}>Ver Factura</Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Motivo de Rechazo</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <Textarea placeholder="Explica el motivo del rechazo..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={4} />
            <Button variant="destructive" onClick={() => reviewSolicitud && handleRechazar(reviewSolicitud)} disabled={actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar Rechazo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Factura Detail Modal */}
      <Dialog open={facturaOpen} onOpenChange={setFacturaOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Factura {selectedFactura?.numero_factura}</DialogTitle></DialogHeader>
          {selectedFactura && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 p-4">
                  <EstadoBadge estado={selectedFactura.estado} />
                  <div className="text-sm"><span className="text-muted-foreground">Emitida:</span>{" "}<span className="font-medium">{formatDate(selectedFactura.fecha_emision)}</span></div>
                  <div className="text-sm"><span className="text-muted-foreground">Vencimiento:</span>{" "}<span className="font-medium">{formatDate(selectedFactura.fecha_vencimiento)}</span></div>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <h3 className="mb-3 text-sm font-semibold">Datos del Cliente</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div><span className="text-muted-foreground">Nombre:</span>{" "}<span className="font-medium">{(selectedFactura as any).clientes?.nombre || "—"}</span></div>
                    <div><span className="text-muted-foreground">NIF:</span>{" "}<span className="font-medium">{(selectedFactura as any).clientes?.nif || "—"}</span></div>
                    <div><span className="text-muted-foreground">Email:</span>{" "}<span className="font-medium">{(selectedFactura as any).clientes?.email || "—"}</span></div>
                    <div><span className="text-muted-foreground">Teléfono:</span>{" "}<span className="font-medium">{(selectedFactura as any).clientes?.telefono || "—"}</span></div>
                    <div className="col-span-2"><span className="text-muted-foreground">Dirección:</span>{" "}<span className="font-medium">{(selectedFactura as any).clientes?.direccion || "—"}</span></div>
                    <div><span className="text-muted-foreground">CP:</span>{" "}<span className="font-medium">{(selectedFactura as any).clientes?.cp || "—"}</span></div>
                    <div><span className="text-muted-foreground">Ciudad:</span>{" "}<span className="font-medium">{(selectedFactura as any).clientes?.ciudad || "—"}</span></div>
                    {(selectedFactura as any).clientes?.banco && (
                      <>
                        <div><span className="text-muted-foreground">Banco:</span>{" "}<span className="font-medium">{(selectedFactura as any).clientes?.banco}</span></div>
                        <div><span className="text-muted-foreground">IBAN:</span>{" "}<span className="font-mono text-xs">{(selectedFactura as any).clientes?.iban}</span></div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <h3 className="mb-3 font-semibold">Conceptos</h3>
                {loadingLineas ? <Skeleton className="h-32 w-full" /> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Concepto</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Precio Unit.</TableHead>
                        <TableHead className="text-right">IVA %</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineasFactura.map(l => (
                        <TableRow key={l.id}>
                          <TableCell>{l.concepto}</TableCell>
                          <TableCell className="text-right">{l.cantidad}</TableCell>
                          <TableCell className="text-right">{formatCurrency(l.precio_unitario)}</TableCell>
                          <TableCell className="text-right">{l.porcentaje_iva}%</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(l.importe_linea)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
              <div className="space-y-3 rounded-lg border bg-card p-4">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Base Imponible</span><span className="font-medium">{formatCurrency(selectedFactura.base_imponible)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">IVA</span><span className="font-medium">{formatCurrency(selectedFactura.iva_total)}</span></div>
                {selectedFactura.retencion_irpf > 0 && (
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Retención IRPF</span><span className="font-medium text-destructive">-{formatCurrency(selectedFactura.retencion_irpf)}</span></div>
                )}
                <div className="border-t pt-3">
                  <div className="flex justify-between"><span className="text-lg font-bold">TOTAL</span><span className="text-lg font-bold text-primary">{formatCurrency(selectedFactura.total)}</span></div>
                </div>
              </div>
              {selectedFactura.qr_data && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">✓ Registro técnico de factura</p>
                  <p className="font-mono text-xs text-muted-foreground break-all">{selectedFactura.qr_data}</p>
                  {selectedFactura.hash_sha256 && (
                    <div className="mt-3 border-t pt-3">
                      <p className="text-xs font-medium text-muted-foreground">Hash SHA-256</p>
                      <p className="font-mono text-xs break-all">{selectedFactura.hash_sha256}</p>
                    </div>
                  )}
                  {selectedFactura.hash_anterior && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-muted-foreground">Hash anterior</p>
                      <p className="font-mono text-xs break-all">{selectedFactura.hash_anterior}</p>
                    </div>
                  )}
                </div>
              )}
              {selectedFactura.observaciones && (
                <div><h3 className="mb-2 text-sm font-semibold">Observaciones</h3><p className="rounded-lg bg-muted/50 p-3 text-sm">{selectedFactura.observaciones}</p></div>
              )}
              <div className="flex justify-between gap-2">
                <div className="flex gap-2">
                  {selectedFactura.estado === "pendiente" && (
                    <Button variant="outline" onClick={() => { handleMarcarCobrada(selectedFactura); setFacturaOpen(false) }}>
                      <CheckCircle className="mr-2 h-4 w-4" /> Marcar como Cobrada
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setFacturaOpen(false)}>Cerrar</Button>
                  {selectedFactura.pdf_url ? (
                    <Button onClick={() => openFacturaPdf(selectedFactura.pdf_url)}>
                      <Download className="mr-2 h-4 w-4" /> Descargar PDF
                    </Button>
                  ) : (
                    <Button variant="outline" disabled><Download className="mr-2 h-4 w-4" /> PDF no disponible</Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </div>
  )
}
