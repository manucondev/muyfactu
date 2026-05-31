-- MuyFactu Database Schema

-- Asesorias (accounting firms)
CREATE TABLE IF NOT EXISTS public.asesorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  nif TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  telefono TEXT,
  direccion TEXT,
  ciudad TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.asesorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asesorias_select_all" ON public.asesorias FOR SELECT USING (true);
CREATE POLICY "asesorias_insert" ON public.asesorias FOR INSERT WITH CHECK (true);
CREATE POLICY "asesorias_update_own" ON public.asesorias FOR UPDATE USING (
  id IN (SELECT asesoria_id FROM public.usuarios_asesoria WHERE user_id = auth.uid())
);

-- Usuarios Asesoria (link auth users to asesorias)
CREATE TABLE IF NOT EXISTS public.usuarios_asesoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asesoria_id UUID NOT NULL REFERENCES public.asesorias(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.usuarios_asesoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuarios_asesoria_select_own" ON public.usuarios_asesoria FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "usuarios_asesoria_insert" ON public.usuarios_asesoria FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Clientes
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  asesoria_id UUID NOT NULL REFERENCES public.asesorias(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('empresa', 'particular')),
  nombre TEXT NOT NULL,
  nif TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT,
  direccion TEXT,
  cp TEXT,
  ciudad TEXT,
  dias_pago INTEGER DEFAULT 30,
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clientes_select_asesoria" ON public.clientes FOR SELECT USING (
  asesoria_id IN (SELECT asesoria_id FROM public.usuarios_asesoria WHERE user_id = auth.uid())
  OR user_id = auth.uid()
);
CREATE POLICY "clientes_insert" ON public.clientes FOR INSERT WITH CHECK (
  asesoria_id IN (SELECT asesoria_id FROM public.usuarios_asesoria WHERE user_id = auth.uid())
  OR auth.uid() IS NOT NULL
);
CREATE POLICY "clientes_update" ON public.clientes FOR UPDATE USING (
  asesoria_id IN (SELECT asesoria_id FROM public.usuarios_asesoria WHERE user_id = auth.uid())
  OR user_id = auth.uid()
);

-- Solicitudes Factura
CREATE TABLE IF NOT EXISTS public.solicitudes_factura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  asesoria_id UUID NOT NULL REFERENCES public.asesorias(id) ON DELETE CASCADE,
  conceptos JSONB NOT NULL DEFAULT '[]'::jsonb,
  observaciones TEXT,
  adjuntos TEXT[],
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'facturada')),
  motivo_rechazo TEXT,
  factura_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.solicitudes_factura ENABLE ROW LEVEL SECURITY;
CREATE POLICY "solicitudes_select" ON public.solicitudes_factura FOR SELECT USING (
  asesoria_id IN (SELECT asesoria_id FROM public.usuarios_asesoria WHERE user_id = auth.uid())
  OR cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
);
CREATE POLICY "solicitudes_insert" ON public.solicitudes_factura FOR INSERT WITH CHECK (
  cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
);
CREATE POLICY "solicitudes_update" ON public.solicitudes_factura FOR UPDATE USING (
  asesoria_id IN (SELECT asesoria_id FROM public.usuarios_asesoria WHERE user_id = auth.uid())
);

-- Facturas
CREATE TABLE IF NOT EXISTS public.facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asesoria_id UUID NOT NULL REFERENCES public.asesorias(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  solicitud_id UUID REFERENCES public.solicitudes_factura(id),
  serie TEXT NOT NULL DEFAULT 'A',
  numero INTEGER NOT NULL,
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE NOT NULL,
  base_imponible NUMERIC(12,2) NOT NULL DEFAULT 0,
  iva_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  irpf_porcentaje NUMERIC(5,2) DEFAULT 0,
  irpf_total NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'cobrada', 'vencida')),
  fecha_cobro DATE,
  pdf_url TEXT,
  hash_verifactu TEXT,
  qr_data TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(asesoria_id, serie, numero)
);

ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facturas_select" ON public.facturas FOR SELECT USING (
  asesoria_id IN (SELECT asesoria_id FROM public.usuarios_asesoria WHERE user_id = auth.uid())
  OR cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
);
CREATE POLICY "facturas_insert" ON public.facturas FOR INSERT WITH CHECK (
  asesoria_id IN (SELECT asesoria_id FROM public.usuarios_asesoria WHERE user_id = auth.uid())
);
CREATE POLICY "facturas_update" ON public.facturas FOR UPDATE USING (
  asesoria_id IN (SELECT asesoria_id FROM public.usuarios_asesoria WHERE user_id = auth.uid())
);

-- Lineas Factura
CREATE TABLE IF NOT EXISTS public.lineas_factura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id UUID NOT NULL REFERENCES public.facturas(id) ON DELETE CASCADE,
  concepto TEXT NOT NULL,
  cantidad NUMERIC(12,2) NOT NULL,
  precio_unitario NUMERIC(12,2) NOT NULL,
  iva_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 21,
  subtotal NUMERIC(12,2) NOT NULL,
  iva_importe NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL
);

ALTER TABLE public.lineas_factura ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lineas_select" ON public.lineas_factura FOR SELECT USING (
  factura_id IN (SELECT id FROM public.facturas WHERE
    asesoria_id IN (SELECT asesoria_id FROM public.usuarios_asesoria WHERE user_id = auth.uid())
    OR cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
  )
);
CREATE POLICY "lineas_insert" ON public.lineas_factura FOR INSERT WITH CHECK (
  factura_id IN (SELECT id FROM public.facturas WHERE
    asesoria_id IN (SELECT asesoria_id FROM public.usuarios_asesoria WHERE user_id = auth.uid())
  )
);

-- Notificaciones
CREATE TABLE IF NOT EXISTS public.notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  leida BOOLEAN DEFAULT false,
  enlace TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notificaciones_select_own" ON public.notificaciones FOR SELECT USING (auth.uid() = destinatario_id);
CREATE POLICY "notificaciones_insert" ON public.notificaciones FOR INSERT WITH CHECK (true);
CREATE POLICY "notificaciones_update_own" ON public.notificaciones FOR UPDATE USING (auth.uid() = destinatario_id);

-- Certificados Digitales
CREATE TABLE IF NOT EXISTS public.certificados_digitales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asesoria_id UUID NOT NULL REFERENCES public.asesorias(id) ON DELETE CASCADE,
  nombre_archivo TEXT NOT NULL,
  estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'caducado', 'sin_certificado')),
  fecha_subida TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.certificados_digitales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certificados_select" ON public.certificados_digitales FOR SELECT USING (
  asesoria_id IN (SELECT asesoria_id FROM public.usuarios_asesoria WHERE user_id = auth.uid())
);
CREATE POLICY "certificados_insert" ON public.certificados_digitales FOR INSERT WITH CHECK (
  asesoria_id IN (SELECT asesoria_id FROM public.usuarios_asesoria WHERE user_id = auth.uid())
);

-- Configuracion Plantilla
CREATE TABLE IF NOT EXISTS public.configuracion_plantilla (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asesoria_id UUID NOT NULL REFERENCES public.asesorias(id) ON DELETE CASCADE UNIQUE,
  estilo TEXT DEFAULT 'clasico' CHECK (estilo IN ('clasico', 'moderno', 'corporativo')),
  color_primario TEXT DEFAULT '#2563EB',
  footer_texto TEXT
);

ALTER TABLE public.configuracion_plantilla ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plantilla_select" ON public.configuracion_plantilla FOR SELECT USING (
  asesoria_id IN (SELECT asesoria_id FROM public.usuarios_asesoria WHERE user_id = auth.uid())
);
CREATE POLICY "plantilla_upsert" ON public.configuracion_plantilla FOR INSERT WITH CHECK (
  asesoria_id IN (SELECT asesoria_id FROM public.usuarios_asesoria WHERE user_id = auth.uid())
);
CREATE POLICY "plantilla_update" ON public.configuracion_plantilla FOR UPDATE USING (
  asesoria_id IN (SELECT asesoria_id FROM public.usuarios_asesoria WHERE user_id = auth.uid())
);

-- Storage buckets (run in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('certificados', 'certificados', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('facturas', 'facturas', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('solicitud-adjuntos', 'solicitud-adjuntos', false);
