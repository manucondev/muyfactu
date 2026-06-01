import { createClient } from "@/lib/supabase/server"

export type UserKind = "asesoria" | "cliente"

export type AiFacturaContext = {
  numero: string
  cliente?: string
  fecha: string
  vencimiento?: string
  estadoInterno: string
  estadoVisible: string
  total: number
  totalTexto: string
}

export type AiSolicitudContext = {
  fecha: string
  cliente?: string
  estadoInterno: string
  estadoVisible: string
  motivoRechazo?: string | null
  tieneFactura?: boolean
}

export type AiUserContext = {
  userKind: UserKind
  displayName: string
  contextText: string
  facts: {
    totalClientes?: number
    facturasRecientes: AiFacturaContext[]
    solicitudesRecientes: AiSolicitudContext[]
    totalPendienteCobro: number
    totalPendienteCobroTexto: string
    totalFacturasPendientesCobro?: number
  }
}

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0,00 €"
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value)
}

function formatDate(value: string | null | undefined) {
  if (!value) return "sin fecha"
  try {
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value))
  } catch {
    return value
  }
}

function solicitudEstadoLabel(estado: string | null | undefined) {
  switch (estado) {
    case "pendiente":
      return "Pendiente de revisión"
    case "aprobada":
      return "Aprobada por la asesoría"
    case "rechazada":
      return "Rechazada"
    case "facturada":
      return "Factura emitida"
    default:
      return "Sin estado"
  }
}

function facturaEstadoLabel(estado: string | null | undefined) {
  switch (estado) {
    case "pendiente":
      return "Pendiente de cobro"
    case "cobrada":
      return "Cobrada"
    case "vencida":
      return "Vencida"
    default:
      return "Sin estado"
  }
}

function countByLabel<T>(items: T[], getLabel: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = getLabel(item)
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

function serializeCounts(counts: Record<string, number>) {
  const entries = Object.entries(counts)
  if (!entries.length) return "sin registros"
  return entries.map(([estado, count]) => `${estado}: ${count}`).join(", ")
}

function takeForContext<T>(items: T[] | null | undefined, max = 10) {
  return (items || []).slice(0, max)
}

function getRelatedName(relation: any, fallback = "sin cliente") {
  if (Array.isArray(relation)) return relation[0]?.nombre || fallback
  return relation?.nombre || fallback
}

function mapFactura(f: any, includeCliente: boolean): AiFacturaContext {
  const total = Number(f.total || 0)
  return {
    numero: f.numero_factura || "sin número",
    cliente: includeCliente ? getRelatedName(f.clientes) : undefined,
    fecha: formatDate(f.fecha_emision),
    vencimiento: formatDate(f.fecha_vencimiento),
    estadoInterno: f.estado || "sin estado",
    estadoVisible: facturaEstadoLabel(f.estado),
    total,
    totalTexto: formatCurrency(total),
  }
}

function mapSolicitud(s: any, includeCliente: boolean): AiSolicitudContext {
  return {
    fecha: formatDate(s.created_at),
    cliente: includeCliente ? getRelatedName(s.clientes) : undefined,
    estadoInterno: s.estado || "sin estado",
    estadoVisible: solicitudEstadoLabel(s.estado),
    motivoRechazo: s.motivo_rechazo || null,
    tieneFactura: Boolean(s.factura_id),
  }
}

export async function buildAiContext(): Promise<AiUserContext | null> {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) return null

  const userId = authData.user.id

  const { data: usuarioAsesoria } = await supabase
    .from("usuarios_asesoria")
    .select("id, nombre, email, rol, asesoria_id, asesorias(id, nombre, nif, email, ciudad, provincia)")
    .eq("user_id", userId)
    .maybeSingle()

  if (usuarioAsesoria) {
    const { data: clientes, count: totalClientes } = await supabase
      .from("clientes")
      .select("id, nombre, nif, email, estado, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(10)

    const { data: solicitudes } = await supabase
      .from("solicitudes_factura")
      .select("id, estado, created_at, motivo_rechazo, observaciones_cliente, clientes(nombre, email)")
      .order("created_at", { ascending: false })
      .limit(12)

    const { data: facturas } = await supabase
      .from("facturas")
      .select("id, numero_factura, estado, total, fecha_emision, fecha_vencimiento, clientes(nombre, email)")
      .order("created_at", { ascending: false })
      .limit(12)

    const { data: facturasPendientes, count: totalFacturasPendientesCobro } = await supabase
      .from("facturas")
      .select("id, total", { count: "exact" })
      .eq("estado", "pendiente")

    const clientesList = takeForContext(clientes, 10)
    const solicitudesList = takeForContext(solicitudes, 12)
    const facturasList = takeForContext(facturas, 12)
    const facturasContext = facturasList.map((f: any) => mapFactura(f, true))
    const solicitudesContext = solicitudesList.map((s: any) => mapSolicitud(s, true))
    const totalPendienteCobro = (facturasPendientes || [])
      .reduce((sum: number, f: any) => sum + Number(f.total || 0), 0)

    const contextText = [
      "PERFIL ACTUAL: asesoría.",
      `Usuario de asesoría: ${usuarioAsesoria.nombre || usuarioAsesoria.email}. Rol: ${usuarioAsesoria.rol || "sin rol"}.`,
      `Asesoría: ${(usuarioAsesoria as any).asesorias?.nombre || "sin nombre"}. NIF: ${(usuarioAsesoria as any).asesorias?.nif || "no disponible"}.`,
      "",
      "RESUMEN OPERATIVO DISPONIBLE:",
      `Clientes totales visibles para esta asesoría: ${totalClientes ?? clientesList.length}.`,
      `Clientes recientes cargados en contexto: ${clientesList.length}.`,
      `Solicitudes recientes por estado visible: ${serializeCounts(countByLabel(solicitudesContext, (s) => s.estadoVisible))}.`,
      `Facturas recientes por estado visible: ${serializeCounts(countByLabel(facturasContext, (f) => f.estadoVisible))}.`,
      `Importe pendiente de cobro total visible para esta asesoría: ${formatCurrency(totalPendienteCobro)}.`,
      `Número total de facturas pendientes de cobro: ${totalFacturasPendientesCobro ?? (facturasPendientes || []).length}.`,
      "",
      "CLIENTES RECIENTES:",
      ...clientesList.map((c: any) => `- ${c.nombre} | NIF: ${c.nif || "no disponible"} | email: ${c.email || "no disponible"} | estado: ${c.estado || "sin estado"}`),
      clientesList.length ? "" : "- No hay clientes recientes en el contexto.",
      "SOLICITUDES RECIENTES:",
      ...solicitudesContext.map((s) => `- ${s.fecha} | cliente: ${s.cliente || "sin cliente"} | estado visible: ${s.estadoVisible} | estado interno: ${s.estadoInterno}${s.motivoRechazo ? ` | motivo rechazo: ${s.motivoRechazo}` : ""}`),
      solicitudesContext.length ? "" : "- No hay solicitudes recientes en el contexto.",
      "FACTURAS RECIENTES:",
      ...facturasContext.map((f) => `- ${f.numero} | cliente: ${f.cliente || "sin cliente"} | fecha: ${f.fecha} | estado visible: ${f.estadoVisible} | estado interno: ${f.estadoInterno} | total: ${f.totalTexto}`),
      facturasContext.length ? "" : "- No hay facturas recientes en el contexto.",
    ].join("\n")

    return {
      userKind: "asesoria",
      displayName: usuarioAsesoria.nombre || usuarioAsesoria.email || "Asesoría",
      contextText,
      facts: {
        totalClientes: totalClientes ?? clientesList.length,
        facturasRecientes: facturasContext,
        solicitudesRecientes: solicitudesContext,
        totalPendienteCobro,
        totalPendienteCobroTexto: formatCurrency(totalPendienteCobro),
        totalFacturasPendientesCobro: totalFacturasPendientesCobro ?? (facturasPendientes || []).length,
      },
    }
  }

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, nombre, nif, email, telefono, direccion, cp, ciudad, provincia, banco, iban, bic_swift, estado, asesorias(nombre, nif, email)")
    .eq("user_id", userId)
    .maybeSingle()

  if (cliente) {
    const { data: solicitudes } = await supabase
      .from("solicitudes_factura")
      .select("id, estado, created_at, observaciones_cliente, observaciones_asesoria, motivo_rechazo, factura_id")
      .eq("cliente_id", cliente.id)
      .order("created_at", { ascending: false })
      .limit(12)

    const { data: facturas } = await supabase
      .from("facturas")
      .select("id, numero_factura, estado, total, fecha_emision, fecha_vencimiento, observaciones")
      .eq("cliente_id", cliente.id)
      .order("created_at", { ascending: false })
      .limit(12)

    const { data: facturasPendientes, count: totalFacturasPendientesCobro } = await supabase
      .from("facturas")
      .select("id, total", { count: "exact" })
      .eq("cliente_id", cliente.id)
      .eq("estado", "pendiente")

    const solicitudesList = takeForContext(solicitudes, 12)
    const facturasList = takeForContext(facturas, 12)
    const facturasContext = facturasList.map((f: any) => mapFactura(f, false))
    const solicitudesContext = solicitudesList.map((s: any) => mapSolicitud(s, false))
    const totalPendienteCobro = (facturasPendientes || [])
      .reduce((sum: number, f: any) => sum + Number(f.total || 0), 0)

    const contextText = [
      "PERFIL ACTUAL: cliente.",
      `Cliente: ${cliente.nombre}. NIF: ${cliente.nif}. Email: ${cliente.email}. Estado: ${cliente.estado || "sin estado"}.`,
      `Dirección fiscal: ${[cliente.direccion, cliente.cp, cliente.ciudad, cliente.provincia].filter(Boolean).join(", ") || "no disponible"}.`,
      `Datos bancarios disponibles: ${cliente.iban ? "sí" : "no"}.`,
      `Asesoría asociada: ${(cliente as any).asesorias?.nombre || "no disponible"}.`,
      "",
      "RESUMEN OPERATIVO DISPONIBLE:",
      `Solicitudes recientes por estado visible: ${serializeCounts(countByLabel(solicitudesContext, (s) => s.estadoVisible))}.`,
      `Facturas recientes por estado visible: ${serializeCounts(countByLabel(facturasContext, (f) => f.estadoVisible))}.`,
      `Importe pendiente de cobro total del cliente: ${formatCurrency(totalPendienteCobro)}.`,
      `Número total de facturas pendientes de cobro del cliente: ${totalFacturasPendientesCobro ?? (facturasPendientes || []).length}.`,
      "",
      "SOLICITUDES RECIENTES:",
      ...solicitudesContext.map((s) => `- ${s.fecha} | estado visible: ${s.estadoVisible} | estado interno: ${s.estadoInterno}${s.motivoRechazo ? ` | motivo rechazo: ${s.motivoRechazo}` : ""}${s.tieneFactura ? " | tiene factura asociada" : ""}`),
      solicitudesContext.length ? "" : "- No hay solicitudes recientes en el contexto.",
      "FACTURAS RECIENTES:",
      ...facturasContext.map((f) => `- ${f.numero} | fecha: ${f.fecha} | vencimiento: ${f.vencimiento} | estado visible: ${f.estadoVisible} | estado interno: ${f.estadoInterno} | total: ${f.totalTexto}`),
      facturasContext.length ? "" : "- No hay facturas recientes en el contexto.",
    ].join("\n")

    return {
      userKind: "cliente",
      displayName: cliente.nombre || cliente.email || "Cliente",
      contextText,
      facts: {
        facturasRecientes: facturasContext,
        solicitudesRecientes: solicitudesContext,
        totalPendienteCobro,
        totalPendienteCobroTexto: formatCurrency(totalPendienteCobro),
      },
    }
  }

  return null
}
