"use server"

import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { enviarEmailBienvenida } from "@/app/actions/emails"

export async function registerAsesoria(formData: {
  nombre: string
  nif: string
  email: string
  password: string
  telefono?: string
  direccion?: string
  ciudad?: string
}) {
  try {
    // 1. Crear usuario en auth con privilegios admin
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: formData.email,
      password: formData.password,
      email_confirm: true, // Auto-confirmar email para desarrollo
      user_metadata: { 
        user_type: "asesoria", 
        nombre: formData.nombre 
      },
    })

    if (authError) throw authError
    if (!authData.user) throw new Error("No se pudo crear el usuario")

    // 2. Crear registro en asesorias
    const { data: asesoriaData, error: asesoriaError } = await supabaseAdmin
      .from("asesorias")
      .insert({
        nombre: formData.nombre,
        nif: formData.nif,
        email: formData.email,
        telefono: formData.telefono || null,
        direccion: formData.direccion || null,
        ciudad: formData.ciudad || null,
      })
      .select()
      .single()

    if (asesoriaError) throw asesoriaError

    // 3. Crear relación en usuarios_asesoria
    const { error: uaError } = await supabaseAdmin
      .from("usuarios_asesoria")
      .insert({
        user_id: authData.user.id,
        asesoria_id: asesoriaData.id,
        nombre: formData.nombre,
        email: formData.email,
      })

    if (uaError) throw uaError

    revalidatePath("/")
    return { success: true }
  } catch (error: any) {
    console.error("Error en registerAsesoria:", error)
    return { success: false, error: error.message }
  }
}

export async function registerCliente(formData: {
  tipo: 'empresa' | 'particular'
  nombre: string
  nif: string
  email: string
  telefono?: string
  direccion?: string
  cp?: string
  ciudad?: string
  dias_pago: number
  banco?: string       // ✅ NUEVO
  iban?: string        // ✅ NUEVO
  bic_swift?: string
  asesoria_id: string
  asesoria_nombre?: string  // ✅ AÑADIR
}) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new Error("Debes iniciar sesión como asesoría para crear clientes")
    }

    const { data: usuarioAsesoria, error: permisoError } = await supabase
      .from("usuarios_asesoria")
      .select("asesoria_id")
      .eq("user_id", user.id)
      .eq("asesoria_id", formData.asesoria_id)
      .single()

    if (permisoError || !usuarioAsesoria) {
      throw new Error("No tienes permiso para crear clientes en esta asesoría")
    }

    // 0. VALIDAR PRIMERO si ya existe el NIF o el email
    const { data: existingCliente } = await supabaseAdmin
      .from("clientes")
      .select("nif, email")
      .or(`nif.eq.${formData.nif},email.eq.${formData.email}`)
      .single()

    if (existingCliente) {
      if (existingCliente.nif === formData.nif) {
        throw new Error(`Ya existe un cliente con el NIF ${formData.nif}`)
      }
      if (existingCliente.email === formData.email) {
        throw new Error(`Ya existe un cliente con el email ${formData.email}`)
      }
    }

    // 1. Generar contraseña temporal
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8)

    // 2. Crear usuario en auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: formData.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { 
        user_type: "cliente", 
        nombre: formData.nombre 
      },
    })

    if (authError) throw authError
    if (!authData.user) throw new Error("No se pudo crear el usuario")

    // 3. Crear registro en clientes
    const { error: clienteError } = await supabaseAdmin
      .from("clientes")
      .insert({
        asesoria_id: formData.asesoria_id,
        user_id: authData.user.id,
        tipo: formData.tipo,
        nombre: formData.nombre,
        nif: formData.nif,
        email: formData.email,
        telefono: formData.telefono || null,
        direccion: formData.direccion || null,
        cp: formData.cp || null,
        ciudad: formData.ciudad || null,
        dias_pago: formData.dias_pago,
        banco: formData.banco || null,           // ✅ NUEVO
        iban: formData.iban || null,             // ✅ NUEVO
        bic_swift: formData.bic_swift || null,   // ✅ NUEVO
      })

    if (clienteError) {
      // Si falla, eliminar el usuario de auth que acabamos de crear
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw clienteError
    }

    // Enviar email de bienvenida (no bloqueante)
    enviarEmailBienvenida({
      nombreCliente: formData.nombre,
      nombreAsesoria: formData.asesoria_nombre || "Tu Asesoría",
      email: formData.email,
      password: tempPassword,
    }).catch(err => console.error("Error enviando email bienvenida:", err))

    revalidatePath("/asesoria/clientes")
    return { 
      success: true, 
      password: tempPassword,
      email: formData.email 
    }
  } catch (error: any) {
    console.error("Error en registerCliente:", error)
    return { success: false, error: error.message }
  }
}