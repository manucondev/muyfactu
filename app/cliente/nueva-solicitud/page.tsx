"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/format"
import { Plus, Trash2, Upload, FileUp, X, Loader2, Info } from "lucide-react"
import { toast } from "sonner"
import { notificarAsesoriaAction } from "@/app/actions/notificaciones"

interface ConceptoRow {
  concepto: string
  cantidad: number
  precio: number
}

const MAX_FILES = 5
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const ACCEPTED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"]
const ACCEPTED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp"]

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function sanitizeFileName(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")

  return normalized || `adjunto-${Date.now()}`
}

function isAcceptedFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || ""
  return ACCEPTED_FILE_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.includes(extension)
}

export default function NuevaSolicitudPage() {
  const { cliente } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  
  // Conceptos
  const [conceptos, setConceptos] = useState<ConceptoRow[]>([{ concepto: "", cantidad: 1, precio: 0 }])
  const [observaciones, setObservaciones] = useState("")
  const [files, setFiles] = useState<File[]>([])
  
  // Datos del cliente
  const [clienteData, setClienteData] = useState({
    direccion: "",
    cp: "",
    ciudad: "",
    telefono: "",
    banco: "",
    iban: "",
    bic_swift: ""
  })
  const [datosOriginales, setDatosOriginales] = useState({
    direccion: "",
    cp: "",
    ciudad: "",
    telefono: "",
    banco: "",
    iban: "",
    bic_swift: ""
  })
  
  // Estados UI
  const [submitting, setSubmitting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)

  // Cargar datos del cliente al montar
  useEffect(() => {
    if (cliente) {
      const datos = {
        direccion: cliente.direccion || "",
        cp: cliente.cp || "",
        ciudad: cliente.ciudad || "",
        telefono: cliente.telefono || "",
        banco: cliente.banco || "",
        iban: cliente.iban || "",
        bic_swift: cliente.bic_swift || ""
      }
      setClienteData(datos)
      setDatosOriginales(datos)
    }
  }, [cliente])

  function addRow() {
    setConceptos([...conceptos, { concepto: "", cantidad: 1, precio: 0 }])
  }

  function removeRow(idx: number) {
    if (conceptos.length <= 1) return
    setConceptos(conceptos.filter((_, i) => i !== idx))
  }

  function updateRow(idx: number, field: keyof ConceptoRow, value: string | number) {
    setConceptos(conceptos.map((c, i) => i === idx ? { ...c, [field]: value } : c))
  }

  function updateClienteData(field: keyof typeof clienteData, value: string) {
    setClienteData(prev => ({ ...prev, [field]: value }))
  }

  const total = conceptos.reduce((s, c) => s + c.cantidad * c.precio, 0)

  // Verificar si hay cambios en los datos del cliente
  const hayDatosCambiados = () => {
    return Object.keys(clienteData).some(key => 
      clienteData[key as keyof typeof clienteData] !== datosOriginales[key as keyof typeof datosOriginales]
    )
  }

  function addFiles(newFiles: File[]) {
    const accepted: File[] = []

    for (const file of newFiles) {
      if (!isAcceptedFile(file)) {
        toast.error(`Formato no permitido: ${file.name}`)
        continue
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`${file.name} supera el límite de 10 MB`)
        continue
      }
      accepted.push(file)
    }

    if (accepted.length === 0) return

    setFiles(prev => {
      const remainingSlots = MAX_FILES - prev.length
      if (remainingSlots <= 0) {
        toast.error(`Solo puedes adjuntar hasta ${MAX_FILES} archivos`)
        return prev
      }

      if (accepted.length > remainingSlots) {
        toast.error(`Solo se añadirán ${remainingSlots} archivo(s); el máximo es ${MAX_FILES}`)
      }

      return [...prev, ...accepted.slice(0, remainingSlots)]
    })
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true)
    else if (e.type === "dragleave") setDragActive(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files))
  }, [])

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(Array.from(e.target.files))
    e.target.value = ""
  }

  function removeFile(idx: number) {
    setFiles(files.filter((_, i) => i !== idx))
  }

  async function uploadAdjuntos(solicitudId: string) {
    if (!cliente || files.length === 0) return []

    const uploadedPaths: string[] = []

    for (const file of files) {
      const safeName = sanitizeFileName(file.name)
      const path = `${cliente.id}/${solicitudId}/${Date.now()}-${safeName}`
      const { error } = await supabase.storage
        .from("solicitud-adjuntos")
        .upload(path, file, {
          cacheControl: "3600",
          contentType: file.type || undefined,
          upsert: false,
        })

      if (error) throw new Error(`No se pudo subir ${file.name}: ${error.message}`)
      uploadedPaths.push(path)
    }

    return uploadedPaths
  }

  async function handleSubmit() {
    if (!cliente) return
    if (conceptos.some(c => !c.concepto.trim() || c.cantidad <= 0 || c.precio <= 0)) {
      toast.error("Completa todos los campos de los conceptos")
      return
    }

    // Si hay cambios en los datos, mostrar diálogo de confirmación
    if (hayDatosCambiados()) {
      setConfirmDialogOpen(true)
      return
    }

    // Si no hay cambios, enviar directamente
    await enviarSolicitud(false)
  }

  async function enviarSolicitud(actualizarDatos: boolean) {
    if (!cliente) return
    
    setSubmitting(true)
    setConfirmDialogOpen(false)
    
    try {
      // Si el usuario quiere actualizar sus datos
      if (actualizarDatos) {
        const { error: updateError } = await supabase
          .from("clientes")
          .update({
            direccion: clienteData.direccion || null,
            cp: clienteData.cp || null,
            ciudad: clienteData.ciudad || null,
            telefono: clienteData.telefono || null,
            banco: clienteData.banco || null,
            iban: clienteData.iban || null,
            bic_swift: clienteData.bic_swift || null,
          })
          .eq("id", cliente.id)

        if (updateError) {
          console.error("Error al actualizar datos:", updateError)
          toast.error("No se pudieron actualizar tus datos, pero la solicitud se enviará")
        } else {
          toast.success("Tus datos han sido actualizados")
        }
      }

      const solicitudId = crypto.randomUUID()
      const adjuntos = await uploadAdjuntos(solicitudId)

      // Insert solicitud
      const { data, error } = await supabase
      .from("solicitudes_factura")
      .insert({
        id: solicitudId,
        cliente_id: cliente.id,
        conceptos: conceptos.map(c => ({
          concepto: c.concepto,
          cantidad: c.cantidad,
          precio: c.precio,
          iva: 21,
          total: c.cantidad * c.precio,
        })),
        observaciones_cliente: observaciones || null,
        adjuntos: adjuntos.length > 0 ? adjuntos : null,
      })
      .select()
      .single()

      if (error) throw error

      // Notificar a la asesoría
      await notificarAsesoriaAction({
        asesoria_id: cliente.asesoria_id,
        tipo: "solicitud_nueva",
        titulo: "Nueva solicitud de factura",
        mensaje: `${cliente.nombre} ha enviado una solicitud por ${formatCurrency(total)}`,
        link: "/asesoria/facturacion",
      })

      toast.success("Solicitud enviada correctamente")
      router.push(`/cliente/solicitudes?preview=${data.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al enviar la solicitud"
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-[1200px] space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Nueva Solicitud de Factura</h1>
          <p className="text-muted-foreground mt-1">
            Agrega los conceptos que deseas facturar
          </p>
        </div>

      {/* Datos del Cliente */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Tus Datos de Facturación
            <Info className="h-4 w-4 text-muted-foreground" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {hayDatosCambiados() && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mb-3">
              <p className="text-xs text-blue-900">
                ℹ️ Has modificado tus datos. Al enviar la solicitud podrás elegir si actualizarlos permanentemente.
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className="text-xs">Dirección</Label>
              <Input
                placeholder="Calle, número..."
                value={clienteData.direccion}
                onChange={e => updateClienteData("direccion", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs">Código Postal</Label>
              <Input
                placeholder="28001"
                value={clienteData.cp}
                onChange={e => updateClienteData("cp", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs">Ciudad</Label>
              <Input
                placeholder="Madrid"
                value={clienteData.ciudad}
                onChange={e => updateClienteData("ciudad", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs">Teléfono</Label>
              <Input
                placeholder="600 123 456"
                value={clienteData.telefono}
                onChange={e => updateClienteData("telefono", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs">Banco</Label>
              <Input
                placeholder="Santander, BBVA..."
                value={clienteData.banco}
                onChange={e => updateClienteData("banco", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs">IBAN</Label>
              <Input
                placeholder="ES00 0000 0000 0000 0000 0000"
                value={clienteData.iban}
                onChange={e => updateClienteData("iban", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs">BIC/SWIFT</Label>
              <Input
                placeholder="BSCHESMM"
                value={clienteData.bic_swift}
                onChange={e => updateClienteData("bic_swift", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conceptos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Conceptos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="hidden grid-cols-[1fr_100px_120px_40px] gap-3 md:grid">
            <Label className="text-xs text-muted-foreground">Concepto</Label>
            <Label className="text-xs text-muted-foreground">Cantidad</Label>
            <Label className="text-xs text-muted-foreground">Precio Unit.</Label>
            <div />
          </div>

          {conceptos.map((c, i) => (
            <div key={i} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_100px_120px_40px]">
              <Input
                placeholder="Descripcion del servicio"
                value={c.concepto}
                onChange={e => updateRow(i, "concepto", e.target.value)}
              />
              <Input
                type="number"
                min={1}
                placeholder="Cant."
                value={c.cantidad}
                onChange={e => updateRow(i, "cantidad", parseFloat(e.target.value) || 0)}
                onFocus={e => e.target.select()}
              />
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="Precio"
                value={c.precio}
                onChange={e => updateRow(i, "precio", parseFloat(e.target.value) || 0)}
                onFocus={e => e.target.select()}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeRow(i)}
                disabled={conceptos.length <= 1}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Agregar concepto
            </Button>
            <p className="text-sm font-medium">
              Total: <span className="text-lg font-bold text-primary">{formatCurrency(total)}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Adjuntos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Adjuntos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`rounded-lg border border-dashed p-6 text-center transition-colors ${dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 bg-muted/20"}`}
          >
            <FileUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Arrastra archivos aquí o selecciónalos manualmente</p>
            <p className="mt-1 text-xs text-muted-foreground">PDF o imágenes. Máximo {MAX_FILES} archivos de 10 MB.</p>
            <Input
              id="adjuntos-solicitud"
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              onChange={handleFileInput}
              className="hidden"
            />
            <Button type="button" variant="outline" size="sm" className="mt-3" asChild>
              <Label htmlFor="adjuntos-solicitud" className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4" /> Seleccionar archivos
              </Label>
            </Button>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file, idx) => (
                <div key={`${file.name}-${idx}`} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeFile(idx)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Observaciones */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Observaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Notas adicionales para la factura..."
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Enviar Solicitud
        </Button>
      </div>

      {/* Dialog de confirmación de actualización de datos */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Actualizar datos de facturación</DialogTitle>
            <DialogDescription>
              Has modificado tus datos. ¿Quieres guardar estos cambios permanentemente?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
              {clienteData.direccion !== datosOriginales.direccion && (
                <div><span className="font-medium">Dirección:</span> {clienteData.direccion || "(vacío)"}</div>
              )}
              {clienteData.cp !== datosOriginales.cp && (
                <div><span className="font-medium">CP:</span> {clienteData.cp || "(vacío)"}</div>
              )}
              {clienteData.ciudad !== datosOriginales.ciudad && (
                <div><span className="font-medium">Ciudad:</span> {clienteData.ciudad || "(vacío)"}</div>
              )}
              {clienteData.telefono !== datosOriginales.telefono && (
                <div><span className="font-medium">Teléfono:</span> {clienteData.telefono || "(vacío)"}</div>
              )}
              {clienteData.banco !== datosOriginales.banco && (
                <div><span className="font-medium">Banco:</span> {clienteData.banco || "(vacío)"}</div>
              )}
              {clienteData.iban !== datosOriginales.iban && (
                <div><span className="font-medium">IBAN:</span> {clienteData.iban || "(vacío)"}</div>
              )}
              {clienteData.bic_swift !== datosOriginales.bic_swift && (
                <div><span className="font-medium">BIC/SWIFT:</span> {clienteData.bic_swift || "(vacío)"}</div>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => enviarSolicitud(false)}
                disabled={submitting}
              >
                No, solo esta vez
              </Button>
              <Button 
                className="flex-1"
                onClick={() => enviarSolicitud(true)}
                disabled={submitting}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sí, actualizar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </div>
  )
}
