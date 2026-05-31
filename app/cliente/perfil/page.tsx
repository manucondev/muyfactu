"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { EstadoBadge } from "@/components/estado-badge"
import { Loader2, Building2, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import type { Asesoria } from "@/lib/types"

export default function PerfilPage() {
  const { cliente, user, refreshProfile } = useAuth()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [asesoria, setAsesoria] = useState<Asesoria | null>(null)
  const [loading, setLoading] = useState(true)

  // Profile form
  const [email, setEmail] = useState("")
  const [telefono, setTelefono] = useState("")
  const [direccion, setDireccion] = useState("")
  const [cp, setCp] = useState("")
  const [ciudad, setCiudad] = useState("")
  const [banco, setBanco] = useState("")
  const [iban, setIban] = useState("")
  const [bicSwift, setBicSwift] = useState("")

  // Password form
  const [currentPass, setCurrentPass] = useState("")
  const [newPass, setNewPass] = useState("")
  const [confirmPass, setConfirmPass] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [changingPass, setChangingPass] = useState(false)

  useEffect(() => {
    if (!cliente) return
    setEmail(cliente.email)
    setTelefono(cliente.telefono || "")
    setDireccion(cliente.direccion || "")
    setCp(cliente.cp || "")
    setCiudad(cliente.ciudad || "")
    setBanco(cliente.banco || "")
    setIban(cliente.iban || "")
    setBicSwift(cliente.bic_swift || "")

    async function loadAsesoria() {
      if (!cliente?.asesoria_id) {
        console.error("Cliente sin asesoria_id")
        setLoading(false)
        return
      }
      
      const { data, error } = await supabase
        .from("asesorias")
        .select("*")
        .eq("id", cliente.asesoria_id)
        .single()
      
      if (error) {
        console.error("Error cargando asesoría:", error)
      }
      
      if (data) setAsesoria(data)
      setLoading(false)
    }
    loadAsesoria()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente])

  async function handleSave() {
    if (!cliente) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from("clientes")
        .update({ email, telefono, direccion, cp, ciudad, banco, iban, bic_swift: bicSwift })
        .eq("id", cliente.id)
      if (error) throw error
      await refreshProfile()
      toast.success("Perfil actualizado")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al guardar"
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword() {
    if (newPass !== confirmPass) {
      toast.error("Las contrasenas no coinciden")
      return
    }
    if (newPass.length < 6) {
      toast.error("La contrasena debe tener al menos 6 caracteres")
      return
    }
    setChangingPass(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass })
      if (error) throw error
      setCurrentPass("")
      setNewPass("")
      setConfirmPass("")
      toast.success("Contrasena actualizada")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al cambiar contrasena"
      toast.error(message)
    } finally {
      setChangingPass(false)
    }
  }

  // Password strength
  function getStrength(pass: string): { level: number; label: string; color: string } {
    let score = 0
    if (pass.length >= 6) score++
    if (pass.length >= 10) score++
    if (/[A-Z]/.test(pass)) score++
    if (/[0-9]/.test(pass)) score++
    if (/[^A-Za-z0-9]/.test(pass)) score++
    if (score <= 1) return { level: 1, label: "Debil", color: "bg-destructive" }
    if (score <= 3) return { level: 2, label: "Media", color: "bg-warning" }
    return { level: 3, label: "Fuerte", color: "bg-success" }
  }

  const strength = getStrength(newPass)


  function getLogoUrl(logoUrl: string) {
    if (/^https?:\/\//i.test(logoUrl)) return logoUrl
    return supabase.storage.from("logos").getPublicUrl(logoUrl).data.publicUrl
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
          <h1 className="text-3xl font-semibold text-foreground">Mi Perfil</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tu información personal
          </p>
        </div>

      <Tabs defaultValue="datos">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="datos">Datos</TabsTrigger>
          <TabsTrigger value="seguridad">Seguridad</TabsTrigger>
        </TabsList>

        <TabsContent value="datos" className="space-y-6">
          {/* Identity info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informacion Personal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <EstadoBadge estado={cliente?.tipo || "empresa"} />
                <span className="text-sm font-medium">{cliente?.nombre}</span>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">NIF</Label>
                <p className="text-sm font-medium">{cliente?.nif}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefono">Telefono</Label>
                  <Input id="telefono" value={telefono} onChange={e => setTelefono(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="direccion">Direccion</Label>
                <Input id="direccion" value={direccion} onChange={e => setDireccion(e.target.value)} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cp">Codigo Postal</Label>
                  <Input id="cp" value={cp} onChange={e => setCp(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ciudad">Ciudad</Label>
                  <Input id="ciudad" value={ciudad} onChange={e => setCiudad(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="banco">Banco</Label>
                <Input 
                  id="banco" 
                  placeholder="Santander, BBVA, CaixaBank..." 
                  value={banco} 
                  onChange={e => setBanco(e.target.value)} 
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="iban">IBAN</Label>
                  <Input 
                    id="iban" 
                    placeholder="ES00 0000 0000 0000 0000 0000" 
                    value={iban} 
                    onChange={e => setIban(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bic_swift">BIC/SWIFT</Label>
                  <Input 
                    id="bic_swift" 
                    placeholder="BSCHESMM" 
                    value={bicSwift} 
                    onChange={e => setBicSwift(e.target.value)} 
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar Cambios
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Asesoria info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" /> Mi Asesoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              {asesoria ? (
                <div className="flex items-center gap-4">
                  {asesoria.logo_url ? (
                    <img
                      src={getLogoUrl(asesoria.logo_url)}
                      alt={`Logo ${asesoria.nombre}`}
                      className="h-12 w-12 rounded-lg object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-white font-semibold">
                      {asesoria.nombre.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{asesoria.nombre}</p>
                    <p className="text-sm text-muted-foreground">{asesoria.email}</p>
                    {asesoria.telefono && (
                      <p className="text-sm text-muted-foreground">{asesoria.telefono}</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No se ha encontrado informacion de la asesoria</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seguridad">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4" /> Cambiar Contrasena
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current">Contrasena actual</Label>
                <div className="relative">
                  <Input
                    id="current"
                    type={showPass ? "text" : "password"}
                    value={currentPass}
                    onChange={e => setCurrentPass(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPass(!showPass)}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new">Nueva contrasena</Label>
                <Input
                  id="new"
                  type={showPass ? "text" : "password"}
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                />
                {newPass && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3].map(i => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full ${i <= strength.level ? strength.color : "bg-muted"}`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> {strength.label}
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar contrasena</Label>
                <Input
                  id="confirm"
                  type={showPass ? "text" : "password"}
                  value={confirmPass}
                  onChange={e => setConfirmPass(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleChangePassword} disabled={changingPass || !newPass || !confirmPass}>
                  {changingPass && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Cambiar Contrasena
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </div>
  )
}
