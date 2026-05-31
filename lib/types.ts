export type UserType = "asesoria" | "cliente"

export interface Asesoria {
  id: string
  nombre: string
  nif: string
  email: string
  telefono: string | null
  direccion: string | null
  ciudad: string | null
  logo_url: string | null
  created_at: string
}

export interface UsuarioAsesoria {
  id: string
  user_id: string
  asesoria_id: string
  nombre: string
  email: string
  created_at: string
}

export interface Cliente {
  id: string
  asesoria_id: string
  user_id: string | null
  tipo: "empresa" | "particular"
  nombre: string
  nif: string
  email: string
  telefono: string | null
  direccion: string | null
  cp: string | null
  ciudad: string | null
  provincia: string | null
  dias_pago: number
  banco: string | null  // ✅ NUEVO
  iban: string | null   // ✅ NUEVO
  bic_swift: string | null  // ✅ NUEVO
  estado: "activo" | "inactivo"
  created_at: string
}

export interface Concepto {
  concepto: string
  cantidad: number
  precio: number
  iva: number
  total: number
}

export interface SolicitudFactura {
  id: string
  cliente_id: string
  asesoria_id: string
  conceptos: Concepto[]
  observaciones: string | null
  adjuntos: string[] | null
  estado: "pendiente" | "aprobada" | "rechazada" | "facturada"
  motivo_rechazo: string | null
  factura_id: string | null
  created_at: string
  cliente?: Cliente
}

export interface Factura {
  id: string
  asesoria_id: string
  cliente_id: string
  solicitud_id: string | null
  numero_factura: string  // ✅ Añadir esta
  serie: string
  numero: number  // ✅ Añadir esta si no está
  fecha_emision: string
  fecha_vencimiento: string
  base_imponible: number
  iva_total: number
  retencion_irpf: number  // ✅ Añadir esta
  total: number
  estado: string
  fecha_cobro: string | null
  pdf_url: string | null
  xml_url: string | null
  hash_sha256: string | null
  hash_anterior: string | null
  datos_hash: Record<string, unknown> | null
  fecha_registro: string | null
  qr_data: string | null
  observaciones: string | null
  created_at: string
  created_by: string | null
}

export interface LineaFactura {
  id: string
  factura_id: string
  concepto: string
  cantidad: number
  precio_unitario: number
  iva_porcentaje: number
  subtotal: number
  iva_importe: number
  total: number
}

export interface Notificacion {
  id: string
  destinatario_id: string
  tipo_destinatario: string | null
  tipo: string
  titulo: string
  mensaje: string
  link: string | null      // ✅ era enlace
  leida: boolean
  created_at: string
}

export interface CertificadoDigital {
  id: string
  asesoria_id: string
  nombre_archivo: string
  estado: "activo" | "caducado" | "sin_certificado"
  fecha_subida: string | null
}

export interface ConfiguracionPlantilla {
  id: string
  asesoria_id: string
  estilo: "clasico" | "moderno" | "corporativo"
  color_primario: string
  footer_texto: string | null
}
