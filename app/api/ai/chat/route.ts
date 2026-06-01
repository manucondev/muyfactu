import { NextResponse } from "next/server"
import { buildAiContext, type AiFacturaContext, type AiSolicitudContext, type AiUserContext } from "@/lib/ai/context"

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

function normalizeMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) return []

  const normalized = messages
    .filter((message: any) =>
      message &&
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.trim().length > 0
    )
    .slice(-8)
    .map((message: any) => ({
      role: message.role,
      content: message.content.slice(0, 2500),
    }))

  // Evita que un doble clic o un reenvío accidental meta dos preguntas iguales seguidas.
  return normalized.filter((message, index, list) => {
    if (index === 0) return true
    const previous = list[index - 1]
    return !(message.role === previous.role && message.content.trim() === previous.content.trim())
  })
}

function simplify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function formatFacturas(facturas: AiFacturaContext[], userKind: "asesoria" | "cliente", count = 5) {
  const selected = facturas.slice(0, count)
  if (!selected.length) return "No tengo facturas recientes disponibles en tu contexto actual."

  const lines = selected.map((f) => {
    if (userKind === "asesoria") {
      return `• ${f.numero} — ${f.cliente || "sin cliente"} — ${f.fecha} — ${f.estadoVisible} — ${f.totalTexto}`
    }
    return `• ${f.numero} — ${f.fecha} — ${f.estadoVisible} — ${f.totalTexto}`
  })

  const more = facturas.length > selected.length ? "\n\nHay más registros cargados; puedes pedirme que los detalle." : ""
  return `Aquí tienes tus últimas ${selected.length} facturas:\n${lines.join("\n")}${more}`
}

function formatSolicitudes(solicitudes: AiSolicitudContext[], userKind: "asesoria" | "cliente", onlyPending = false) {
  const source = onlyPending
    ? solicitudes.filter((s) => s.estadoInterno === "pendiente")
    : solicitudes
  const selected = source.slice(0, 5)

  if (!selected.length) {
    return onlyPending
      ? "No tienes solicitudes pendientes de revisión en el contexto actual."
      : "No tengo solicitudes recientes disponibles en tu contexto actual."
  }

  if (onlyPending) {
    const lines = selected.map((s) => {
      if (userKind === "asesoria") return `• ${s.fecha} — ${s.cliente || "sin cliente"}`
      return `• ${s.fecha}`
    })
    return `Tienes ${source.length} solicitud${source.length === 1 ? "" : "es"} pendiente${source.length === 1 ? "" : "s"} de revisión:\n${lines.join("\n")}`
  }

  const lines = selected.map((s) => {
    const parts = userKind === "asesoria"
      ? [s.fecha, s.cliente || "sin cliente", s.estadoVisible]
      : [s.fecha, s.estadoVisible]
    return `• ${parts.join(" — ")}`
  })
  const more = source.length > selected.length ? "\n\nHay más registros cargados; puedes pedirme que los detalle." : ""
  return `Aquí tienes el estado de tus últimas ${selected.length} solicitudes:\n${lines.join("\n")}${more}`
}

function localAnswer(aiContext: AiUserContext, latestUserMessage: string): string | null {
  const q = simplify(latestUserMessage)
  const { userKind, facts } = aiContext

  if (q.includes("quien es tu creador") || q.includes("quien te creo") || q.includes("quien te ha creado")) {
    return "Soy AsesorIA, el asistente integrado de MuyFactu. La integración del asistente forma parte de este proyecto y usa un proveedor de IA configurado por la aplicación."
  }

  if (q.includes("dueno") && (q.includes("api") || q.includes("cuenta") || q.includes("clave"))) {
    return "No tengo acceso a información sobre la titularidad, facturación o configuración privada de la clave API. Mi alcance se limita a ayudarte dentro de MuyFactu con los datos disponibles en tu sesión."
  }

  if (q.includes("como te llamas") || q === "tu nombre" || q.includes("cual es tu nombre")) {
    return "Me llamo AsesorIA, el asistente integrado de MuyFactu."
  }

  if (q.includes("marcar") && q.includes("cobrada")) {
    if (userKind === "cliente") {
      return "No. Como cliente solo puedes ver el estado de tus facturas. La asesoría es quien confirma el cobro desde Facturación."
    }
    return "Entra en Facturación, localiza la factura, pulsa Marcar como cobrada y confirma la acción. Esto solo cambia el estado administrativo de cobro; no modifica los datos fiscales ni la trazabilidad de la factura."
  }

  if ((q.includes("datos fiscales") || q.includes("cambiar mis datos") || q.includes("editar mis datos")) && userKind === "cliente") {
    return "Puedes cambiar tus datos fiscales desde Mi perfil. Ahí puedes revisar y actualizar tus datos de cliente antes de enviar nuevas solicitudes."
  }

  if (q.includes("generar") && q.includes("factura")) {
    if (userKind === "cliente") {
      return "Como cliente no generas la factura directamente. Debes crear una solicitud; después la asesoría la revisa, la aprueba y genera la factura."
    }
    return "Para generar una factura, entra en Solicitudes, abre una solicitud aprobada y pulsa Generar factura. MuyFactu creará la factura, el PDF y el registro técnico asociado."
  }

  if (q.includes("aeat") || q.includes("agencia tributaria") || q.includes("verifactu")) {
    return "MuyFactu prepara la trazabilidad interna con numeración, PDF, hash SHA-256 y encadenamiento. El envío real a la AEAT no está implementado en esta versión y queda como línea futura del proyecto."
  }

  if ((q.includes("cambia") || q.includes("modifica") || q.includes("editar")) && (q.includes("total") || q.includes("importe") || q.includes("factura"))) {
    return "No puedo modificar facturas emitidas. Además, MuyFactu protege los datos fiscales y de trazabilidad de las facturas ya emitidas para evitar cambios posteriores."
  }

  if (q.includes("aprobar") && q.includes("solicitud")) {
    return "No puedo aprobar solicitudes por ti. La asesoría debe revisarlas desde Solicitudes y aprobarlas manualmente desde la interfaz."
  }

  if (q.includes("ultimas facturas") || q.includes("ultimas 5 facturas") || q.includes("facturas recientes") || q.includes("mis facturas")) {
    return formatFacturas(facts.facturasRecientes, userKind, 5)
  }

  if (q.includes("ultimas solicitudes") || q.includes("estado de mis solicitudes") || q.includes("estado de mis ultimas solicitudes")) {
    return formatSolicitudes(facts.solicitudesRecientes, userKind, false)
  }

  if (q.includes("pendientes de revision") || (q.includes("solicitudes") && q.includes("pendiente"))) {
    return formatSolicitudes(facts.solicitudesRecientes, userKind, true)
  }

  if (q.includes("pendiente de cobro") || (q.includes("cuanto") && q.includes("pendiente")) || (q.includes("importe") && q.includes("pendiente"))) {
    const totalPendientes = facts.totalFacturasPendientesCobro
    const detalle = typeof totalPendientes === "number"
      ? ` (${totalPendientes} factura${totalPendientes === 1 ? "" : "s"} pendiente${totalPendientes === 1 ? "" : "s"})`
      : ""
    return `El importe pendiente de cobro es ${facts.totalPendienteCobroTexto}${detalle}.`
  }

  if (q.includes("clientes tiene") || q.includes("cuantos clientes") || q.includes("numero de clientes")) {
    if (userKind === "cliente") {
      return "No puedo mostrarte cuántos clientes tiene la asesoría. Como cliente, solo puedo ayudarte con tus propias solicitudes, facturas y datos de perfil."
    }
    return `Tu asesoría tiene ${facts.totalClientes ?? 0} cliente${facts.totalClientes === 1 ? "" : "s"} visible${facts.totalClientes === 1 ? "" : "s"} en MuyFactu.`
  }

  if (q.includes("todas las facturas") && q.includes("asesoria") && userKind === "cliente") {
    return "No puedo mostrarte todas las facturas de la asesoría. Como cliente, solo tengo acceso a tus propias facturas."
  }

  if (q.includes("factura") && q.includes("pendiente")) {
    return "Una factura Pendiente de cobro ya está emitida, pero el pago todavía no se ha registrado como cobrado. No significa que la solicitud esté pendiente de revisión."
  }

  if (q.includes("solicitud") && q.includes("pendiente")) {
    return "Una solicitud Pendiente de revisión es una petición enviada por el cliente que aún debe revisar la asesoría. Cuando se aprueba, la asesoría ya puede generar la factura."
  }

  return null
}

function stripEcho(answer: string, latestUserMessage: string) {
  const trimmedAnswer = answer.trim()
  const trimmedQuestion = latestUserMessage.trim()
  if (!trimmedQuestion) return trimmedAnswer

  if (trimmedAnswer.toLowerCase().startsWith(trimmedQuestion.toLowerCase())) {
    return trimmedAnswer.slice(trimmedQuestion.length).replace(/^[:\s\-–—]+/, "").trim()
  }

  return trimmedAnswer
}

function buildSystemInstruction(contextText: string) {
  return `Eres AsesorIA, el asistente integrado de MuyFactu.

Tu función es ayudar al usuario autenticado a usar la aplicación y a interpretar únicamente los datos disponibles en el contexto seguro.

ESTILO DE RESPUESTA OBLIGATORIO:
- Responde siempre en español.
- No repitas la pregunta del usuario al principio de la respuesta.
- Sé directo, concreto y útil. Evita respuestas genéricas.
- No uses Markdown complejo: no uses **negritas**, tablas ni listas largas con asteriscos. Usa frases cortas o viñetas con "•".
- Por defecto, muestra como máximo 5 registros. Si hay más, termina con una frase tipo: "Hay más registros cargados; puedes pedirme que los detalle".
- No repitas avisos largos en cada respuesta. No digas “yo no puedo realizar esta acción” salvo que el usuario te pida explícitamente que la ejecutes por él.
- Usa los textos visibles de MuyFactu, no los estados internos de base de datos.
- Evita etiquetas técnicas innecesarias como “cliente:”, “estado:” o “total:” cuando puedas escribir una línea más natural.
- Usa formato visual compacto: “• A-0026 — Empresa 2 — 01/06/2026 — Pendiente de cobro — 49,61 €”.
- En solicitudes pendientes de revisión, no repitas “estado: Pendiente de revisión” en cada línea si ya has indicado que son pendientes.

MAPEO DE ESTADOS:
- Solicitud estado "pendiente" = "Pendiente de revisión".
- Solicitud estado "aprobada" = "Aprobada por la asesoría".
- Solicitud estado "rechazada" = "Rechazada".
- Solicitud estado "facturada" = "Factura emitida".
- Factura estado "pendiente" = "Pendiente de cobro".
- Factura estado "cobrada" = "Cobrada".
- Factura estado "vencida" = "Vencida".

REGLAS DE SEGURIDAD Y ALCANCE:
- Usa solo el contexto proporcionado. Si el dato no aparece, di que no lo tienes disponible en el contexto actual.
- No inventes clientes, facturas, importes, estados ni normativa.
- No puedes modificar datos, crear facturas, aprobar solicitudes, rechazar solicitudes ni marcar facturas como cobradas.
- No des asesoramiento fiscal/legal definitivo. Puedes explicar el funcionamiento de MuyFactu y conceptos generales del prototipo.
- Diferencia siempre entre solicitud de factura y factura emitida.
- Si preguntan por la cuenta, clave API o configuración privada del proveedor de IA, indica que no tienes acceso a esa información.

FORMATO RECOMENDADO PARA CASOS FRECUENTES:
- Si preguntan por últimas facturas: responde con máximo 5 líneas, usando este patrón: “• Nº factura — Cliente — Fecha — Estado visible — Importe”.
- Si preguntan por solicitudes pendientes: empieza con “Tienes X solicitud(es) pendiente(s) de revisión” y lista fecha y cliente. No añadas el estado en cada línea salvo que haya estados mezclados.
- Si preguntan cómo marcar una factura como cobrada: responde exactamente de forma breve: “Entra en Facturación, localiza la factura, pulsa Marcar como cobrada y confirma la acción. Esta acción la realiza la asesoría; el cliente solo ve el estado de la factura.”

GUÍA DE USO DE MUYFACTU:
- Para marcar una factura como cobrada: la asesoría debe entrar en "Facturación", localizar la factura, pulsar "Marcar como cobrada" y confirmar la acción. El cliente no debe marcar facturas como cobradas.
- Para generar una factura: la asesoría debe entrar en "Solicitudes", abrir una solicitud aprobada y pulsar "Generar factura".
- Para revisar solicitudes pendientes: la asesoría debe entrar en "Solicitudes" y filtrar o revisar las que aparezcan como "Pendiente de revisión".
- Para crear una solicitud: el cliente debe entrar en su panel, ir a nueva solicitud, añadir conceptos y enviar la solicitud.
- Para cambiar datos fiscales: el cliente debe entrar en "Mi perfil" y actualizar sus datos.
- Una factura "Pendiente de cobro" ya está emitida; no significa que la solicitud esté pendiente de revisión.

Contexto seguro del usuario actual:
${contextText}`
}

async function callGemini(systemInstruction: string, messages: ChatMessage[]) {
  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash"

  if (!apiKey) {
    throw new Error("Falta configurar GEMINI_API_KEY en las variables de entorno.")
  }

  const contents = messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }))

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents,
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 350,
        },
      }),
    }
  )

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Se ha alcanzado el límite temporal o diario de la API de Gemini. Espera un poco antes de volver a intentarlo, o usa las consultas rápidas que MuyFactu puede resolver sin consumir IA.")
    }

    const errorText = await response.text()
    throw new Error(`Gemini ha devuelto un error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part: any) => part?.text || "")
    .join("\n")
    .trim()

  if (!text) {
    throw new Error("Gemini no ha devuelto una respuesta de texto.")
  }

  return text
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const messages = normalizeMessages(body.messages)

    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return NextResponse.json({ error: "Envía al menos un mensaje de usuario." }, { status: 400 })
    }

    const aiContext = await buildAiContext()

    if (!aiContext) {
      return NextResponse.json({ error: "No se ha podido identificar al usuario autenticado." }, { status: 401 })
    }

    const latestUserMessage = messages[messages.length - 1].content
    const deterministicAnswer = localAnswer(aiContext, latestUserMessage)

    if (deterministicAnswer) {
      return NextResponse.json({
        answer: deterministicAnswer,
        userKind: aiContext.userKind,
        displayName: aiContext.displayName,
        source: "local",
      })
    }

    const systemInstruction = buildSystemInstruction(aiContext.contextText)
    const answer = stripEcho(await callGemini(systemInstruction, messages), latestUserMessage)

    return NextResponse.json({
      answer,
      userKind: aiContext.userKind,
      displayName: aiContext.displayName,
      source: "gemini",
    })
  } catch (error: any) {
    console.error("[AsesorIA]", error)
    return NextResponse.json(
      { error: error?.message || "No se ha podido generar la respuesta del asistente." },
      { status: 500 }
    )
  }
}
