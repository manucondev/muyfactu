"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Building2, User, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { motion } from "framer-motion"


export default function LoginPage() {
  const [tab, setTab] = useState<"asesoria" | "cliente">("asesoria")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [activeSide, setActiveSide] = useState<"left" | "right" | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      const userId = data.user.id

      if (tab === "asesoria") {
        const { data: ua } = await supabase
          .from("usuarios_asesoria")
          .select("id")
          .eq("user_id", userId)
          .single()

        if (!ua) {
          toast.error("No se encontro cuenta de asesoria para este usuario")
          await supabase.auth.signOut()
          setLoading(false)
          return
        }
        localStorage.setItem("userType", "asesoria")
        router.push("/asesoria")
      } else {
        const { data: cl } = await supabase
          .from("clientes")
          .select("id")
          .eq("user_id", userId)
          .single()

        if (!cl) {
          toast.error("No se encontro cuenta de cliente para este usuario")
          await supabase.auth.signOut()
          setLoading(false)
          return
        }
        localStorage.setItem("userType", "cliente")
        router.push("/cliente")
      }
    } catch (err: any) {
      toast.error(err.message || "Error al iniciar sesion")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen overflow-hidden">
  
      {/* LADO IZQUIERDO */}
      <motion.div
        onMouseEnter={() => setActiveSide("left")}
        onMouseLeave={() => setActiveSide(null)}
        animate={{
          flex: activeSide === "left" ? 1.2 : activeSide === "right" ? 0.8 : 1,
        }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
        className="hidden lg:flex relative items-center justify-center bg-gradient-to-br from-blue-600 to-blue-700 p-16 text-white"
        style={{ flexBasis: 0 }}
      >
        <div className="max-w-md">
  
          <h1 className="text-4xl font-extrabold tracking-tight">
            <span className="text-white">Muy</span>
            <span className="text-blue-200">Factu</span>
          </h1>
  
          <motion.p
            animate={{ opacity: activeSide === "right" ? 0.7 : 1 }}
            className="mt-6 text-lg text-blue-100 leading-relaxed"
          >
            Facturación electrónica adaptada a Verifactu, diseñada para asesorías y empresas que necesitan cumplimiento sin complicaciones.
          </motion.p>
  
          {/* Imagen / logo que aparece al expandirse */}
          <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{
                        opacity: activeSide === "left" ? 1 : 0,
                        y: activeSide === "left" ? 0 : 20,
                      }}
                      transition={{ duration: 0.3 }}
                      className="mt-10"
                    >
                      <div className="h-40 w-full rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-blue-100 text-sm">
                      <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{
              opacity: activeSide === "left" ? 1 : 0,
              y: activeSide === "left" ? 0 : 30,
            }}
            transition={{ duration: 0.4 }}
            className="mt-10"
          >
            <div className="rounded-2xl bg-white shadow-2xl p-6 text-slate-900 w-[380px]">

              <div className="text-sm font-semibold text-slate-700 mb-4">
                Facturas recientes
              </div>

              <div className="space-y-4 text-sm">

                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">Pablo García</div>
                    <div className="text-xs text-slate-500">A-0014 · 19/02/2026</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">181,50 €</div>
                    <div className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full inline-block mt-1">
                      Pendiente
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">Construcciones SL</div>
                    <div className="text-xs text-slate-500">A-0015 · 15/02/2026</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">620,00 €</div>
                    <div className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full inline-block mt-1">
                      Enviada
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">Consultoría Pro</div>
                    <div className="text-xs text-slate-500">A-0016 · 10/02/2026</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">450,00 €</div>
                    <div className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full inline-block mt-1">
                      Cobrada
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </motion.div>
            </div>
          </motion.div>
  
        </div>
      </motion.div>
  
      {/* LADO DERECHO */}
      <motion.div
        onMouseEnter={() => setActiveSide("right")}
        onMouseLeave={() => setActiveSide(null)}
        animate={{
          flex: activeSide === "right" ? 1.2 : activeSide === "left" ? 0.8 : 1,
        }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
        className="flex w-full lg:flex items-center justify-center px-6 py-12 bg-white"
        style={{ flexBasis: 0 }}
      >
        <div className="w-full max-w-md">
  
          <div className="mb-10">
            <h1 className="text-3xl font-extrabold tracking-tight">
              <span className="text-slate-900">Muy</span>
              <span className="text-blue-600">Factu</span>
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Accede a tu cuenta
            </p>
          </div>
  
          <motion.div
            animate={{
              scale: activeSide === "right" ? 1.02 : 1,
              boxShadow:
                activeSide === "right"
                  ? "0px 25px 60px rgba(0,0,0,0.08)"
                  : "0px 10px 30px rgba(0,0,0,0.05)",
            }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border border-slate-200 rounded-2xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-semibold text-slate-800">
                  Iniciar sesión
                </CardTitle>
                <CardDescription className="text-slate-500">
                  Selecciona tu tipo de cuenta
                </CardDescription>
              </CardHeader>
  
                <CardContent>
                <Tabs value={tab} onValueChange={(v) => setTab(v as "asesoria" | "cliente")}>
    
                  <TabsList className="mb-6 grid w-full grid-cols-2 bg-slate-100 p-1 rounded-lg">
                    <TabsTrigger 
                      value="asesoria" 
                      className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      Asesoría
                    </TabsTrigger>
                    <TabsTrigger 
                      value="cliente" 
                      className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      Cliente
                    </TabsTrigger>
                  </TabsList>
    
                  <TabsContent value="asesoria">
                    <form onSubmit={handleLogin} className="flex flex-col gap-5">
    
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="email-a">Email</Label>
                        <Input
                          id="email-a"
                          type="email"
                          placeholder="asesoria@email.com"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          required
                          className="h-11 rounded-lg"
                        />
                      </div>
    
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="pass-a">Contraseña</Label>
                        <Input
                          id="pass-a"
                          type="password"
                          placeholder="Tu contraseña"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          required
                          className="h-11 rounded-lg"
                        />
                      </div>
    
                      <Button
                        type="submit"
                        className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 transition-all"
                        disabled={loading}
                      >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Entrar como Asesoría
                      </Button>
    
                    </form>
                  </TabsContent>
    
                  <TabsContent value="cliente">
                    <form onSubmit={handleLogin} className="flex flex-col gap-5">
    
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="email-c">Email</Label>
                        <Input
                          id="email-c"
                          type="email"
                          placeholder="cliente@email.com"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          required
                          className="h-11 rounded-lg"
                        />
                      </div>
    
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="pass-c">Contraseña</Label>
                        <Input
                          id="pass-c"
                          type="password"
                          placeholder="Tu contraseña"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          required
                          className="h-11 rounded-lg"
                        />
                      </div>
    
                      <Button
                        type="submit"
                        className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 transition-all"
                        disabled={loading}
                      >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Entrar como Cliente
                      </Button>
    
                    </form>
                  </TabsContent>
    
                </Tabs>
    
                <div className="mt-8 flex flex-col gap-2 text-center text-sm">
                  <p className="text-slate-500">
                    ¿No tienes cuenta?{" "}
                    <Link href="/register/asesoria" className="font-medium text-blue-600 hover:text-blue-700">
                      Registrar asesoría
                    </Link>
                  </p>
                  <p className="text-slate-500">
                    ¿Eres cliente?{" "}
                    <Link href="/register/cliente" className="font-medium text-blue-600 hover:text-blue-700">
                      Registrar cliente
                    </Link>
                  </p>
                </div>
    
              </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  </div>
  )
}
