export function emailBienvenidaCliente(params: {
    nombreCliente: string
    nombreAsesoria: string
    email: string
    password: string
    loginUrl: string
  }) {
    const { nombreCliente, nombreAsesoria, email, password, loginUrl } = params
  
    const html = `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bienvenido a ${nombreAsesoria}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:40px 20px;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <tr>
              <td style="background-color:#4f46e5;padding:32px 40px;text-align:center;">
                <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">${nombreAsesoria}</h1>
                <p style="color:#c7d2fe;margin:8px 0 0;font-size:14px;">Portal de Facturación</p>
              </td>
            </tr>
  
            <!-- Body -->
            <tr>
              <td style="padding:40px;">
                <h2 style="color:#111827;font-size:20px;margin:0 0 16px;">¡Bienvenido, ${nombreCliente}!</h2>
                <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 24px;">
                  Tu cuenta en el portal de facturación de <strong>${nombreAsesoria}</strong> ha sido creada correctamente. 
                  A partir de ahora podrás solicitar facturas, consultar tu historial y descargar tus documentos.
                </p>
  
                <!-- Credenciales -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;border-radius:8px;margin-bottom:24px;">
                  <tr>
                    <td style="padding:24px;">
                      <p style="color:#374151;font-size:13px;font-weight:600;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.05em;">Tus credenciales de acceso</p>
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
                            <span style="color:#6b7280;font-size:13px;">Email</span>
                          </td>
                          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;">
                            <span style="color:#111827;font-size:13px;font-weight:500;">${email}</span>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:8px 0;">
                            <span style="color:#6b7280;font-size:13px;">Contraseña temporal</span>
                          </td>
                          <td style="padding:8px 0;text-align:right;">
                            <span style="color:#111827;font-size:14px;font-weight:700;font-family:monospace;background:#e5e7eb;padding:2px 8px;border-radius:4px;">${password}</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
  
                <!-- Aviso seguridad -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef3c7;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;margin-bottom:24px;">
                  <tr>
                    <td style="padding:16px;">
                      <p style="color:#92400e;font-size:13px;margin:0;">
                        <strong>⚠️ Importante:</strong> Por seguridad, cambia tu contraseña en el primer acceso desde tu perfil.
                      </p>
                    </td>
                  </tr>
                </table>
  
                <!-- CTA Button -->
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding:8px 0 32px;">
                      <a href="${loginUrl}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
                        Acceder al Portal →
                      </a>
                    </td>
                  </tr>
                </table>
  
                <p style="color:#9ca3af;font-size:13px;text-align:center;margin:0;">
                  Si tienes problemas para acceder, contacta con ${nombreAsesoria}.
                </p>
              </td>
            </tr>
  
            <!-- Footer -->
            <tr>
              <td style="background-color:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
                <p style="color:#9ca3af;font-size:12px;margin:0;">
                  © ${new Date().getFullYear()} ${nombreAsesoria} · Powered by MuyFactu
                </p>
              </td>
            </tr>
  
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
    `
  
    const text = `
  Bienvenido a ${nombreAsesoria}, ${nombreCliente}.
  
  Tu cuenta ha sido creada. Aquí están tus credenciales:
  Email: ${email}
  Contraseña temporal: ${password}
  
  Accede en: ${loginUrl}
  
  Por seguridad, cambia tu contraseña en el primer acceso.
    `
  
    return { html, text }
  }
  
  export function emailFacturaGenerada(params: {
    nombreCliente: string
    nombreAsesoria: string
    numeroFactura: string
    total: number
    fechaEmision: string
    fechaVencimiento: string
    portalUrl: string
  }) {
    const { nombreCliente, nombreAsesoria, numeroFactura, total, fechaEmision, fechaVencimiento, portalUrl } = params
  
    const formatCurrency = (amount: number) =>
      new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(amount)
  
    const formatDate = (dateString: string) =>
      new Date(dateString).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
  
    const html = `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nueva Factura ${numeroFactura}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:40px 20px;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <tr>
              <td style="background-color:#4f46e5;padding:32px 40px;text-align:center;">
                <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">${nombreAsesoria}</h1>
                <p style="color:#c7d2fe;margin:8px 0 0;font-size:14px;">Nueva Factura Disponible</p>
              </td>
            </tr>
  
            <!-- Body -->
            <tr>
              <td style="padding:40px;">
                <h2 style="color:#111827;font-size:20px;margin:0 0 8px;">Hola, ${nombreCliente}</h2>
                <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 28px;">
                  Tu asesoría <strong>${nombreAsesoria}</strong> ha generado una nueva factura. 
                  Puedes descargarla desde el portal o encontrarla adjunta en este correo.
                </p>
  
                <!-- Datos factura -->
                <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;margin-bottom:28px;">
                  <tr>
                    <td style="padding:20px 24px;border-bottom:1px solid #e5e7eb;">
                      <p style="color:#374151;font-size:13px;font-weight:600;margin:0;text-transform:uppercase;letter-spacing:0.05em;">Datos de la Factura</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 24px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding:6px 0;"><span style="color:#6b7280;font-size:14px;">Número</span></td>
                          <td style="padding:6px 0;text-align:right;"><span style="color:#111827;font-size:14px;font-weight:600;font-family:monospace;">${numeroFactura}</span></td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;"><span style="color:#6b7280;font-size:14px;">Fecha de emisión</span></td>
                          <td style="padding:6px 0;text-align:right;"><span style="color:#111827;font-size:14px;">${formatDate(fechaEmision)}</span></td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;"><span style="color:#6b7280;font-size:14px;">Fecha de vencimiento</span></td>
                          <td style="padding:6px 0;text-align:right;"><span style="color:#111827;font-size:14px;">${formatDate(fechaVencimiento)}</span></td>
                        </tr>
                        <tr>
                          <td style="padding:12px 0 0;border-top:1px solid #e5e7eb;"><span style="color:#111827;font-size:16px;font-weight:700;">Total</span></td>
                          <td style="padding:12px 0 0;border-top:1px solid #e5e7eb;text-align:right;"><span style="color:#4f46e5;font-size:20px;font-weight:700;">${formatCurrency(total)}</span></td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
  
                <!-- CTA -->
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding:8px 0 32px;">
                      <a href="${portalUrl}" style="display:inline-block;background-color:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
                        Ver y Descargar Factura →
                      </a>
                    </td>
                  </tr>
                </table>
  
                <p style="color:#9ca3af;font-size:13px;text-align:center;margin:0;">
                  El PDF de la factura está adjunto en este correo.
                </p>
              </td>
            </tr>
  
            <!-- Footer -->
            <tr>
              <td style="background-color:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
                <p style="color:#9ca3af;font-size:12px;margin:0;">
                  © ${new Date().getFullYear()} ${nombreAsesoria} · Powered by MuyFactu
                </p>
              </td>
            </tr>
  
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
    `
  
    const text = `
  Hola ${nombreCliente},
  
  ${nombreAsesoria} ha generado la factura ${numeroFactura} por ${formatCurrency(total)}.
  
  Fecha de emisión: ${formatDate(fechaEmision)}
  Fecha de vencimiento: ${formatDate(fechaVencimiento)}
  
  Accede al portal para descargarla: ${portalUrl}
  
  El PDF también está adjunto en este correo.
    `
  
    return { html, text }
  }