"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { FileText, Loader2, ArrowLeft, Plus } from "lucide-react"
import { toast } from "sonner"
import type { Asesoria } from "@/lib/types"

export default function RegisterClientePage() {
  const [form, setForm] = useState({
    tipo: "empresa" as "empresa" | "particular",
    nombre: "", nif: "", email: "", password: "", confirmPassword: "",
    telefono: "", direccion: "", cp: "", ciudad: "", dias_pago: "30",
    banco: "", iban: "", bic_swift: "",  // ✅ NUEVO
  })
  const [asesorias, setAsesorias] = useState<Asesoria[]>([])
  const [selectedAsesoriaId, setSelectedAsesoriaId] = useState("")
  const [showNewAsesoria, setShowNewAsesoria] = useState(false)
  const [newAsesoria, setNewAsesoria] = useState({ nombre: "", nif: "" })
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadAsesorias() {
      const { data } = await supabase.from("asesorias").select("*").order("nombre")
      if (data) setAsesorias(data)
    }
    loadAsesorias()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function createNewAsesoria(): Promise<string | null> {
    const { data, error } = await supabase
      .from("asesorias")
      .insert({ nombre: newAsesoria.nombre, nif: newAsesoria.nif, email: "" })
      .select()
      .single()
    if (error) { toast.error("Error al crear asesoria: " + error.message); return null }
    setAsesorias(prev => [...prev, data])
    setSelectedAsesoriaId(data.id)
    setShowNewAsesoria(false)
    return data.id
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirmPassword) { toast.error("Las contrasenas no coinciden"); return }
    if (form.password.length < 6) { toast.error("La contrasena debe tener al menos 6 caracteres"); return }

    let asesoriaId = selectedAsesoriaId
    if (!asesoriaId) { toast.error("Selecciona una asesoria"); return }

    setLoading(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { user_type: "cliente", nombre: form.nombre } },
      })
      if (authError) throw authError
      if (!authData.user) throw new Error("No se pudo crear el usuario")

        const { error: clienteError } = await supabase.from("clientes").insert({
          user_id: authData.user.id,
          asesoria_id: asesoriaId,
          tipo: form.tipo,
          nombre: form.nombre,
          nif: form.nif,
          email: form.email,
          telefono: form.telefono || null,
          direccion: form.direccion || null,
          cp: form.cp || null,
          ciudad: form.ciudad || null,
          dias_pago: parseInt(form.dias_pago) || 30,
          banco: form.banco || null,  // ✅ NUEVO
          iban: form.iban || null,    // ✅ NUEVO
          bic_swift: form.bic_swift || null,  // ✅ NUEVO
        })
      if (clienteError) throw clienteError

      toast.success("Cuenta creada correctamente. Revisa tu email para confirmar.")
      router.push("/")
    } catch (err: any) {
      toast.error(err.message || "Error al registrar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-primary">
          <FileText className="h-10 w-10" />
          <h1 className="text-3xl font-bold tracking-tight">MuyFactu</h1>
        </div>
      </div>

      <Card className="w-full max-w-lg">
        <CardHeader>
          <Link href="/" className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Volver al login
          </Link>
          <CardTitle>Registrar Cliente</CardTitle>
          <CardDescription>Crea tu cuenta de cliente para solicitar facturas</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Tipo de cliente *</Label>
              <RadioGroup value={form.tipo} onValueChange={v => updateField("tipo", v)} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="empresa" id="empresa" />
                  <Label htmlFor="empresa">Empresa</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="particular" id="particular" />
                  <Label htmlFor="particular">Particular</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input id="nombre" value={form.nombre} onChange={e => updateField("nombre", e.target.value)} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="nif">NIF *</Label>
                <Input id="nif" placeholder="12345678A" value={form.nif} onChange={e => updateField("nif", e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="banco">Banco</Label>
                <Input id="banco" placeholder="Santander, BBVA..." value={form.banco} onChange={e => updateField("banco", e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="iban">IBAN</Label>
                <Input id="iban" placeholder="ES00 0000 0000 0000 0000 0000" value={form.iban} onChange={e => updateField("iban", e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="bic_swift">BIC/SWIFT</Label>
                <Input id="bic_swift" placeholder="BSCHESMM" value={form.bic_swift} onChange={e => updateField("bic_swift", e.target.value)} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" value={form.email} onChange={e => updateField("email", e.target.value)} required />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Contrasena *</Label>
                <Input id="password" type="password" value={form.password} onChange={e => updateField("password", e.target.value)} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirmPassword">Confirmar Contrasena *</Label>
                <Input id="confirmPassword" type="password" value={form.confirmPassword} onChange={e => updateField("confirmPassword", e.target.value)} required />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Asesoria *</Label>
              <div className="flex items-center gap-2">
                <Select value={selectedAsesoriaId} onValueChange={setSelectedAsesoriaId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleccionar asesoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {asesorias.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.nombre} ({a.nif})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={showNewAsesoria} onOpenChange={setShowNewAsesoria}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" size="icon"><Plus className="h-4 w-4" /></Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Crear Nueva Asesoria</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <Label>Nombre Asesoria</Label>
                        <Input value={newAsesoria.nombre} onChange={e => setNewAsesoria(p => ({ ...p, nombre: e.target.value }))} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>NIF Asesoria</Label>
                        <Input value={newAsesoria.nif} onChange={e => setNewAsesoria(p => ({ ...p, nif: e.target.value }))} />
                      </div>
                      <Button onClick={createNewAsesoria}>Crear Asesoria</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="telefono">Telefono</Label>
              <Input id="telefono" value={form.telefono} onChange={e => updateField("telefono", e.target.value)} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="direccion">Direccion</Label>
                <Input id="direccion" value={form.direccion} onChange={e => updateField("direccion", e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cp">Codigo Postal</Label>
                <Input id="cp" value={form.cp} onChange={e => updateField("cp", e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ciudad">Ciudad</Label>
                <Input id="ciudad" value={form.ciudad} onChange={e => updateField("ciudad", e.target.value)} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="dias_pago">Dias de Pago</Label>
              <Input id="dias_pago" type="number" value={form.dias_pago} onChange={e => updateField("dias_pago", e.target.value)} />
            </div>

            <Button type="submit" className="mt-2 w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar Cliente
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
