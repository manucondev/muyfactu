import jsPDF from "jspdf"
import QRCode from "qrcode"

export interface FacturaData {
  numero_factura: string
  fecha_emision: string
  fecha_vencimiento: string
  qr_data: string
  observaciones: string | null
  base_imponible: number
  iva_total: number
  retencion_irpf: number
  total: number
  asesoria: {
    nombre: string
    nif: string
    email: string
    telefono: string
    direccion: string
    ciudad: string
    logo_url: string | null
  }
  cliente: {
    nombre: string
    nif: string
    email: string
    telefono: string
    direccion: string
    cp: string
    ciudad: string
    banco: string | null
    iban: string | null
    bic_swift: string | null
  }
  lineas: Array<{
    concepto: string
    cantidad: number
    precio_unitario: number
    porcentaje_iva: number
    importe_linea: number
  }>
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(amount)
}

const resolveLogoUrl = (logoUrl: string | null): string | null => {
  if (!logoUrl) return null
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return logoUrl

  return `${supabaseUrl}/storage/v1/object/public/logos/${logoUrl.replace(/^\/+/, "")}`
}

export async function generateFacturaPDF(data: FacturaData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  const pageWidth = 210
  const pageHeight = 297
  const margin = 20
  const contentWidth = pageWidth - 2 * margin

  // COLORES
  const primary = "#4F46E5"      // Indigo
  const primaryLight = "#EEF2FF" // Indigo 50
  const gray800 = "#1F2937"
  const gray600 = "#4B5563"
  const gray400 = "#9CA3AF"
  const gray100 = "#F3F4F6"

  let yPos = margin

  // ==================== HEADER ====================

  // Intentar cargar logo real
  const logoUrl = resolveLogoUrl(data.asesoria.logo_url)
  if (logoUrl) {
    try {
      doc.addImage(logoUrl, "PNG", margin, yPos, 16, 16)
    } catch {
      // Si falla, usar placeholder existente
    }
  } else {
    // Logo placeholder (si no hay logo_url)
    doc.setFillColor(primary)
    doc.circle(margin + 8, yPos + 8, 8, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    const initials = data.asesoria.nombre.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase()
    doc.text(initials, margin + 8, yPos + 10.5, { align: "center" })
  }

  // Datos asesoría (pequeño, a la derecha del logo)
  doc.setTextColor(gray800)
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text(data.asesoria.nombre, margin + 20, yPos + 5)
  
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(gray600)
  doc.text(`NIF: ${data.asesoria.nif}`, margin + 20, yPos + 9)
  doc.text(`${data.asesoria.direccion}, ${data.asesoria.ciudad}`, margin + 20, yPos + 13)
  doc.text(`${data.asesoria.email} • ${data.asesoria.telefono}`, margin + 20, yPos + 17)

  yPos += 30

  // ==================== FACTURA INFO ====================
  // Badge "FACTURA" con número completo
  const badgeText = `FACTURA ${data.numero_factura}`
  const badgeWidth = doc.getTextWidth(badgeText) + 10
  doc.setFillColor(primary)
  doc.roundedRect(margin, yPos, badgeWidth, 9, 2, 2, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text(badgeText, margin + badgeWidth / 2, yPos + 6, { align: "center" })

  yPos += 13

  // Fechas en badges
  doc.setFillColor(gray100)
  doc.roundedRect(margin, yPos, 60, 7, 1.5, 1.5, "F")
  doc.setTextColor(gray600)
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.text("Fecha emisión:", margin + 2, yPos + 4.5)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(gray800)
  doc.text(formatDate(data.fecha_emision), margin + 23, yPos + 4.5)

  doc.setFillColor(gray100)
  doc.roundedRect(margin + 65, yPos, 60, 7, 1.5, 1.5, "F")
  doc.setTextColor(gray600)
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.text("Vencimiento:", margin + 67, yPos + 4.5)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(gray800)
  doc.text(formatDate(data.fecha_vencimiento), margin + 90, yPos + 4.5)

  yPos += 15

  // ==================== CLIENTE ====================
  // Título sección
  doc.setTextColor(gray600)
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.text("FACTURADO A", margin, yPos)
  yPos += 6

  // Recuadro cliente
  const clientBoxHeight = data.cliente.banco ? 35 : 29
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.5)
  doc.setFillColor(primaryLight)
  doc.roundedRect(margin, yPos, contentWidth, clientBoxHeight, 2, 2, "FD")

  yPos += 5

  // Nombre destacado
  doc.setTextColor(gray800)
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text(data.cliente.nombre, margin + 4, yPos)

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(gray600)
  doc.text(`NIF: ${data.cliente.nif}`, pageWidth - margin - 4, yPos, { align: "right" })

  yPos += 6

  // Grid de datos
  doc.setFontSize(8.5)
  const col1 = margin + 4
  const col2 = margin + contentWidth / 2 + 2

  doc.text(data.cliente.direccion, col1, yPos)
  doc.text(data.cliente.email, col2, yPos)
  yPos += 5

  doc.text(`${data.cliente.cp}, ${data.cliente.ciudad}`, col1, yPos)
  doc.text(data.cliente.telefono, col2, yPos)
  yPos += 5

  // Datos bancarios si existen
  if (data.cliente.banco) {
    yPos += 2
    doc.setTextColor(gray800)
    doc.setFont("helvetica", "bold")
    doc.text("Datos bancarios:", col1, yPos)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(gray600)
    doc.text(data.cliente.banco, col1 + 25, yPos)
    yPos += 5
    doc.setFont("helvetica", "normal")
    doc.text(`IBAN: ${data.cliente.iban || "—"}`, col1, yPos)
    if (data.cliente.bic_swift) {
      doc.text(`BIC/SWIFT: ${data.cliente.bic_swift}`, col2, yPos)
    }
  }

  yPos += 12

  // ==================== TABLA CONCEPTOS ====================
  doc.setTextColor(gray600)
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.text("CONCEPTOS Y SERVICIOS", margin, yPos)
  yPos += 6

  // Cabecera tabla
  doc.setFillColor(gray800)
  doc.rect(margin, yPos, contentWidth, 8, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")

  const colConcepto = margin + 3
  const colCant = pageWidth - margin - 75
  const colPrecio = pageWidth - margin - 55
  const colIVA = pageWidth - margin - 35
  const colTotal = pageWidth - margin - 3

  doc.text("CONCEPTO", colConcepto, yPos + 5.5)
  doc.text("CANT.", colCant, yPos + 5.5, { align: "right" })
  doc.text("PRECIO", colPrecio, yPos + 5.5, { align: "right" })
  doc.text("IVA %", colIVA, yPos + 5.5, { align: "right" })
  doc.text("TOTAL", colTotal, yPos + 5.5, { align: "right" })

  yPos += 8

  // Líneas
  doc.setTextColor(gray800)
  doc.setFontSize(8.5)
  doc.setFont("helvetica", "normal")

  data.lineas.forEach((linea, i) => {
    // Alternar fondo
    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 250)
      doc.rect(margin, yPos, contentWidth, 7, "F")
    }

    const conceptoLines = doc.splitTextToSize(linea.concepto, 75)
    const lineHeight = Math.max(7, conceptoLines.length * 4 + 2)

    doc.text(conceptoLines, colConcepto, yPos + 4.5)
    doc.text(linea.cantidad.toString(), colCant, yPos + 4.5, { align: "right" })
    doc.text(formatCurrency(linea.precio_unitario), colPrecio, yPos + 4.5, { align: "right" })
    doc.text(`${linea.porcentaje_iva}%`, colIVA, yPos + 4.5, { align: "right" })
    doc.setFont("helvetica", "bold")
    doc.text(formatCurrency(linea.importe_linea), colTotal, yPos + 4.5, { align: "right" })
    doc.setFont("helvetica", "normal")

    yPos += lineHeight

    // Paginación si es necesario
    if (yPos > pageHeight - 80) {
      doc.addPage()
      yPos = margin
    }
  })

  // Línea separadora
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 8

  // ==================== TOTALES ====================
  // Posiciones fijas y claras
  const labelX = pageWidth - margin - 70
  const valueX = pageWidth - margin - 5

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(gray600)

  // Base Imponible
  doc.text("Base Imponible", labelX, yPos)
  doc.setTextColor(gray800)
  doc.setFont("helvetica", "bold")
  doc.text(formatCurrency(data.base_imponible), valueX, yPos, { align: "right" })
  doc.setFont("helvetica", "normal")
  yPos += 6

  // IVA
  doc.setTextColor(gray600)
  doc.text("IVA", labelX, yPos)
  doc.setTextColor(gray800)
  doc.setFont("helvetica", "bold")
  doc.text(formatCurrency(data.iva_total), valueX, yPos, { align: "right" })
  doc.setFont("helvetica", "normal")
  yPos += 6

  // IRPF (si aplica)
  if (data.retencion_irpf > 0) {
    doc.setTextColor(gray600)
    doc.text("Retención IRPF", labelX, yPos)
    doc.setTextColor("#DC2626")
    doc.setFont("helvetica", "bold")
    doc.text(`-${formatCurrency(data.retencion_irpf)}`, valueX, yPos, { align: "right" })
    doc.setFont("helvetica", "normal")
    yPos += 8
  } else {
    yPos += 2
  }

  // Total destacado - BOX MÁS ANCHO
  const boxWidth = 75
  const boxX = pageWidth - margin - boxWidth
  doc.setFillColor(primary)
  doc.roundedRect(boxX, yPos - 4, boxWidth, 11, 2, 2, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text("TOTAL", boxX + 8, yPos + 3)
  doc.setFontSize(14)
  doc.text(formatCurrency(data.total), boxX + boxWidth - 5, yPos + 3, { align: "right" })

  yPos += 16

  // ==================== OBSERVACIONES ====================
  if (data.observaciones) {
    doc.setFillColor(gray100)
    doc.roundedRect(margin, yPos, contentWidth, 20, 2, 2, "F")
    doc.setTextColor(gray600)
    doc.setFontSize(8)
    doc.setFont("helvetica", "bold")
    doc.text("OBSERVACIONES", margin + 3, yPos + 4)
    doc.setFont("helvetica", "normal")
    const obsLines = doc.splitTextToSize(data.observaciones, contentWidth - 6)
    doc.text(obsLines, margin + 3, yPos + 8)
    yPos += 24
  }

  // ==================== FOOTER & QR ====================
  const footerY = pageHeight - 35

  // QR Code
  try {
    const qrDataUrl = await QRCode.toDataURL(data.qr_data, {
      width: 200,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
    })
    doc.addImage(qrDataUrl, "PNG", pageWidth - margin - 25, footerY, 25, 25)
    
    // Badge Verifactu
    doc.setFillColor(primary)
    doc.roundedRect(pageWidth - margin - 25, footerY - 6, 25, 5, 1, 1, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(6.5)
    doc.setFont("helvetica", "bold")
    doc.text("FACTURA VERIFACTU", pageWidth - margin - 12.5, footerY - 2.5, { align: "center" })
  } catch (err) {
    console.error("Error generando QR:", err)
  }

  // Disclaimer legal
  doc.setTextColor(gray400)
  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  const disclaimer = "Esta factura ha sido generada electrónicamente y es válida sin firma ni sello según el Real Decreto 1619/2012."
  const disclaimerLines = doc.splitTextToSize(disclaimer, contentWidth - 32)
  doc.text(disclaimerLines, margin, footerY + 5)

  // MuyFactu branding (izquierda)
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(gray800)
  doc.text("Muy", margin, footerY + 20)
  const muyWidth = doc.getTextWidth("Muy")
  doc.setTextColor(primary)
  doc.text("Factu", margin + muyWidth, footerY + 20)

  // Línea separadora (solo hasta antes del QR)
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(margin, footerY + 15, pageWidth - margin - 30, footerY + 15)

  // Footer centro
  doc.setTextColor(gray400)
  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.text(`${data.asesoria.nombre} • ${data.asesoria.nif}`, pageWidth / 2, footerY + 20, { align: "center" })
  doc.text(`Página 1 de 1`, pageWidth / 2, footerY + 24, { align: "center" })

  // Generar blob
  return doc.output("blob")
}