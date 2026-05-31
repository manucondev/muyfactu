"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EstadoBadge } from "@/components/estado-badge"
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format"
import { Download, CheckCircle, Loader2, Clock, Mail, FileText, CreditCard } from "lucide-react"
import { toast } from "sonner"
import type { Factura, LineaFactura } from "@/lib/types"

interface FacturaDetailModalProps {
  factura: Factura | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate?: () => void
}

interface HistorialItem {
  icon: React.ElementType
  label: string
  date: string
}

export function FacturaDetailModal({ factura, open, onOpenChange, onUpdate }: FacturaDetailModalProps) {
  const { userType } = useAuth()
  const supabase = createClient()
  const [lineas, setLineas] = useState<LineaFactura[]>([])
  const [loading, setLoading] = useState(false)
  const [markingCobrada, setMarkingCobrada] = useState(false)
  const [fechaCobro, setFechaCobro] = useState("")

  useEffect(() => {
    if (!factura) return
    async function loadLineas() {
      setLoading(true)
      const { data } = await supabase
        .from("lineas_factura")
        .select("*")
        .eq("factura_id", factura!.id)
        .order("id")
      if (data) setLineas(data)
      setLoading(false)
    }
    loadLineas()
    setFechaCobro(new Date().toISOString().split("T")[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factura])

  async function handleMarcarCobrada() {
    if (!factura || !fechaCobro) return
    setMarkingCobrada(true)
    try {
      const { error } = await supabase
        .from("facturas")
        .update({ estado: "cobrada", fecha_cobro: fechaCobro })
        .eq("id", factura.id)
      if (error) throw error

      // Notify client
      if (factura.cliente?.user_id) {
        await supabase.from("notificaciones").insert({
          destinatario_id: factura.cliente.user_id,
          tipo: "factura_cobrada",
          titulo: "Factura cobrada",
          mensaje: `Factura ${factura.serie}-${String(factura.numero).padStart(4, "0")} marcada como cobrada`,
          enlace: "/cliente/facturas",
        })
      }

      toast.success("Factura marcada como cobrada")
      onUpdate?.()
      onOpenChange(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error"
      toast.error(message)
    } finally {
      setMarkingCobrada(false)
    }
  }

  function downloadPdf() {
    if (!factura?.pdf_url) return
    const { data } = supabase.storage.from("facturas").getPublicUrl(factura.pdf_url)
    window.open(data.publicUrl, "_blank")
  }

  if (!factura) return null

  // Build historial
  const historial: HistorialItem[] = [
    { icon: FileText, label: "Factura creada", date: factura.created_at },
  ]
  if (factura.estado === "cobrada" && factura.fecha_cobro) {
    historial.push({ icon: CreditCard, label: "Factura cobrada", date: factura.fecha_cobro })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Factura {factura.serie}-{String(factura.numero).padStart(4, "0")}
            <EstadoBadge estado={factura.estado} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header info */}
          <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Cliente</p>
              <p className="text-sm font-medium">{factura.cliente?.nombre || "---"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fecha Emision</p>
              <p className="text-sm font-medium">{formatDate(factura.fecha_emision)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vencimiento</p>
              <p className="text-sm font-medium">{formatDate(factura.fecha_vencimiento)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Estado</p>
              <EstadoBadge estado={factura.estado} />
            </div>
          </div>

          {/* PDF viewer */}
          {factura.pdf_url && (
            <div className="overflow-hidden rounded-lg border">
              <iframe
                src={supabase.storage.from("facturas").getPublicUrl(factura.pdf_url).data.publicUrl}
                className="h-96 w-full"
                title="Vista previa factura"
              />
            </div>
          )}

          {/* Line items */}
          {lineas.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium">Detalle de Lineas</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">IVA</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineas.map(l => (
                    <TableRow key={l.id}>
                      <TableCell>{l.concepto}</TableCell>
                      <TableCell className="text-right">{l.cantidad}</TableCell>
                      <TableCell className="text-right">{formatCurrency(l.precio_unitario)}</TableCell>
                      <TableCell className="text-right">{l.iva_porcentaje}%</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(l.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2 rounded-lg bg-muted/50 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Base Imponible</span>
                <span className="font-medium">{formatCurrency(factura.base_imponible)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IVA</span>
                <span className="font-medium">{formatCurrency(factura.iva_total)}</span>
              </div>
              {factura.irpf_total > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">IRPF ({factura.irpf_porcentaje}%)</span>
                  <span className="font-medium text-destructive">-{formatCurrency(factura.irpf_total)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 text-base font-bold">
                <span>TOTAL</span>
                <span className="text-primary">{formatCurrency(factura.total)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={downloadPdf} disabled={!factura.pdf_url}>
              <Download className="mr-2 h-4 w-4" /> Descargar PDF
            </Button>

            {userType === "asesoria" && factura.estado === "pendiente" && (
              <div className="ml-auto flex items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Fecha de cobro</Label>
                  <Input
                    type="date"
                    value={fechaCobro}
                    onChange={e => setFechaCobro(e.target.value)}
                    className="w-40"
                  />
                </div>
                <Button onClick={handleMarcarCobrada} disabled={markingCobrada}>
                  {markingCobrada ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                  Marcar Cobrada
                </Button>
              </div>
            )}
          </div>

          {/* Historial */}
          <div>
            <h4 className="mb-3 text-sm font-medium">Historial</h4>
            <div className="space-y-3">
              {historial.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(item.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
