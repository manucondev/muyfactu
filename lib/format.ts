import { formatDistanceToNow, format } from "date-fns"
import { es } from "date-fns/locale"

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), "dd/MM/yyyy", { locale: es })
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: es })
}

export function timeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es })
}

export function calcConceptoTotal(cantidad: number, precio: number, iva: number): number {
  const base = cantidad * precio
  return base + base * (iva / 100)
}

export function calcImporte(conceptos: { cantidad: number; precio: number }[]): number {
  return conceptos.reduce((sum, c) => sum + c.cantidad * c.precio, 0)
}

export function getEstadoBadgeVariant(estado: string): "default" | "secondary" | "destructive" | "outline" {
  switch (estado) {
    case "cobrada":
    case "aprobada":
    case "activo":
    case "facturada":
      return "default"
    case "pendiente":
      return "secondary"
    case "rechazada":
    case "vencida":
    case "inactivo":
      return "destructive"
    default:
      return "outline"
  }
}

export function getEstadoColor(estado: string): string {
  switch (estado) {
    case "cobrada":
      return "bg-emerald-100 text-emerald-800"
    case "aprobada":
      return "bg-blue-100 text-blue-800"
    case "facturada":
      return "bg-indigo-100 text-indigo-800"
    case "pendiente":
      return "bg-amber-100 text-amber-800"
    case "rechazada":
      return "bg-red-100 text-red-800"
    case "vencida":
      return "bg-red-100 text-red-800"
    case "activo":
      return "bg-emerald-100 text-emerald-800"
    case "inactivo":
      return "bg-gray-100 text-gray-600"
    default:
      return "bg-gray-100 text-gray-600"
  }
}
