"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { Loader2, RotateCcw, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type AiMessage = {
  role: "user" | "assistant"
  content: string
}

type AiAssistantProps = {
  userType: "asesoria" | "cliente"
}

const suggestionsByType = {
  asesoria: [
    "Solicitudes pendientes de revisión",
    "Resume las 5 últimas facturas",
    "¿Cómo marco una factura como cobrada?",
    "¿Cómo genero una factura desde una solicitud aprobada?",
  ],
  cliente: [
    "Estado de mis últimas solicitudes",
    "Resume mis últimas facturas",
    "¿Cómo solicito una nueva factura?",
    "¿Dónde cambio mis datos fiscales?",
  ],
}

function cleanAssistantAnswer(answer: string) {
  return answer
    .replace(/\*\*/g, "")
    .replace(/^\s*\*\s+/gm, "• ")
    .replace(/^\s*\d+\.\s{2,}/gm, (match) => match.replace(/\s{2,}/g, " "))
    .replace(/\s*\|\s*/g, " — ")
    .replace(/\bcliente:\s*/gi, "")
    .replace(/\bestado visible:\s*/gi, "")
    .replace(/\bestado:\s*/gi, "")
    .replace(/\btotal:\s*/gi, "")
    .replace(/\bfecha:\s*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function AiAssistant({ userType }: AiAssistantProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [storageReady, setStorageReady] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const storageKey = useMemo(() => `muyfactu:asesoria-ia:${userType}`, [userType])

  const welcomeMessage = useMemo(() => {
    if (userType === "asesoria") {
      return "Hola, soy AsesorIA. Puedo ayudarte a revisar solicitudes, resumir facturas y orientarte por MuyFactu."
    }
    return "Hola, soy AsesorIA. Puedo ayudarte a consultar tus solicitudes, revisar tus facturas y orientarte por MuyFactu."
  }, [userType])

  useEffect(() => {
    try {
      const savedState = window.localStorage.getItem(storageKey)
      if (savedState) {
        const parsed = JSON.parse(savedState)
        if (typeof parsed?.open === "boolean") setOpen(parsed.open)
        if (Array.isArray(parsed?.messages)) {
          setMessages(
            parsed.messages.filter(
              (message: AiMessage) =>
                message &&
                (message.role === "user" || message.role === "assistant") &&
                typeof message.content === "string"
            )
          )
        }
      }
    } catch {
      // Si el navegador no permite localStorage o el contenido está corrupto, se inicia limpio.
    } finally {
      setStorageReady(true)
    }
  }, [storageKey])

  useEffect(() => {
    if (!storageReady) return
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          open,
          messages: messages.slice(-20),
        })
      )
    } catch {
      // Persistencia opcional: la app debe seguir funcionando aunque falle localStorage.
    }
  }, [messages, open, storageKey, storageReady])

  useEffect(() => {
    if (!open) return
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, loading, open])

  async function sendMessage(customText?: string) {
    const text = (customText || input).trim()
    if (!text || loading) return

    const nextMessages: AiMessage[] = [...messages, { role: "user", content: text }]
    setMessages(nextMessages)
    setInput("")
    setError(null)
    setLoading(true)

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "No se ha podido contactar con AsesorIA.")
      }

      setMessages([...nextMessages, { role: "assistant", content: cleanAssistantAnswer(data.answer) }])
    } catch (err: any) {
      setError(err?.message || "No se ha podido generar la respuesta.")
      setMessages(nextMessages)
    } finally {
      setLoading(false)
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  function resetConversation() {
    setMessages([])
    setError(null)
    setInput("")
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  if (!open) {
    return (
      <Button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir AsesorIA"
        title="Abrir AsesorIA"
        className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full p-0 text-sm font-semibold tracking-tight shadow-lg"
      >
        IA
      </Button>
    )
  }

  return (
    <aside className="fixed inset-x-3 bottom-3 z-40 flex h-[78vh] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-20 sm:h-auto sm:w-[410px]">
      <header className="flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border bg-muted text-xs font-semibold text-muted-foreground">
            IA
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">AsesorIA</p>
            <p className="text-xs text-muted-foreground">Asistente de MuyFactu</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={resetConversation}
            title="Nueva conversación"
            className="h-8 w-8 text-muted-foreground"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            title="Cerrar AsesorIA"
            className="h-8 w-8 text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto bg-muted/25 px-4 py-4">
        <div className="rounded-2xl border bg-background px-4 py-3 text-sm leading-relaxed text-muted-foreground shadow-sm">
          {welcomeMessage}
        </div>

        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Consultas rápidas</p>
            <div className="grid gap-2">
              {suggestionsByType[userType].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => sendMessage(suggestion)}
                  className="rounded-xl border bg-background px-3 py-2 text-left text-xs text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "border bg-background text-foreground"
              )}
            >
              {message.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border bg-background px-4 py-3 text-sm text-muted-foreground shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Pensando...
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form
        className="border-t bg-background p-4"
        onSubmit={(event) => {
          event.preventDefault()
          sendMessage()
        }}
      >
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pregúntame sobre MuyFactu..."
            className="min-h-[44px] max-h-32 resize-none rounded-xl"
            disabled={loading}
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()} className="h-11 w-11 shrink-0 rounded-xl">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          Verifica siempre en MuyFactu los datos importantes antes de tomar decisiones.
        </p>
      </form>
    </aside>
  )
}
