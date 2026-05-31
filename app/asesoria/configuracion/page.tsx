"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Upload, Shield, Palette, Loader2, CheckCircle, Image as ImageIcon } from "lucide-react"
import { toast } from "sonner"

export default function ConfiguracionPage() {
  const { asesoria, refreshProfile } = useAuth()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)

  // Datos tab
  const [datosForm, setDatosForm] = useState({
    nombre: "", email: "", telefono: "", direccion: "", ciudad: "",
  })

  // Certificado tab
  const [certStatus, setCertStatus] = useState("sin_certificado")
  const [certFile, setCertFile] = useState<File | null>(null)
  const [certPassword, setCertPassword] = useState("")

  // Plantilla tab
  const [plantilla, setPlantilla] = useState({
    estilo: "clasico",
    color_primario: "#2563EB",
    footer_texto: "",
  })

  useEffect(() => {
    if (!asesoria) return
    setDatosForm({
      nombre: asesoria.nombre || "",
      email: asesoria.email || "",
      telefono: asesoria.telefono || "",
      direccion: asesoria.direccion || "",
      ciudad: asesoria.ciudad || "",
    })

    async function loadConfig() {
      const { data: cert } = await supabase
        .from("certificados_digitales")
        .select("*")
        .eq("asesoria_id", asesoria!.id)
        .order("fecha_subida", { ascending: false })
        .limit(1)
        .single()
      if (cert) setCertStatus(cert.estado)

      const { data: pl } = await supabase
        .from("configuracion_plantilla")
        .select("*")
        .eq("asesoria_id", asesoria!.id)
        .single()
      if (pl) setPlantilla({
        estilo: pl.estilo,
        color_primario: pl.color_primario,
        footer_texto: pl.footer_texto || "",
      })
    }
    loadConfig()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asesoria])

  async function saveDatos() {
    if (!asesoria) return
    setSaving(true)
    const { error } = await supabase.from("asesorias").update({
      nombre: datosForm.nombre,
      email: datosForm.email,
      telefono: datosForm.telefono,
      direccion: datosForm.direccion,
      ciudad: datosForm.ciudad,
    }).eq("id", asesoria.id)
    if (error) toast.error(error.message)
    else { toast.success("Datos actualizados"); refreshProfile() }
    setSaving(false)
  }

  async function uploadLogo(file: File) {
    if (!asesoria) return
    const ext = file.name.split(".").pop()
    const path = `${asesoria.id}/logo.${ext}`
    const { error: uploadError } = await supabase.storage.from("logos").upload(path, file, { upsert: true })
    if (uploadError) { toast.error(uploadError.message); return }
    const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(path)
    await supabase.from("asesorias").update({ logo_url: publicUrl }).eq("id", asesoria.id)
    toast.success("Logo actualizado")
    refreshProfile()
  }

  async function uploadCert() {
    if (!asesoria || !certFile) return
    setSaving(true)
    const path = `${asesoria.id}/${certFile.name}`
    const { error } = await supabase.storage.from("certificados").upload(path, certFile, { upsert: true })
    if (error) { toast.error(error.message); setSaving(false); return }

    await supabase.from("certificados_digitales").insert({
      asesoria_id: asesoria.id,
      nombre_archivo: certFile.name,
      estado: "activo",
    })
    setCertStatus("activo")
    toast.success("Certificado subido correctamente")
    setSaving(false)
  }

  async function savePlantilla() {
    if (!asesoria) return
    setSaving(true)
    const { error } = await supabase.from("configuracion_plantilla").upsert({
      asesoria_id: asesoria.id,
      estilo: plantilla.estilo,
      color_primario: plantilla.color_primario,
      footer_texto: plantilla.footer_texto || null,
    }, { onConflict: "asesoria_id" })
    if (error) toast.error(error.message)
    else toast.success("Plantilla actualizada")
    setSaving(false)
  }

  if (!asesoria) {
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
          <h1 className="text-3xl font-semibold text-foreground">Configuración</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona los datos de tu asesoría
          </p>
        </div>

      <Tabs defaultValue="datos">
        <TabsList>
          <TabsTrigger value="datos">Datos</TabsTrigger>
          <TabsTrigger value="certificado">Certificado</TabsTrigger>
          <TabsTrigger value="plantilla">Plantilla</TabsTrigger>
        </TabsList>

        {/* DATOS */}
        <TabsContent value="datos" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos de la Asesoria</CardTitle>
              <CardDescription>Informacion que aparecera en las facturas</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2"><Label>Nombre</Label><Input value={datosForm.nombre} onChange={e => setDatosForm(p => ({ ...p, nombre: e.target.value }))} /></div>
                <div className="flex flex-col gap-2"><Label>Email</Label><Input value={datosForm.email} onChange={e => setDatosForm(p => ({ ...p, email: e.target.value }))} /></div>
              </div>
              <div className="flex flex-col gap-2"><Label>Telefono</Label><Input value={datosForm.telefono} onChange={e => setDatosForm(p => ({ ...p, telefono: e.target.value }))} /></div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2"><Label>Direccion</Label><Input value={datosForm.direccion} onChange={e => setDatosForm(p => ({ ...p, direccion: e.target.value }))} /></div>
                <div className="flex flex-col gap-2"><Label>Ciudad</Label><Input value={datosForm.ciudad} onChange={e => setDatosForm(p => ({ ...p, ciudad: e.target.value }))} /></div>
              </div>

              {/* Logo */}
              <div className="flex flex-col gap-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-4">
                  {asesoria.logo_url ? (
                    <img src={asesoria.logo_url} alt="Logo" className="h-16 w-16 rounded-lg border object-contain" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg border bg-muted">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={e => { if (e.target.files?.[0]) uploadLogo(e.target.files[0]) }}
                      className="max-w-xs"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">PNG, JPG. Max 2MB</p>
                  </div>
                </div>
              </div>

              <Button onClick={saveDatos} disabled={saving} className="w-fit">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar Datos
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CERTIFICADO */}
        <TabsContent value="certificado" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Shield className="h-5 w-5" /> Certificado Digital</CardTitle>
              <CardDescription>Sube tu certificado digital para la firma electronica</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-3 rounded-lg bg-muted p-4">
                <CheckCircle className={`h-5 w-5 ${certStatus === "activo" ? "text-emerald-600" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-medium">
                    {certStatus === "activo" ? "Certificado activo" : certStatus === "caducado" ? "Certificado caducado" : "Sin certificado"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {certStatus === "activo" ? "Tu certificado esta configurado correctamente" : "Sube un certificado .pfx o .p12"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Archivo del certificado (.pfx / .p12)</Label>
                <Input type="file" accept=".pfx,.p12" onChange={e => setCertFile(e.target.files?.[0] || null)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Contrasena del certificado</Label>
                <Input type="password" value={certPassword} onChange={e => setCertPassword(e.target.value)} placeholder="Contrasena del certificado" />
              </div>
              <Button onClick={uploadCert} disabled={saving || !certFile} className="w-fit">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Upload className="mr-2 h-4 w-4" /> Subir Certificado
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PLANTILLA */}
        <TabsContent value="plantilla" className="pt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Palette className="h-5 w-5" /> Estilo de Factura</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Estilo</Label>
                  <RadioGroup value={plantilla.estilo} onValueChange={v => setPlantilla(p => ({ ...p, estilo: v }))} className="flex flex-col gap-3">
                    {[
                      { value: "clasico", label: "Clasico", desc: "Diseno tradicional y formal" },
                      { value: "moderno", label: "Moderno", desc: "Diseno limpio y minimalista" },
                      { value: "corporativo", label: "Corporativo", desc: "Diseno profesional con cabecera" },
                    ].map(opt => (
                      <div key={opt.value} className="flex items-start gap-3 rounded-lg border p-3">
                        <RadioGroupItem value={opt.value} id={`est-${opt.value}`} className="mt-0.5" />
                        <div>
                          <Label htmlFor={`est-${opt.value}`} className="font-medium">{opt.label}</Label>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Color Primario</Label>
                  <div className="flex items-center gap-3">
                    <Input type="color" value={plantilla.color_primario} onChange={e => setPlantilla(p => ({ ...p, color_primario: e.target.value }))} className="h-10 w-16 p-1" />
                    <Input value={plantilla.color_primario} onChange={e => setPlantilla(p => ({ ...p, color_primario: e.target.value }))} className="font-mono" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Texto del Pie de Factura</Label>
                  <Textarea value={plantilla.footer_texto} onChange={e => setPlantilla(p => ({ ...p, footer_texto: e.target.value.slice(0, 200) }))} rows={3} maxLength={200} placeholder="Texto legal, datos bancarios..." />
                  <p className="text-xs text-muted-foreground">{plantilla.footer_texto.length}/200</p>
                </div>
                <Button onClick={savePlantilla} disabled={saving} className="w-fit">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar Plantilla
                </Button>
              </CardContent>
            </Card>

            {/* Preview */}
            <Card>
              <CardHeader><CardTitle className="text-base">Vista Previa</CardTitle></CardHeader>
              <CardContent>
                <div className="rounded-lg border bg-card p-6" style={{ fontFamily: plantilla.estilo === "moderno" ? "sans-serif" : "serif" }}>
                  <div className="mb-4 flex items-center justify-between border-b pb-4" style={{ borderColor: plantilla.color_primario }}>
                    <div>
                      <h3 className="text-lg font-bold" style={{ color: plantilla.color_primario }}>{asesoria.nombre}</h3>
                      <p className="text-xs text-muted-foreground">NIF: {asesoria.nif}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: plantilla.color_primario }}>FACTURA</p>
                      <p className="text-xs text-muted-foreground">A-0001</p>
                    </div>
                  </div>
                  <div className="mb-4 space-y-1 text-xs text-muted-foreground">
                    <p>Cliente: Ejemplo S.L.</p>
                    <p>Fecha: {new Date().toLocaleDateString("es-ES")}</p>
                  </div>
                  <div className="mb-4 border-t border-b py-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span>Concepto</span><span>Total</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Servicio ejemplo</span><span>100,00</span>
                    </div>
                  </div>
                  <div className="text-right text-sm font-bold" style={{ color: plantilla.color_primario }}>
                    Total: 121,00
                  </div>
                  {plantilla.footer_texto && (
                    <div className="mt-4 border-t pt-2">
                      <p className="text-[10px] text-muted-foreground">{plantilla.footer_texto}</p>
                    </div>
                  )}
                  <p className="mt-2 text-center text-[9px] text-muted-foreground">Cumple con la normativa Verifactu</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
    </div>
  )
}
