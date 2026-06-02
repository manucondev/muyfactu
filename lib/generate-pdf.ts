import jsPDF from "jspdf"
import QRCode from "qrcode"

type PlantillaEstilo = "clasico" | "moderno" | "corporativo"

export interface FacturaPlantillaData {
  estilo: PlantillaEstilo
  color_primario: string
  footer_texto: string | null
}

export interface FacturaData {
  numero_factura: string
  fecha_emision: string
  fecha_vencimiento: string
  qr_data: string
  hash_sha256?: string | null
  hash_anterior?: string | null
  observaciones: string | null
  base_imponible: number
  iva_total: number
  retencion_irpf: number
  total: number
  plantilla?: FacturaPlantillaData | null
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

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : "#4F46E5"
  return [
    parseInt(normalized.slice(1, 3), 16),
    parseInt(normalized.slice(3, 5), 16),
    parseInt(normalized.slice(5, 7), 16),
  ]
}

const lighten = (hex: string, amount = 0.92): [number, number, number] => {
  const [r, g, b] = hexToRgb(hex)
  return [
    Math.round(r + (255 - r) * amount),
    Math.round(g + (255 - g) * amount),
    Math.round(b + (255 - b) * amount),
  ]
}

const getInitials = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .map(word => word[0])
    .join("")
    .substring(0, 2)
    .toUpperCase()

const safeText = (value: string | null | undefined, fallback = "—") => value?.trim() || fallback

async function addLogoOrInitials(
  doc: jsPDF,
  logoUrl: string | null,
  name: string,
  x: number,
  y: number,
  size: number,
  primaryHex: string,
) {
  if (logoUrl) {
    try {
      doc.addImage(logoUrl, "PNG", x, y, size, size)
      return
    } catch {
      // Si la carga remota falla, se usa un fallback con iniciales.
    }
  }

  const [r, g, b] = hexToRgb(primaryHex)
  doc.setFillColor(r, g, b)
  doc.circle(x + size / 2, y + size / 2, size / 2, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(size * 0.55)
  doc.text(getInitials(name), x + size / 2, y + size / 2 + size * 0.18, { align: "center" })
}

export async function generateFacturaPDF(data: FacturaData): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

  const pageWidth = 210
  const pageHeight = 297
  const margin = 20
  const contentWidth = pageWidth - 2 * margin
  const plantilla: FacturaPlantillaData = {
    estilo: data.plantilla?.estilo || "clasico",
    color_primario: data.plantilla?.color_primario || "#4F46E5",
    footer_texto: data.plantilla?.footer_texto || null,
  }

  const [primaryR, primaryG, primaryB] = hexToRgb(plantilla.color_primario)
  const [lightR, lightG, lightB] = lighten(plantilla.color_primario)
  const gray900 = [17, 24, 39] as const
  const gray800 = [31, 41, 55] as const
  const gray700 = [55, 65, 81] as const
  const gray600 = [75, 85, 99] as const
  const gray400 = [156, 163, 175] as const
  const gray100 = [243, 244, 246] as const
  const font = plantilla.estilo === "clasico" ? "times" : "helvetica"

  let yPos = margin

  const setPrimary = () => doc.setTextColor(primaryR, primaryG, primaryB)
  const setPrimaryFill = () => doc.setFillColor(primaryR, primaryG, primaryB)
  const setGrayText = (level: "900" | "800" | "700" | "600" | "400" = "800") => {
    const color = level === "900" ? gray900 : level === "800" ? gray800 : level === "700" ? gray700 : level === "600" ? gray600 : gray400
    doc.setTextColor(color[0], color[1], color[2])
  }

  // ==================== CABECERA ====================
  if (plantilla.estilo === "corporativo") {
    setPrimaryFill()
    doc.rect(0, 0, pageWidth, 34, "F")

    await addLogoOrInitials(doc, resolveLogoUrl(data.asesoria.logo_url), data.asesoria.nombre, margin, 8, 16, plantilla.color_primario)

    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.text(data.asesoria.nombre, margin + 22, 15)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.text(`NIF: ${data.asesoria.nif}`, margin + 22, 20)
    doc.text(`${safeText(data.asesoria.email, "")} · ${safeText(data.asesoria.telefono, "")}`, margin + 22, 25)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(18)
    doc.text("FACTURA", pageWidth - margin, 15, { align: "right" })
    doc.setFontSize(10)
    doc.text(data.numero_factura, pageWidth - margin, 22, { align: "right" })

    yPos = 44
  } else {
    await addLogoOrInitials(doc, resolveLogoUrl(data.asesoria.logo_url), data.asesoria.nombre, margin, yPos, 16, plantilla.color_primario)

    doc.setFont(font, "bold")
    doc.setFontSize(plantilla.estilo === "clasico" ? 13 : 11)
    setGrayText("900")
    doc.text(data.asesoria.nombre, margin + 22, yPos + 5)

    doc.setFont(font, "normal")
    doc.setFontSize(8)
    setGrayText("600")
    doc.text(`NIF: ${data.asesoria.nif}`, margin + 22, yPos + 10)
    doc.text(`${safeText(data.asesoria.direccion, "")}, ${safeText(data.asesoria.ciudad, "")}`, margin + 22, yPos + 14)
    doc.text(`${safeText(data.asesoria.email, "")} · ${safeText(data.asesoria.telefono, "")}`, margin + 22, yPos + 18)

    if (plantilla.estilo === "clasico") {
      setGrayText("900")
      doc.setFont(font, "bold")
      doc.setFontSize(18)
      doc.text("FACTURA", pageWidth - margin, yPos + 5, { align: "right" })
      doc.setFontSize(10)
      doc.text(data.numero_factura, pageWidth - margin, yPos + 12, { align: "right" })
      setPrimaryFill()
      doc.rect(pageWidth - margin - 42, yPos + 16, 42, 1.2, "F")
    } else {
      const badgeText = `FACTURA ${data.numero_factura}`
      const badgeWidth = doc.getTextWidth(badgeText) + 12
      setPrimaryFill()
      doc.roundedRect(pageWidth - margin - badgeWidth, yPos, badgeWidth, 10, 2, 2, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10)
      doc.text(badgeText, pageWidth - margin - badgeWidth / 2, yPos + 6.5, { align: "center" })
    }

    yPos += 32
  }

  // ==================== FECHAS ====================
  doc.setFont(font, "normal")
  doc.setFontSize(8.5)
  setGrayText("600")
  doc.text("Fecha emisión", margin, yPos)
  doc.text("Vencimiento", margin + 42, yPos)
  setGrayText("900")
  doc.setFont(font, "bold")
  doc.text(formatDate(data.fecha_emision), margin, yPos + 5)
  doc.text(formatDate(data.fecha_vencimiento), margin + 42, yPos + 5)

  yPos += 17

  // ==================== CLIENTE ====================
  doc.setFont(font, "bold")
  doc.setFontSize(9)
  if (plantilla.estilo === "clasico") setGrayText("900")
  else setPrimary()
  doc.text("FACTURADO A", margin, yPos)
  yPos += 6

  const clientBoxHeight = data.cliente.banco ? 38 : 31
  if (plantilla.estilo === "clasico") {
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.4)
    doc.rect(margin, yPos, contentWidth, clientBoxHeight, "S")
  } else {
    doc.setFillColor(lightR, lightG, lightB)
    doc.setDrawColor(220, 220, 220)
    doc.roundedRect(margin, yPos, contentWidth, clientBoxHeight, 2, 2, "FD")
  }

  yPos += 6
  doc.setFont(font, "bold")
  doc.setFontSize(12)
  setGrayText("900")
  doc.text(data.cliente.nombre, margin + 4, yPos)
  doc.setFont(font, "normal")
  doc.setFontSize(9)
  setGrayText("600")
  doc.text(`NIF: ${data.cliente.nif}`, pageWidth - margin - 4, yPos, { align: "right" })

  yPos += 6
  doc.setFontSize(8.5)
  const col1 = margin + 4
  const col2 = margin + contentWidth / 2 + 2
  doc.text(safeText(data.cliente.direccion), col1, yPos)
  doc.text(safeText(data.cliente.email), col2, yPos)
  yPos += 5
  doc.text(`${safeText(data.cliente.cp, "")} ${safeText(data.cliente.ciudad, "")}`.trim() || "—", col1, yPos)
  doc.text(safeText(data.cliente.telefono), col2, yPos)
  yPos += 5

  if (data.cliente.banco) {
    yPos += 2
    doc.setFont(font, "bold")
    setGrayText("900")
    doc.text("Datos bancarios", col1, yPos)
    doc.setFont(font, "normal")
    setGrayText("600")
    doc.text(data.cliente.banco, col1 + 28, yPos)
    yPos += 5
    doc.text(`IBAN: ${data.cliente.iban || "—"}`, col1, yPos)
    if (data.cliente.bic_swift) doc.text(`BIC/SWIFT: ${data.cliente.bic_swift}`, col2, yPos)
  }

  yPos += 13

  // ==================== TABLA ====================
  doc.setFont(font, "bold")
  doc.setFontSize(9)
  if (plantilla.estilo === "clasico") setGrayText("900")
  else setPrimary()
  doc.text("CONCEPTOS Y SERVICIOS", margin, yPos)
  yPos += 6

  if (plantilla.estilo === "clasico") doc.setFillColor(31, 41, 55)
  else setPrimaryFill()
  doc.rect(margin, yPos, contentWidth, 8, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)

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

  doc.setFont(font, "normal")
  doc.setFontSize(8.5)
  setGrayText("900")

  data.lineas.forEach((linea, i) => {
    const conceptoLines = doc.splitTextToSize(linea.concepto, 75)
    const lineHeight = Math.max(7, conceptoLines.length * 4 + 2)

    if (plantilla.estilo !== "clasico" && i % 2 === 0) {
      doc.setFillColor(gray100[0], gray100[1], gray100[2])
      doc.rect(margin, yPos, contentWidth, lineHeight, "F")
    }

    setGrayText("900")
    doc.text(conceptoLines, colConcepto, yPos + 4.5)
    setGrayText("600")
    doc.text(linea.cantidad.toString(), colCant, yPos + 4.5, { align: "right" })
    doc.text(formatCurrency(linea.precio_unitario), colPrecio, yPos + 4.5, { align: "right" })
    doc.text(`${linea.porcentaje_iva}%`, colIVA, yPos + 4.5, { align: "right" })
    doc.setFont(font, "bold")
    setGrayText("900")
    doc.text(formatCurrency(linea.importe_linea), colTotal, yPos + 4.5, { align: "right" })
    doc.setFont(font, "normal")

    yPos += lineHeight

    if (yPos > pageHeight - 85) {
      doc.addPage()
      yPos = margin
    }
  })

  doc.setDrawColor(210, 210, 210)
  doc.setLineWidth(0.3)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 8

  // ==================== TOTALES ====================
  const labelX = pageWidth - margin - 70
  const valueX = pageWidth - margin - 5

  doc.setFont(font, "normal")
  doc.setFontSize(9)
  setGrayText("600")
  doc.text("Base imponible", labelX, yPos)
  doc.setFont(font, "bold")
  setGrayText("900")
  doc.text(formatCurrency(data.base_imponible), valueX, yPos, { align: "right" })
  yPos += 6

  doc.setFont(font, "normal")
  setGrayText("600")
  doc.text("IVA", labelX, yPos)
  doc.setFont(font, "bold")
  setGrayText("900")
  doc.text(formatCurrency(data.iva_total), valueX, yPos, { align: "right" })
  yPos += 6

  if (data.retencion_irpf > 0) {
    doc.setFont(font, "normal")
    setGrayText("600")
    doc.text("Retención IRPF", labelX, yPos)
    doc.setFont(font, "bold")
    doc.setTextColor(220, 38, 38)
    doc.text(`-${formatCurrency(data.retencion_irpf)}`, valueX, yPos, { align: "right" })
    yPos += 8
  } else {
    yPos += 2
  }

  if (plantilla.estilo === "clasico") {
    doc.setDrawColor(primaryR, primaryG, primaryB)
    doc.setLineWidth(0.7)
    doc.line(labelX, yPos - 3, valueX, yPos - 3)
    doc.setFont(font, "bold")
    doc.setFontSize(14)
    setGrayText("900")
    doc.text("TOTAL", labelX, yPos + 3)
    setPrimary()
    doc.text(formatCurrency(data.total), valueX, yPos + 3, { align: "right" })
  } else {
    const boxWidth = 75
    const boxX = pageWidth - margin - boxWidth
    setPrimaryFill()
    doc.roundedRect(boxX, yPos - 4, boxWidth, 11, 2, 2, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.text("TOTAL", boxX + 8, yPos + 3)
    doc.setFontSize(14)
    doc.text(formatCurrency(data.total), boxX + boxWidth - 5, yPos + 3, { align: "right" })
  }

  yPos += 18

  // ==================== OBSERVACIONES Y PIE PERSONALIZADO ====================
  if (data.observaciones || plantilla.footer_texto) {
    const boxText = [data.observaciones, plantilla.footer_texto].filter(Boolean).join("\n")
    const lines = doc.splitTextToSize(boxText, contentWidth - 6)
    const boxHeight = Math.min(28, Math.max(16, lines.length * 4 + 8))

    if (plantilla.estilo === "clasico") {
      doc.setDrawColor(210, 210, 210)
      doc.rect(margin, yPos, contentWidth, boxHeight, "S")
    } else {
      doc.setFillColor(gray100[0], gray100[1], gray100[2])
      doc.roundedRect(margin, yPos, contentWidth, boxHeight, 2, 2, "F")
    }

    doc.setFont("helvetica", "bold")
    doc.setFontSize(7.5)
    setGrayText("700")
    doc.text(data.observaciones ? "OBSERVACIONES" : "PIE DE FACTURA", margin + 3, yPos + 5)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    setGrayText("600")
    doc.text(lines.slice(0, 5), margin + 3, yPos + 10)
    yPos += boxHeight + 6
  }

  // ==================== FOOTER Y QR ====================
  const footerY = pageHeight - 35

  try {
    const qrDataUrl = await QRCode.toDataURL(data.qr_data, {
      width: 200,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
    })
    doc.addImage(qrDataUrl, "PNG", pageWidth - margin - 25, footerY, 25, 25)

    setPrimaryFill()
    doc.roundedRect(pageWidth - margin - 25, footerY - 6, 25, 5, 1, 1, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(6.5)
    doc.text("REGISTRO TÉCNICO", pageWidth - margin - 12.5, footerY - 2.5, { align: "center" })
  } catch (err) {
    console.error("Error generando QR:", err)
  }

  doc.setFont("helvetica", "normal")
  doc.setFontSize(6.5)
  setGrayText("400")
  const hashInfo = data.hash_sha256
    ? `Hash SHA-256: ${data.hash_sha256.substring(0, 24)}...${data.hash_sha256.substring(data.hash_sha256.length - 8)}`
    : "Registro técnico pendiente de hash"
  doc.text(hashInfo, margin, footerY + 4)

  if (data.hash_anterior) {
    doc.text(`Hash anterior: ${data.hash_anterior.substring(0, 20)}...`, margin, footerY + 8)
  }

  doc.setFontSize(7)
  const disclaimer =
    "Factura generada electrónicamente por MuyFactu. Registro interno con trazabilidad técnica; envío automático a AEAT no implementado en este prototipo."
  doc.text(doc.splitTextToSize(disclaimer, contentWidth - 32), margin, footerY + (data.hash_anterior ? 13 : 10))

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  setGrayText("900")
  doc.text("Muy", margin, footerY + 20)
  const muyWidth = doc.getTextWidth("Muy")
  setPrimary()
  doc.text("Factu", margin + muyWidth, footerY + 20)

  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(margin, footerY + 15, pageWidth - margin - 30, footerY + 15)

  setGrayText("400")
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.text(`${data.asesoria.nombre} · ${data.asesoria.nif}`, pageWidth / 2, footerY + 20, { align: "center" })
  doc.text("Página 1 de 1", pageWidth / 2, footerY + 24, { align: "center" })

  return doc.output("blob")
}
