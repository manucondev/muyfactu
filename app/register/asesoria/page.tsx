"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { registerAsesoria } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Loader2, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

export default function RegisterAsesoriaPage() {
  const [form, setForm] = useState({
    nombre: "", nif: "", email: "", password: "", confirmPassword: "",
    telefono: "", direccion: "", ciudad: "",
  })
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function updateField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      toast.error("Las contraseñas no coinciden")
      return
    }
    if (form.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres")
      return
    }

    setLoading(true)
    try {
      const result = await registerAsesoria({
        nombre: form.nombre,
        nif: form.nif,
        email: form.email,
        password: form.password,
        telefono: form.telefono,
        direccion: form.direccion,
        ciudad: form.ciudad,
      })

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success("Cuenta creada correctamente")
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
          <CardTitle>Registrar Asesoría</CardTitle>
          <CardDescription>Crea tu cuenta de asesoría para gestionar clientes y facturas</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="nombre">Nombre de la Asesoría *</Label>
                <Input id="nombre" value={form.nombre} onChange={e => updateField("nombre", e.target.value)} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="nif">NIF *</Label>
                <Input id="nif" placeholder="B12345678" value={form.nif} onChange={e => updateField("nif", e.target.value)} required />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" value={form.email} onChange={e => updateField("email", e.target.value)} required />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Contraseña *</Label>
                <Input id="password" type="password" value={form.password} onChange={e => updateField("password", e.target.value)} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirmPassword">Confirmar Contraseña *</Label>
                <Input id="confirmPassword" type="password" value={form.confirmPassword} onChange={e => updateField("confirmPassword", e.target.value)} required />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input id="telefono" value={form.telefono} onChange={e => updateField("telefono", e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="direccion">Dirección</Label>
                <Input id="direccion" value={form.direccion} onChange={e => updateField("direccion", e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ciudad">Ciudad</Label>
                <Input id="ciudad" value={form.ciudad} onChange={e => updateField("ciudad", e.target.value)} />
              </div>
            </div>
            <Button type="submit" className="mt-2 w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar Asesoría
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}