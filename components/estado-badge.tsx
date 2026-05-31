import { getEstadoColor } from "@/lib/format"
import { cn } from "@/lib/utils"

export function EstadoBadge({ estado, className }: { estado: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", getEstadoColor(estado), className)}>
      {estado}
    </span>
  )
}
