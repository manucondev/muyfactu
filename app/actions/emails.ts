"use server"

import { Resend } from "resend"
import { emailBienvenidaCliente, emailFacturaGenerada } from "@/lib/email-templates"

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = "onboarding@resend.dev"

export async function enviarEmailBienvenida(params: {
  nombreCliente: string
  nombreAsesoria: string
  email: string
  password: string
}) {
  try {
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login`
    const { html, text } = emailBienvenidaCliente({ ...params, loginUrl })

    const { error } = await resend.emails.send({
      from: FROM,
      to: params.email,
      subject: `Bienvenido al portal de ${params.nombreAsesoria}`,
      html,
      text,
    })

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error("Error enviando email bienvenida:", error)
    return { success: false, error: error.message }
  }
}

export async function enviarEmailFactura(params: {
  nombreCliente: string
  nombreAsesoria: string
  emailCliente: string
  numeroFactura: string
  total: number
  fechaEmision: string
  fechaVencimiento: string
  pdfUrl: string
}) {
  try {
    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/cliente/facturas`
    const { html, text } = emailFacturaGenerada({ ...params, portalUrl })

    // Descargar el PDF para adjuntarlo
    const pdfResponse = await fetch(params.pdfUrl)
    const pdfBuffer = await pdfResponse.arrayBuffer()

    const { error } = await resend.emails.send({
      from: FROM,
      to: params.emailCliente,
      subject: `Nueva factura ${params.numeroFactura} de ${params.nombreAsesoria}`,
      html,
      text,
      attachments: [
        {
          filename: `${params.numeroFactura}.pdf`,
          content: Buffer.from(pdfBuffer),
        },
      ],
    })

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error("Error enviando email factura:", error)
    return { success: false, error: error.message }
  }
}