export type UserType = "asesoria" | "cliente"

export interface Asesoria {
  id: string
  nombre: string
  nif: string
  email: string
  telefono: string | null
  direccion: string | null
  ciudad: string | null
  provincia: string | null
  logo_url: string | null
  certificado_url: string | null
  certificado_password_encrypted: string | null
  estado: string | null
  created_at: string
  updated_at: string | null
}

export interface UsuarioAsesoria {
  id: string
  user_id: string
  asesoria_id: string
  nombre: string
  email: string
  rol: string | null
  ultimo_acceso: string | null
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
  banco: string | null
  iban: string | null
  bic_swift: string | null
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
  asesoria_id?: string
  conceptos: Concepto[]
  observaciones_cliente: string | null
  observaciones_asesoria: string | null
  adjuntos: string[] | null
  estado: "pendiente" | "aprobada" | "rechazada" | "facturada"
  motivo_rechazo: string | null
  factura_id: string | null
  fecha_revision: string | null
  fecha_aprobacion: string | null
  created_at: string
  cliente?: Cliente
}

export interface Factura {
  id: string
  asesoria_id: string
  cliente_id: string
  solicitud_id: string | null
  numero_factura: string
  serie: string
  numero: number
  fecha_emision: string
  fecha_vencimiento: string
  base_imponible: number
  iva_total: number
  retencion_irpf: number
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
  registro_version: string | null
}

export interface LineaFactura {
  id: string
  factura_id: string
  orden: number
  concepto: string
  cantidad: number
  precio_unitario: number
  porcentaje_iva: number
  importe_linea: number
}

export interface Notificacion {
  id: string
  destinatario_id: string
  tipo_destinatario: string
  tipo: string
  titulo: string
  mensaje: string
  link: string | null
  leida: boolean
  created_at: string
}


export interface ConfiguracionPlantilla {
  id: string
  asesoria_id: string
  estilo: "clasico" | "moderno" | "corporativo"
  color_primario: string
  footer_texto: string | null
}
