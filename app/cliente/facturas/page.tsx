"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EstadoBadge } from "@/components/estado-badge"
import { EmptyState } from "@/components/empty-state"
import { formatCurrency, formatDate } from "@/lib/format"
import { Receipt, Eye, Download, Search, X, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"
import type { Factura } from "@/lib/types"
import ExcelJS from "exceljs"

interface LineaFactura {
  id: string
  concepto: string
  cantidad: number
  precio_unitario: number
  porcentaje_iva: number
  importe_linea: number
}

export default function FacturasClientePage() {
  const { cliente } = useAuth()
  const supabase = createClient()
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState("")
  const [estadoFilter, setEstadoFilter] = useState("todas")
  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")

  // Modal
  const [selected, setSelected] = useState<Factura | null>(null)
  const [lineas, setLineas] = useState<LineaFactura[]>([])
  const [loadingLineas, setLoadingLineas] = useState(false)

  useEffect(() => {
    if (!cliente) return
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from("facturas")
        .select("*, clientes(nombre, nif, email, telefono, direccion, cp, ciudad, banco, iban, bic_swift)")
        .eq("cliente_id", cliente!.id)
        .order("created_at", { ascending: false })
      if (data) setFacturas(data)
      setLoading(false)
    }
    load()
  }, [cliente, supabase])

  // Filtros aplicados en frontend
  const filteredFacturas = facturas.filter(f => {
    const matchSearch = !search ||
      f.numero_factura?.toLowerCase().includes(search.toLowerCase())
    const matchEstado = estadoFilter === "todas" || f.estado === estadoFilter
    const matchDesde = !fechaDesde || f.fecha_emision >= fechaDesde
    const matchHasta = !fechaHasta || f.fecha_emision <= fechaHasta
    return matchSearch && matchEstado && matchDesde && matchHasta
  })

  const hayFiltrosActivos = search || estadoFilter !== "todas" || fechaDesde || fechaHasta

  function limpiarFiltros() {
    setSearch("")
    setEstadoFilter("todas")
    setFechaDesde("")
    setFechaHasta("")
  }

  async function handleVerFactura(factura: Factura) {
    setSelected(factura)
    setLoadingLineas(true)
    const { data } = await supabase.from("lineas_factura").select("*").eq("factura_id", factura.id).order("orden")
    if (data) setLineas(data)
    setLoadingLineas(false)
  }

  async function downloadPdf(factura: Factura) {
    if (!factura.pdf_url) {
      toast.error("PDF no disponible")
      return
    }

    const { data, error } = await supabase.storage
      .from("facturas")
      .createSignedUrl(factura.pdf_url, 60 * 5)

    if (error || !data?.signedUrl) {
      toast.error("No se ha podido abrir el PDF")
      return
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer")
  }

  function exportCSV() {
    const headers = ["Nº Factura", "Fecha Emisión", "Fecha Vencimiento", "Base Imponible", "IVA", "IRPF", "Total", "Estado"]
    const rows = filteredFacturas.map(f => [
      f.numero_factura,
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
    a.download = `mis_facturas_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exportadas ${filteredFacturas.length} facturas`)
  }

  async function exportExcel() {
    const wb = new ExcelJS.Workbook()
    wb.creator = "MuyFactu"
    wb.created = new Date()
  
    const ws = wb.addWorksheet("Mis Facturas")
  
    ws.columns = [
      { header: "Nº Factura",        key: "numero",      width: 14 },
      { header: "Fecha Emisión",     key: "emision",     width: 14 },
      { header: "Fecha Vencimiento", key: "vencimiento", width: 16 },
      { header: "Base Imponible",    key: "base",        width: 15 },
      { header: "IVA",               key: "iva",         width: 12 },
      { header: "IRPF",              key: "irpf",        width: 12 },
      { header: "Total",             key: "total",       width: 14 },
      { header: "Estado",            key: "estado",      width: 12 },
    ]
  
    // Cabecera
    ws.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } }
      cell.alignment = { vertical: "middle", horizontal: "center" }
    })
    ws.getRow(1).height = 28
  
    // Datos
    filteredFacturas.forEach((f, i) => {
      const row = ws.addRow({
        numero:      f.numero_factura,
        emision:     f.fecha_emision,
        vencimiento: f.fecha_vencimiento,
        base:        f.base_imponible,
        iva:         f.iva_total,
        irpf:        f.retencion_irpf,
        total:       f.total,
        estado:      f.estado,
      })
  
      if (i % 2 === 0) {
        row.eachCell(cell => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } }
        })
      }
  
      ;["base", "iva", "irpf", "total"].forEach(key => {
        const cell = row.getCell(key)
        cell.numFmt = "#,##0.00 €"
        cell.alignment = { horizontal: "right" }
      })
  
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
  
    // Fila totales
    ws.addRow({})
    const totalRow = ws.addRow({
      numero: "TOTALES",
      base:   filteredFacturas.reduce((s, f) => s + f.base_imponible, 0),
      iva:    filteredFacturas.reduce((s, f) => s + f.iva_total, 0),
      irpf:   filteredFacturas.reduce((s, f) => s + f.retencion_irpf, 0),
      total:  filteredFacturas.reduce((s, f) => s + f.total, 0),
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
  
    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `mis_facturas_${new Date().toISOString().split("T")[0]}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exportadas ${filteredFacturas.length} facturas`)
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
          <h1 className="text-3xl font-semibold text-foreground">Mis Facturas</h1>
          <p className="text-muted-foreground mt-1">
            Consulta y descarga tus facturas
          </p>
        </div>

      {/* FILTROS */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nº de factura..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos los estados</SelectItem>
                  <SelectItem value="pendiente">Pendientes</SelectItem>
                  <SelectItem value="cobrada">Cobradas</SelectItem>
                  <SelectItem value="vencida">Vencidas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Desde</Label>
                <Input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className="w-40" />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Hasta</Label>
                <Input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className="w-40" />
              </div>
              {hayFiltrosActivos && (
                <Button variant="ghost" size="sm" onClick={limpiarFiltros} className="text-muted-foreground">
                  <X className="mr-1 h-3.5 w-3.5" /> Limpiar
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
            {hayFiltrosActivos && (
              <p className="text-xs text-muted-foreground">
                Mostrando <span className="font-medium">{filteredFacturas.length}</span> de {facturas.length} facturas
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {filteredFacturas.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Receipt} title="Sin facturas" description={hayFiltrosActivos ? "No hay facturas que coincidan con los filtros" : "No hay facturas para este periodo"} />
            </div>
          ) : (
            <div className="mx-auto max-w-[1200px] space-y-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-6 py-3 font-medium">Nº Factura</th>
                    <th className="px-6 py-3 font-medium">Fecha</th>
                    <th className="px-6 py-3 font-medium">Total</th>
                    <th className="px-6 py-3 font-medium">Estado</th>
                    <th className="px-6 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFacturas.map(f => (
                    <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-6 py-4 font-mono font-medium">{f.numero_factura}</td>
                      <td className="px-6 py-4">{formatDate(f.fecha_emision)}</td>
                      <td className="px-6 py-4 font-semibold">{formatCurrency(f.total)}</td>
                      <td className="px-6 py-4"><EstadoBadge estado={f.estado} /></td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleVerFactura(f)}>
                            <Eye className="mr-1 h-3.5 w-3.5" /> Ver
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => downloadPdf(f)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Factura {selected?.numero_factura}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 p-4">
                <EstadoBadge estado={selected.estado} />
                <div className="text-sm"><span className="text-muted-foreground">Emitida:</span>{" "}<span className="font-medium">{formatDate(selected.fecha_emision)}</span></div>
                <div className="text-sm"><span className="text-muted-foreground">Vencimiento:</span>{" "}<span className="font-medium">{formatDate(selected.fecha_vencimiento)}</span></div>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <h3 className="mb-3 text-sm font-semibold">Datos de Facturación</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div><span className="text-muted-foreground">Nombre:</span>{" "}<span className="font-medium">{(selected as any).clientes?.nombre || "—"}</span></div>
                  <div><span className="text-muted-foreground">NIF:</span>{" "}<span className="font-medium">{(selected as any).clientes?.nif || "—"}</span></div>
                  <div><span className="text-muted-foreground">Email:</span>{" "}<span className="font-medium">{(selected as any).clientes?.email || "—"}</span></div>
                  <div><span className="text-muted-foreground">Teléfono:</span>{" "}<span className="font-medium">{(selected as any).clientes?.telefono || "—"}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Dirección:</span>{" "}<span className="font-medium">{(selected as any).clientes?.direccion || "—"}</span></div>
                  <div><span className="text-muted-foreground">CP:</span>{" "}<span className="font-medium">{(selected as any).clientes?.cp || "—"}</span></div>
                  <div><span className="text-muted-foreground">Ciudad:</span>{" "}<span className="font-medium">{(selected as any).clientes?.ciudad || "—"}</span></div>
                  {(selected as any).clientes?.banco && (
                    <>
                      <div><span className="text-muted-foreground">Banco:</span>{" "}<span className="font-medium">{(selected as any).clientes?.banco}</span></div>
                      <div className="col-span-2"><span className="text-muted-foreground">IBAN:</span>{" "}<span className="font-mono text-xs">{(selected as any).clientes?.iban}</span></div>
                    </>
                  )}
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
                      {lineas.map(l => (
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
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Base Imponible</span><span className="font-medium">{formatCurrency(selected.base_imponible)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">IVA</span><span className="font-medium">{formatCurrency(selected.iva_total)}</span></div>
                {selected.retencion_irpf > 0 && (
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Retención IRPF</span><span className="font-medium text-destructive">-{formatCurrency(selected.retencion_irpf)}</span></div>
                )}
                <div className="border-t pt-3">
                  <div className="flex justify-between"><span className="text-lg font-bold">TOTAL</span><span className="text-lg font-bold text-primary">{formatCurrency(selected.total)}</span></div>
                </div>
              </div>
              {selected.qr_data && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">✓ Factura con Verifactu</p>
                  <p className="font-mono text-xs text-muted-foreground">{selected.qr_data}</p>
                </div>
              )}
              {selected.observaciones && (
                <div><h3 className="mb-2 text-sm font-semibold">Observaciones</h3><p className="rounded-lg bg-muted/50 p-3 text-sm">{selected.observaciones}</p></div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelected(null)}>Cerrar</Button>
                <Button onClick={() => downloadPdf(selected)}>
                  <Download className="mr-2 h-4 w-4" /> Descargar PDF
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
