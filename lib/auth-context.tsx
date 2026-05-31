"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import type { UserType, Asesoria, Cliente, UsuarioAsesoria } from "@/lib/types"

interface AuthContextType {
  user: User | null
  userType: UserType | null
  asesoria: Asesoria | null
  usuarioAsesoria: UsuarioAsesoria | null
  cliente: Cliente | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userType: null,
  asesoria: null,
  usuarioAsesoria: null,
  cliente: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userType, setUserType] = useState<UserType | null>(null)
  const [asesoria, setAsesoria] = useState<Asesoria | null>(null)
  const [usuarioAsesoria, setUsuarioAsesoria] = useState<UsuarioAsesoria | null>(null)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  async function loadProfile(authUser: User) {
    // Check if user is asesoria
    const { data: ua } = await supabase
      .from("usuarios_asesoria")
      .select("*, asesorias(*)")
      .eq("user_id", authUser.id)
      .single()

    if (ua) {
      setUserType("asesoria")
      setUsuarioAsesoria(ua)
      setAsesoria(ua.asesorias)
      setCliente(null)
      if (typeof window !== "undefined") localStorage.setItem("userType", "asesoria")
      return
    }

    // Check if user is cliente
    const { data: cl } = await supabase
      .from("clientes")
      .select("*")
      .eq("user_id", authUser.id)
      .single()

    if (cl) {
      setUserType("cliente")
      setCliente(cl)
      setUsuarioAsesoria(null)
      setAsesoria(null)
      if (typeof window !== "undefined") localStorage.setItem("userType", "cliente")
      return
    }

    setUserType(null)
  }

  async function refreshProfile() {
    if (user) {
      await loadProfile(user)
    }
  }

  useEffect(() => {
    async function init() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)
      if (authUser) {
        await loadProfile(authUser)
      }
      setLoading(false)
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const authUser = session?.user ?? null
      setUser(authUser)
      if (authUser) {
        await loadProfile(authUser)
      } else {
        setUserType(null)
        setAsesoria(null)
        setUsuarioAsesoria(null)
        setCliente(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setUserType(null)
    setAsesoria(null)
    setUsuarioAsesoria(null)
    setCliente(null)
    if (typeof window !== "undefined") localStorage.removeItem("userType")
  }

  return (
    <AuthContext.Provider value={{ user, userType, asesoria, usuarioAsesoria, cliente, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
