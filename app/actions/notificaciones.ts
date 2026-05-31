"use server"

import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function notificarAsesoriaAction(params: {
  asesoria_id: string
  tipo: string
  titulo: string
  mensaje: string
  link: string
}) {
  try {
    // Buscar user_id de la asesoría (con service role, sin RLS)
    const { data: uaData } = await supabaseAdmin
      .from("usuarios_asesoria")
      .select("user_id")
      .eq("asesoria_id", params.asesoria_id)
      .limit(1)
      .maybeSingle()

    if (!uaData) return { success: false, error: "Asesoría no encontrada" }

    const { error } = await supabaseAdmin.from("notificaciones").insert({
      destinatario_id: uaData.user_id,
      tipo_destinatario: "asesoria",
      tipo: params.tipo,
      titulo: params.titulo,
      mensaje: params.mensaje,
      link: params.link,
      leida: false,
    })

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error("Error enviando notificación:", error)
    return { success: false, error: error.message }
  }
}

export async function notificarClienteAction(params: {
  cliente_user_id: string
  tipo: string
  titulo: string
  mensaje: string
  link: string
}) {
  try {
    const { error } = await supabaseAdmin.from("notificaciones").insert({
      destinatario_id: params.cliente_user_id,
      tipo_destinatario: "cliente",
      tipo: params.tipo,
      titulo: params.titulo,
      mensaje: params.mensaje,
      link: params.link,
      leida: false,
    })

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error("Error enviando notificación:", error)
    return { success: false, error: error.message }
  }
}