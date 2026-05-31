"use client"

import { useEffect, useState } from "react"
import { generateFacturaPDF } from "@/lib/generate-pdf"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/format"
import { Plus, Trash2, FileText, Loader2, Eye } from "lucide-react"
import { toast } from "sonner"
import type { SolicitudFactura, Cliente, Concepto } from "@/lib/types"
import { notificarClienteAction } from "@/app/actions/notificaciones"
import { enviarEmailFactura } from "@/app/actions/emails"

interface LineaForm {
  concepto: string
  cantidad: number
  precio: number
  iva: number
}

export default function GenerarFacturaPage() {
  const params = useParams()
  const router = useRouter()
  const { asesoria, user } = useAuth()
  const supabase = createClient()
  const solicitudId = params.id as string

  const [solicitud, setSolicitud] = useState<SolicitudFactura | null>(null)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  // Form state
  const [serie, setSerie] = useState("A")
  const [numero, setNumero] = useState(1)
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().split("T")[0])
  const [fechaVencimiento, setFechaVencimiento] = useState("")
  const [lineas, setLineas] = useState<LineaForm[]>([])
  const [aplicarIrpf, setAplicarIrpf] = useState(false)
  const [irpfPorcentaje, setIrpfPorcentaje] = useState(15)
  const [observaciones, setObservaciones] = useState("")
  const [vistaPreviaVista, setVistaPreviaVista] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    async function load() {
      if (!asesoria) return
      // Load solicitud
      const { data: sol } = await supabase
        .from("solicitudes_factura")
        .select("*, clientes(*)")
        .eq("id", solicitudId)
        .single()

      if (sol) {
        setSolicitud(sol)
        setCliente(sol.clientes)
        setObservaciones(sol.observaciones_cliente || "") // ✅ Cargar observaciones del cliente

        // Pre-fill lineas from conceptos
        const conceptos = sol.conceptos as Concepto[]
        setLineas(conceptos.map(c => ({
          concepto: c.concepto,
          cantidad: c.cantidad,
          precio: c.precio,
          iva: c.iva || 21,
        })))

        // Calc vencimiento
        const dias = sol.clientes?.dias_pago || 30
        const venc = new Date()
        venc.setDate(venc.getDate() + dias)
        setFechaVencimiento(venc.toISOString().split("T")[0])
      }

      // Get next invoice number
      const { data: lastFactura } = await supabase
        .from("facturas")
        .select("numero")
        .eq("asesoria_id", asesoria.id)
        .eq("serie", "A")
        .order("numero", { ascending: false })
        .limit(1)
        .single()

      if (lastFactura) setNumero(lastFactura.numero + 1)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asesoria, solicitudId])

  function addLinea() {
    setLineas(prev => [...prev, { concepto: "", cantidad: 1, precio: 0, iva: 21 }])
  }

  function removeLinea(index: number) {
    setLineas(prev => prev.filter((_, i) => i !== index))
  }

  function updateLinea(index: number, field: keyof LineaForm, value: string | number) {
    setLineas(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l))
  }

  // Calculations
  const baseImponible = lineas.reduce((s, l) => s + l.cantidad * l.precio, 0)
  const ivaByRate: Record<number, number> = {}
  lineas.forEach(l => {
    const base = l.cantidad * l.precio
    const iva = base * (l.iva / 100)
    ivaByRate[l.iva] = (ivaByRate[l.iva] || 0) + iva
  })
  const totalIva = Object.values(ivaByRate).reduce((s, v) => s + v, 0)
  const irpfTotal = aplicarIrpf ? baseImponible * (irpfPorcentaje / 100) : 0
  const total = baseImponible + totalIva - irpfTotal

  async function handleGenerar() {
    if (lineas.length === 0) { toast.error("Añade al menos una línea"); return }
    if (!asesoria || !cliente) return
    setGenerating(true)
  
    try {
      const numeroFactura = `${serie}-${String(numero).padStart(4, "0")}`
      const hashValue = generateHash()
  
      // 1. Create factura record
      const { data: factura, error: facturaError } = await supabase
        .from("facturas")
        .insert({
          asesoria_id: asesoria.id,
          cliente_id: cliente.id,
          solicitud_id: solicitudId,
          numero_factura: numeroFactura,
          serie,
          numero,
          fecha_emision: fechaEmision,
          fecha_vencimiento: fechaVencimiento,
          base_imponible: baseImponible,
          iva_total: totalIva,
          retencion_irpf: irpfTotal,
          total,
          observaciones,
          hash_sha256: hashValue,
          qr_data: `NIF=${asesoria.nif}&NUM=${numeroFactura}&FECHA=${fechaEmision}&IMPORTE=${total.toFixed(2)}&HASH=${hashValue.substring(0, 16)}`,
        })
        .select()
        .single()
  
      if (facturaError) throw facturaError
  
      // 2. Insert lineas
      const lineasInsert = lineas.map((l, index) => ({
        factura_id: factura.id,
        orden: index + 1,
        concepto: l.concepto,
        cantidad: l.cantidad,
        precio_unitario: l.precio,
        porcentaje_iva: l.iva,
        importe_linea: l.cantidad * l.precio * (1 + l.iva / 100),
      }))
  
      const { error: lineasError } = await supabase.from("lineas_factura").insert(lineasInsert)
      if (lineasError) throw lineasError
  
      // 3. Generar PDF
      toast.info("Generando PDF...")

      if (!asesoria || !cliente) throw new Error("Datos incompletos")

      const pdfData = {
        numero_factura: numeroFactura,
        fecha_emision: fechaEmision,
        fecha_vencimiento: fechaVencimiento,
        qr_data: factura.qr_data,
        observaciones: observaciones || null,
        base_imponible: baseImponible,
        iva_total: totalIva,
        retencion_irpf: irpfTotal,
        total,
        asesoria: {
          nombre: asesoria.nombre,
          nif: asesoria.nif,
          email: asesoria.email || "",
          telefono: asesoria.telefono || "",
          direccion: asesoria.direccion || "",
          ciudad: asesoria.ciudad || "",
          logo_url: asesoria.logo_url || null,
        },
        cliente: {
          nombre: cliente.nombre,
          nif: cliente.nif,
          email: cliente.email || "",
          telefono: cliente.telefono || "",
          direccion: cliente.direccion || "",
          cp: cliente.cp || "",
          ciudad: cliente.ciudad || "",
          banco: cliente.banco || null,
          iban: cliente.iban || null,
          bic_swift: cliente.bic_swift || null,
        },
        lineas: lineasInsert.map(l => ({
          concepto: l.concepto,
          cantidad: l.cantidad,
          precio_unitario: l.precio_unitario,
          porcentaje_iva: l.porcentaje_iva,
          importe_linea: l.importe_linea,
        })),
      }

      const pdfBlob = await generateFacturaPDF(pdfData)
      
      // 4. Subir PDF a Storage
      const pdfPath = `${asesoria.id}/${factura.id}/${numeroFactura}.pdf`
      const { error: uploadError } = await supabase.storage
        .from("facturas")
        .upload(pdfPath, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true,
        })
  
      if (uploadError) throw uploadError
  
      // 5. Actualizar factura con URL del PDF
      const { error: updateError } = await supabase
        .from("facturas")
        .update({ pdf_url: pdfPath })
        .eq("id", factura.id)
  
      if (updateError) throw updateError

      // 6. Enviar email al cliente con PDF adjunto
      if (cliente.email && cliente.user_id) {
        const pdfPublicUrl = supabase.storage
          .from("facturas")
          .getPublicUrl(pdfPath).data.publicUrl

        enviarEmailFactura({
          nombreCliente: cliente.nombre,
          nombreAsesoria: asesoria.nombre,
          emailCliente: cliente.email,
          numeroFactura,
          total,
          fechaEmision,
          fechaVencimiento,
          pdfUrl: pdfPublicUrl,
        }).catch(err => console.error("Error enviando email factura:", err))
      }
  
      // 6. Update solicitud
      await supabase.from("solicitudes_factura").update({
        estado: "facturada",
        factura_id: factura.id,
      }).eq("id", solicitudId)
  
      // 7. Notify cliente
      if (cliente.user_id) {
        await notificarClienteAction({
          cliente_user_id: cliente.user_id,
          tipo: "factura_generada",
          titulo: "Nueva factura generada",
          mensaje: `Factura ${numeroFactura} por ${formatCurrency(total)}`,
          link: "/cliente/facturas",
        })
      }
  
      toast.success("Factura generada correctamente con PDF")
      router.push("/asesoria/facturacion")
    } catch (err: any) {
      console.error("Error generando factura:", err)
      toast.error(err.message || "Error al generar factura")
    } finally {
      setGenerating(false)
    }
  }

  function generateHash(): string {
    // Simple hash for demo - in production use crypto-js SHA-256
    const data = `${asesoria?.nif}|${serie}|${numero}|${fechaEmision}|${total.toFixed(2)}`
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(16).padStart(16, "0").toUpperCase()
  }

  function handleVistaPrevia() {
    if (lineas.length === 0) {
      toast.error("Añade al menos una línea")
      return
    }
    setPreviewOpen(true)
  }
  
  function handleCerrarPreview() {
    setPreviewOpen(false)
    setVistaPreviaVista(true)
    toast.success("Vista previa confirmada. Ahora puedes generar la factura.")
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
          <h1 className="text-3xl font-semibold text-foreground">Generar Factura</h1>
          <p className="text-muted-foreground mt-1">
            Cliente: {cliente?.nombre} | NIF: {cliente?.nif}
          </p>
        </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Main form */}
        <div className="flex flex-col gap-6 xl:col-span-2">
          {/* Header fields */}
          <Card>
            <CardHeader><CardTitle className="text-base">Datos de la Factura</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="flex flex-col gap-2">
                  <Label>Serie</Label>
                  <Select value={serie} onValueChange={setSerie}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="B">B</SelectItem>
                      <SelectItem value="R">R</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Numero</Label>
                  <Input value={String(numero).padStart(4, "0")} readOnly className="bg-muted font-mono" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Fecha Emision</Label>
                  <Input type="date" value={fechaEmision} onChange={e => setFechaEmision(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Vencimiento</Label>
                  <Input type="date" value={fechaVencimiento} onChange={e => setFechaVencimiento(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conceptos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Conceptos</CardTitle>
              <Button size="sm" variant="outline" onClick={addLinea}><Plus className="mr-1 h-4 w-4" /> Anadir Linea</Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Concepto</TableHead>
                    <TableHead className="w-[12%]">Cantidad</TableHead>
                    <TableHead className="w-[15%]">Precio Unit.</TableHead>
                    <TableHead className="w-[13%]">IVA %</TableHead>
                    <TableHead className="w-[15%] text-right">Total</TableHead>
                    <TableHead className="w-[5%]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineas.map((l, i) => {
                    const lineTotal = l.cantidad * l.precio * (1 + l.iva / 100)
                    return (
                      <TableRow key={i}>
                        <TableCell><Input value={l.concepto} onChange={e => updateLinea(i, "concepto", e.target.value)} placeholder="Descripcion" /></TableCell>
                        <TableCell><Input type="number" min={1} value={l.cantidad} onChange={e => updateLinea(i, "cantidad", parseFloat(e.target.value) || 0)} /></TableCell>
                        <TableCell><Input type="number" min={0} step={0.01} value={l.precio} onChange={e => updateLinea(i, "precio", parseFloat(e.target.value) || 0)} /></TableCell>
                        <TableCell>
                          <Select value={l.iva.toString()} onValueChange={v => updateLinea(i, "iva", parseInt(v))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="21">21%</SelectItem>
                              <SelectItem value="10">10%</SelectItem>
                              <SelectItem value="4">4%</SelectItem>
                              <SelectItem value="0">0%</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(lineTotal)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeLinea(i)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Observaciones */}
          <Card>
            <CardHeader><CardTitle className="text-base">Observaciones</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3} placeholder="Notas adicionales..." />
            </CardContent>
          </Card>
        </div>

        {/* Totals sidebar */}
        <div className="flex flex-col gap-4">
          <Card className="sticky top-6">
            <CardHeader><CardTitle className="text-base">Totales</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Base Imponible</span>
                <span className="font-medium">{formatCurrency(baseImponible)}</span>
              </div>
              {Object.entries(ivaByRate).map(([rate, amount]) => (
                <div key={rate} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">IVA {rate}%</span>
                  <span className="font-medium">{formatCurrency(amount)}</span>
                </div>
              ))}

              <div className="flex items-center gap-2 pt-2">
                <Checkbox checked={aplicarIrpf} onCheckedChange={c => setAplicarIrpf(!!c)} id="irpf" />
                <Label htmlFor="irpf" className="text-sm">Aplicar IRPF</Label>
                {aplicarIrpf && (
                  <Input type="number" value={irpfPorcentaje} onChange={e => setIrpfPorcentaje(parseFloat(e.target.value) || 0)} className="ml-auto w-20" />
                )}
              </div>
              {aplicarIrpf && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">IRPF ({irpfPorcentaje}%)</span>
                  <span className="font-medium text-destructive">-{formatCurrency(irpfTotal)}</span>
                </div>
              )}

              <div className="border-t pt-3">
                <div className="flex justify-between text-lg font-bold">
                  <span>TOTAL</span>
                  <span className="text-primary">{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-4">
                <Button 
                  onClick={handleVistaPrevia} 
                  variant={vistaPreviaVista ? "outline" : "default"}
                  className="w-full"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  {vistaPreviaVista ? "✓ Vista Previa Confirmada" : "Vista Previa"}
                </Button>
                
                <Button 
                  onClick={handleGenerar} 
                  disabled={!vistaPreviaVista || generating} 
                  className="w-full"
                >
                  {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  Generar Factura con Verifactu
                </Button>
                
                {!vistaPreviaVista && (
                  <p className="text-xs text-center text-muted-foreground">
                    Debes ver la vista previa antes de generar
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal Vista Previa */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vista Previa de Factura {serie}-{String(numero).padStart(4, "0")}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Datos del Cliente */}
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Datos del Cliente</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Nombre:</span>{" "}
                  <span className="font-medium">{cliente?.nombre || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">NIF:</span>{" "}
                  <span className="font-medium">{cliente?.nif || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>{" "}
                  <span className="font-medium">{cliente?.email || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Teléfono:</span>{" "}
                  <span className="font-medium">{cliente?.telefono || "—"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Dirección:</span>{" "}
                  <span className="font-medium">{cliente?.direccion || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">CP:</span>{" "}
                  <span className="font-medium">{cliente?.cp || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ciudad:</span>{" "}
                  <span className="font-medium">{cliente?.ciudad || "—"}</span>
                </div>
                {cliente?.banco && (
                  <>
                    <div>
                      <span className="text-muted-foreground">Banco:</span>{" "}
                      <span className="font-medium">{cliente.banco}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">IBAN:</span>{" "}
                      <span className="font-mono text-xs">{cliente.iban}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">BIC/SWIFT:</span>{" "}
                      <span className="font-mono text-xs">{cliente.bic_swift}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Datos de la Factura */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 p-4">
              <div className="text-sm">
                <span className="text-muted-foreground">Número:</span>{" "}
                <span className="font-mono font-medium">{serie}-{String(numero).padStart(4, "0")}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Emitida:</span>{" "}
                <span className="font-medium">{fechaEmision}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Vencimiento:</span>{" "}
                <span className="font-medium">{fechaVencimiento}</span>
              </div>
            </div>

            {/* Conceptos */}
            <div>
              <h3 className="mb-3 font-semibold">Conceptos</h3>
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
                  {lineas.map((l, i) => {
                    const lineTotal = l.cantidad * l.precio * (1 + l.iva / 100)
                    return (
                      <TableRow key={i}>
                        <TableCell>{l.concepto}</TableCell>
                        <TableCell className="text-right">{l.cantidad}</TableCell>
                        <TableCell className="text-right">{formatCurrency(l.precio)}</TableCell>
                        <TableCell className="text-right">{l.iva}%</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(lineTotal)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Totales */}
            <div className="space-y-3 rounded-lg border bg-card p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Base Imponible</span>
                <span className="font-medium">{formatCurrency(baseImponible)}</span>
              </div>
              {Object.entries(ivaByRate).map(([rate, amount]) => (
                <div key={rate} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">IVA {rate}%</span>
                  <span className="font-medium">{formatCurrency(amount)}</span>
                </div>
              ))}
              {aplicarIrpf && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Retención IRPF ({irpfPorcentaje}%)</span>
                  <span className="font-medium text-destructive">-{formatCurrency(irpfTotal)}</span>
                </div>
              )}
              <div className="border-t pt-3">
                <div className="flex justify-between">
                  <span className="text-lg font-bold">TOTAL</span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* Observaciones */}
            {observaciones && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Observaciones</h3>
                <p className="rounded-lg bg-muted/50 p-3 text-sm">{observaciones}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                Modificar
              </Button>
              <Button onClick={handleCerrarPreview}>
                Confirmar Vista Previa
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </div>
  )
}
