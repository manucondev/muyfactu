import { cn } from "@/lib/utils"

const avatarTones = [
  "bg-sky-50 text-sky-700 border-sky-100",
  "bg-violet-50 text-violet-700 border-violet-100",
  "bg-emerald-50 text-emerald-700 border-emerald-100",
  "bg-amber-50 text-amber-700 border-amber-100",
  "bg-rose-50 text-rose-700 border-rose-100",
  "bg-cyan-50 text-cyan-700 border-cyan-100",
  "bg-indigo-50 text-indigo-700 border-indigo-100",
  "bg-lime-50 text-lime-700 border-lime-100",
]

function getInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return "—"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}

function getTone(value: string): string {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash)
  }
  return avatarTones[Math.abs(hash) % avatarTones.length]
}

export function ClientAvatar({
  name,
  className,
}: {
  name?: string | null
  className?: string
}) {
  const safeName = name?.trim() || "Sin nombre"

  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold uppercase tracking-wide shadow-sm",
        getTone(safeName),
        className,
      )}
      title={safeName}
      aria-label={safeName}
    >
      {getInitials(safeName)}
    </div>
  )
}
