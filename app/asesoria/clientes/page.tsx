"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { EstadoBadge } from "@/components/estado-badge"
import { EmptyState } from "@/components/empty-state"
import { formatDate, formatCurrency, calcImporte } from "@/lib/format"
import { Plus, Search, Users, Eye, Pencil, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { registerCliente } from "@/app/actions/auth"
import type { Cliente, SolicitudFactura, Factura } from "@/lib/types"


export default function ClientesPage() {
  const { asesoria } = useAuth()
  const supabase = createClient()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailCliente, setDetailCliente] = useState<Cliente | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [credentialsOpen, setCredentialsOpen] = useState(false)
  const [tempCredentials, setTempCredentials] = useState<{ email: string; password: string } | null>(null)

  // Create form
  const [newCliente, setNewCliente] = useState({
    tipo: "empresa" as "empresa" | "particular",
    nombre: "", nif: "", email: "", telefono: "", direccion: "", cp: "", ciudad: "", dias_pago: "30",
    banco: "", iban: "", bic_swift: "",
  })

  const loadClientes = useCallback(async () => {
    if (!asesoria) return
    const { data } = await supabase
      .from("clientes")
      .select("*")
      .eq("asesoria_id", asesoria.id)
      .order("created_at", { ascending: false })
    if (data) setClientes(data)
    setLoading(false)
  }, [asesoria, supabase])

  useEffect(() => { loadClientes() }, [loadClientes])

  const filtered = clientes.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    c.nif.toLowerCase().includes(search.toLowerCase())
  )

  async function handleCreateCliente(e: React.FormEvent) {
    e.preventDefault()
    if (!asesoria) return
    setCreating(true)
    try {
      const result = await registerCliente({
        asesoria_id: asesoria.id,
        tipo: newCliente.tipo,
        nombre: newCliente.nombre,
        nif: newCliente.nif,
        email: newCliente.email,
        telefono: newCliente.telefono,
        direccion: newCliente.direccion,
        cp: newCliente.cp,
        ciudad: newCliente.ciudad,
        dias_pago: parseInt(newCliente.dias_pago) || 30,
        banco: newCliente.banco,
        iban: newCliente.iban,
        bic_swift: newCliente.bic_swift,
        asesoria_nombre: asesoria.nombre,
      })
  
      if (!result.success) {
        throw new Error(result.error)
      }
  
      setTempCredentials({ email: result.email!, password: result.password! })
      setCredentialsOpen(true)
      
      setCreateOpen(false)
      setNewCliente({ tipo: "empresa", nombre: "", nif: "", email: "", telefono: "", direccion: "", cp: "", ciudad: "", dias_pago: "30", banco: "", iban: "", bic_swift: "" })
      loadClientes()
    } catch (err: any) {
      toast.error(err.message || "Error al crear cliente")
    } finally {
      setCreating(false)
    }
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Clientes</h1>
            <p className="text-muted-foreground mt-1">
              {clientes.length} clientes registrados
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nuevo Cliente</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nuevo Cliente</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateCliente} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Tipo</Label>
                  <RadioGroup value={newCliente.tipo} onValueChange={v => setNewCliente(p => ({ ...p, tipo: v as any }))} className="flex gap-4">
                    <div className="flex items-center gap-2"><RadioGroupItem value="empresa" id="n-emp" /><Label htmlFor="n-emp">Empresa</Label></div>
                    <div className="flex items-center gap-2"><RadioGroupItem value="particular" id="n-par" /><Label htmlFor="n-par">Particular</Label></div>
                  </RadioGroup>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2"><Label>Nombre *</Label><Input value={newCliente.nombre} onChange={e => setNewCliente(p => ({ ...p, nombre: e.target.value }))} required /></div>
                  <div className="flex flex-col gap-2"><Label>NIF *</Label><Input value={newCliente.nif} onChange={e => setNewCliente(p => ({ ...p, nif: e.target.value }))} required /></div>
                </div>
                <div className="flex flex-col gap-2"><Label>Email *</Label><Input type="email" value={newCliente.email} onChange={e => setNewCliente(p => ({ ...p, email: e.target.value }))} required /></div>
                <div className="flex flex-col gap-2"><Label>Telefono</Label><Input value={newCliente.telefono} onChange={e => setNewCliente(p => ({ ...p, telefono: e.target.value }))} /></div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col gap-2"><Label>Direccion</Label><Input value={newCliente.direccion} onChange={e => setNewCliente(p => ({ ...p, direccion: e.target.value }))} /></div>
                  <div className="flex flex-col gap-2"><Label>CP</Label><Input value={newCliente.cp} onChange={e => setNewCliente(p => ({ ...p, cp: e.target.value }))} /></div>
                  <div className="flex flex-col gap-2"><Label>Ciudad</Label><Input value={newCliente.ciudad} onChange={e => setNewCliente(p => ({ ...p, ciudad: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col gap-2"><Label>Banco</Label><Input placeholder="Santander, BBVA..." value={newCliente.banco} onChange={e => setNewCliente(p => ({ ...p, banco: e.target.value }))} /></div>
                  <div className="flex flex-col gap-2"><Label>IBAN</Label><Input placeholder="ES00..." value={newCliente.iban} onChange={e => setNewCliente(p => ({ ...p, iban: e.target.value }))} /></div>
                  <div className="flex flex-col gap-2"><Label>BIC/SWIFT</Label><Input placeholder="BSCHESMM" value={newCliente.bic_swift} onChange={e => setNewCliente(p => ({ ...p, bic_swift: e.target.value }))} /></div>
                </div>
                <div className="flex flex-col gap-2"><Label>Dias de pago</Label><Input type="number" value={newCliente.dias_pago} onChange={e => setNewCliente(p => ({ ...p, dias_pago: e.target.value }))} /></div>
                <Button type="submit" disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Crear Cliente
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nombre o NIF..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={Users} title="Sin clientes" description={search ? "No se encontraron resultados" : "Crea tu primer cliente"} />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>NIF</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nombre}</TableCell>
                      <TableCell className="font-mono text-sm">{c.nif}</TableCell>
                      <TableCell>{c.email}</TableCell>
                      <TableCell><EstadoBadge estado={c.tipo} /></TableCell>
                      <TableCell><EstadoBadge estado={c.estado} /></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => { setDetailCliente(c); setDetailOpen(true) }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Detail Modal */}
        <ClienteDetailModal
          cliente={detailCliente}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          asesoriaId={asesoria?.id || ""}
          onUpdate={loadClientes}
        />

        {/* Credentials Modal */}
        <Dialog open={credentialsOpen} onOpenChange={setCredentialsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cliente creado correctamente</DialogTitle>
            </DialogHeader>
            {tempCredentials && (
              <div className="space-y-4">
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                  <p className="text-sm text-blue-900 mb-3">
                    ⚠️ Guarda estas credenciales. No podrás verlas de nuevo.
                  </p>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Email</Label>
                      <div className="flex gap-2">
                        <Input value={tempCredentials.email} readOnly className="font-mono text-sm" />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(tempCredentials.email)
                            toast.success("Email copiado")
                          }}
                        >
                          Copiar
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Contraseña temporal</Label>
                      <div className="flex gap-2">
                        <Input value={tempCredentials.password} readOnly className="font-mono text-sm" />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(tempCredentials.password)
                            toast.success("Contraseña copiada")
                          }}
                        >
                          Copiar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <Button onClick={() => setCredentialsOpen(false)} className="w-full">
                  Entendido
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

function ClienteDetailModal({
  cliente, open, onOpenChange, asesoriaId, onUpdate,
}: {
  cliente: Cliente | null
  open: boolean
  onOpenChange: (o: boolean) => void
  asesoriaId: string
  onUpdate: () => void
}) {
  const supabase = createClient()
  const [editForm, setEditForm] = useState<Partial<Cliente>>({})
  const [solicitudes, setSolicitudes] = useState<SolicitudFactura[]>([])
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!cliente) return
    setEditForm(cliente)
    async function load() {
      const [solRes, facRes] = await Promise.all([
        supabase.from("solicitudes_factura").select("*").eq("cliente_id", cliente!.id).order("created_at", { ascending: false }),
        supabase.from("facturas").select("*").eq("cliente_id", cliente!.id).order("created_at", { ascending: false }),
      ])
      setSolicitudes(solRes.data || [])
      setFacturas(facRes.data || [])
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente])

  async function handleSave() {
    if (!cliente) return
    setSaving(true)
    const { error } = await supabase.from("clientes").update({
      nombre: editForm.nombre,
      email: editForm.email,
      telefono: editForm.telefono,
      direccion: editForm.direccion,
      cp: editForm.cp,
      ciudad: editForm.ciudad,
      dias_pago: editForm.dias_pago,
      banco: editForm.banco,
      iban: editForm.iban,
      bic_swift: editForm.bic_swift,
    }).eq("id", cliente.id)
    if (error) toast.error(error.message)
    else { toast.success("Cliente actualizado"); onUpdate() }
    setSaving(false)
  }

  if (!cliente) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cliente.nombre}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="datos">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="datos">Datos</TabsTrigger>
            <TabsTrigger value="solicitudes">Solicitudes ({solicitudes.length})</TabsTrigger>
            <TabsTrigger value="facturas">Facturas ({facturas.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="datos" className="flex flex-col gap-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2"><Label>Nombre</Label><Input value={editForm.nombre || ""} onChange={e => setEditForm(p => ({ ...p, nombre: e.target.value }))} /></div>
              <div className="flex flex-col gap-2"><Label>NIF</Label><Input value={editForm.nif || ""} disabled /></div>
            </div>
            <div className="flex flex-col gap-2"><Label>Email</Label><Input value={editForm.email || ""} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div className="flex flex-col gap-2"><Label>Telefono</Label><Input value={editForm.telefono || ""} onChange={e => setEditForm(p => ({ ...p, telefono: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2"><Label>Direccion</Label><Input value={editForm.direccion || ""} onChange={e => setEditForm(p => ({ ...p, direccion: e.target.value }))} /></div>
              <div className="flex flex-col gap-2"><Label>CP</Label><Input value={editForm.cp || ""} onChange={e => setEditForm(p => ({ ...p, cp: e.target.value }))} /></div>
              <div className="flex flex-col gap-2"><Label>Ciudad</Label><Input value={editForm.ciudad || ""} onChange={e => setEditForm(p => ({ ...p, ciudad: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2"><Label>Banco</Label><Input value={editForm.banco || ""} onChange={e => setEditForm(p => ({ ...p, banco: e.target.value }))} /></div>
              <div className="flex flex-col gap-2"><Label>IBAN</Label><Input value={editForm.iban || ""} onChange={e => setEditForm(p => ({ ...p, iban: e.target.value }))} /></div>
              <div className="flex flex-col gap-2"><Label>BIC/SWIFT</Label><Input value={editForm.bic_swift || ""} onChange={e => setEditForm(p => ({ ...p, bic_swift: e.target.value }))} /></div>
            </div>
            <div className="flex flex-col gap-2"><Label>Dias de pago</Label><Input type="number" value={editForm.dias_pago || 30} onChange={e => setEditForm(p => ({ ...p, dias_pago: parseInt(e.target.value) }))} /></div>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar Cambios
            </Button>
          </TabsContent>

          <TabsContent value="solicitudes" className="pt-4">
            {solicitudes.length === 0 ? (
              <EmptyState icon={Users} title="Sin solicitudes" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {solicitudes.map(s => (
                    <TableRow key={s.id}>
                      <TableCell>{formatDate(s.created_at)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(calcImporte(s.conceptos))}</TableCell>
                      <TableCell><EstadoBadge estado={s.estado} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="facturas" className="pt-4">
            {facturas.length === 0 ? (
              <EmptyState icon={Users} title="Sin facturas" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {facturas.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-mono">{f.serie}-{String(f.numero).padStart(4, "0")}</TableCell>
                      <TableCell>{formatDate(f.fecha_emision)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(f.total)}</TableCell>
                      <TableCell><EstadoBadge estado={f.estado} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
