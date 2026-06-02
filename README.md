# MuyFactu

MuyFactu es un prototipo funcional de sistema SaaS para la gestión de clientes, solicitudes de factura y facturación en asesorías y PYMEs. Incluye panel de asesoría, panel de cliente, generación de PDF, almacenamiento privado de facturas, trazabilidad mediante hash SHA-256 encadenado y un asistente integrado, AsesorIA.

## Tecnologías principales

- Next.js / React
- Supabase Auth, PostgreSQL, RLS y Storage
- jsPDF y QRCode para generación de PDF
- Gemini API para AsesorIA
- Resend para correo transaccional preparado

## Puesta en marcha local

1. Instalar dependencias:

```bash
npm install
```

2. Crear `.env.local`.

3. Ejecutar la base de datos en Supabase:

- Instalación nueva: ejecutar `scripts/001_create_schema.sql`.
- Proyecto ya creado antes de las mejoras: aplicar, si procede, `scripts/002_private_storage_and_integrity.sql`, `scripts/003_hash_inmutabilidad_facturas.sql`, `scripts/004_adjuntos_certificados_limpieza.sql` y `scripts/005_fix_lineas_trigger_delete.sql`.

4. Arrancar el proyecto:

```bash
npm run dev
```

## Notas de alcance

El sistema implementa trazabilidad técnica, hash SHA-256, encadenamiento e inmutabilidad básica de facturas emitidas. El envío real a AEAT y la certificación oficial VeriFactu quedan fuera del alcance del prototipo y se plantean como línea futura.
