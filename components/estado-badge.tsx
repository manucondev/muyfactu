import { getEstadoColor } from "@/lib/format"
import { cn } from "@/lib/utils"

type EstadoBadgeTipo = "solicitud" | "factura" | "generico"

export function getEstadoLabel(estado: string, tipo: EstadoBadgeTipo = "generico") {
  if (tipo === "solicitud") {
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
        return estado
    }
  }

  if (tipo === "factura") {
    switch (estado) {
      case "pendiente":
        return "Pendiente de cobro"
      case "cobrada":
        return "Cobrada"
      case "vencida":
        return "Vencida"
      case "anulada":
        return "Anulada"
      default:
        return estado
    }
  }

  return estado.charAt(0).toUpperCase() + estado.slice(1)
}

export function EstadoBadge({
  estado,
  tipo = "generico",
  className,
}: {
  estado: string
  tipo?: EstadoBadgeTipo
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", getEstadoColor(estado), className)}>
      {getEstadoLabel(estado, tipo)}
    </span>
  )
}
