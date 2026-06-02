-- 001_create_schema.sql
-- Esquema base consolidado de MuyFactu.
-- Para una instalación nueva, ejecutar este script en Supabase SQL Editor.
-- Los scripts 002, 003 y 004 se mantienen como migraciones incrementales para bases antiguas.

create extension if not exists pgcrypto;

-- =============================
-- TABLAS
-- =============================

create table if not exists public.asesorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nif text not null unique,
  email text not null unique,
  telefono text,
  direccion text,
  ciudad text,
  provincia text,
  logo_url text,
  certificado_url text,
  certificado_password_encrypted text,
  estado text default 'activo' check (estado in ('activo', 'inactivo')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.usuarios_asesoria (
  id uuid primary key default gen_random_uuid(),
  asesoria_id uuid references public.asesorias(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  nombre text not null,
  email text not null unique,
  rol text default 'admin' check (rol in ('admin', 'usuario')),
  created_at timestamp with time zone default now(),
  ultimo_acceso timestamp with time zone,
  unique (user_id, asesoria_id)
);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  asesoria_id uuid references public.asesorias(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  tipo text not null check (tipo in ('empresa', 'particular')),
  nombre text not null,
  nif text not null unique,
  email text not null unique,
  telefono text,
  direccion text,
  cp text,
  ciudad text,
  provincia text,
  dias_pago integer default 30,
  estado text default 'activo' check (estado in ('activo', 'inactivo')),
  created_at timestamp with time zone default now(),
  ultimo_acceso timestamp with time zone,
  updated_at timestamp with time zone default now(),
  banco varchar,
  iban varchar,
  bic_swift varchar
);

create table if not exists public.configuracion_plantilla (
  id uuid primary key default gen_random_uuid(),
  asesoria_id uuid not null unique references public.asesorias(id) on delete cascade,
  estilo text not null default 'clasico' check (estilo in ('clasico', 'moderno', 'corporativo')),
  color_primario text not null default '#2563EB',
  footer_texto text,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now())
);

create table if not exists public.solicitudes_factura (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete cascade,
  estado text default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada', 'facturada')),
  conceptos jsonb not null,
  observaciones_cliente text,
  adjuntos jsonb,
  observaciones_asesoria text,
  motivo_rechazo text,
  created_at timestamp with time zone default now(),
  fecha_revision timestamp with time zone,
  fecha_aprobacion timestamp with time zone,
  factura_id uuid
);

create table if not exists public.facturas (
  id uuid primary key default gen_random_uuid(),
  asesoria_id uuid references public.asesorias(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete cascade,
  solicitud_id uuid references public.solicitudes_factura(id),
  numero_factura text not null,
  serie text default 'A',
  numero integer,
  fecha_emision date not null,
  fecha_vencimiento date not null,
  base_imponible numeric not null,
  iva_total numeric default 0,
  retencion_irpf numeric default 0,
  total numeric not null,
  estado text default 'pendiente' check (estado in ('pendiente', 'cobrada', 'vencida')),
  fecha_cobro date,
  pdf_url text,
  xml_url text,
  hash_sha256 text,
  hash_anterior text,
  datos_hash jsonb,
  fecha_registro timestamp with time zone,
  registro_version text default 'MF-SIF-1',
  qr_data text,
  observaciones text,
  created_at timestamp with time zone default now(),
  created_by uuid references public.usuarios_asesoria(id),
  unique (asesoria_id, numero_factura),
  unique (solicitud_id),
  check (hash_sha256 is null or hash_sha256 ~ '^[A-Fa-f0-9]{64}$'),
  check (hash_anterior is null or hash_anterior ~ '^[A-Fa-f0-9]{64}$')
);

alter table public.solicitudes_factura
  drop constraint if exists solicitudes_factura_factura_id_fkey;
alter table public.solicitudes_factura
  add constraint solicitudes_factura_factura_id_fkey
  foreign key (factura_id) references public.facturas(id);

create table if not exists public.lineas_factura (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid references public.facturas(id) on delete cascade,
  orden integer not null,
  concepto text not null,
  cantidad numeric default 1,
  precio_unitario numeric not null,
  porcentaje_iva numeric not null,
  importe_linea numeric not null,
  unique (factura_id, orden)
);

create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  destinatario_id uuid not null references auth.users(id) on delete cascade,
  tipo_destinatario text not null check (tipo_destinatario in ('asesoria', 'cliente')),
  tipo text not null,
  titulo text not null,
  mensaje text not null,
  link text,
  leida boolean default false,
  created_at timestamp with time zone default now()
);

-- =============================
-- ÍNDICES
-- =============================

create index if not exists facturas_cadena_idx on public.facturas (asesoria_id, serie, numero);
create index if not exists facturas_hash_idx on public.facturas (hash_sha256) where hash_sha256 is not null;
create index if not exists clientes_asesoria_idx on public.clientes (asesoria_id);
create index if not exists solicitudes_cliente_idx on public.solicitudes_factura (cliente_id);
create index if not exists lineas_factura_factura_idx on public.lineas_factura (factura_id);

-- =============================
-- RLS Y POLICIES
-- =============================

alter table public.asesorias enable row level security;
alter table public.usuarios_asesoria enable row level security;
alter table public.clientes enable row level security;
alter table public.configuracion_plantilla enable row level security;
alter table public.solicitudes_factura enable row level security;
alter table public.facturas enable row level security;
alter table public.lineas_factura enable row level security;
alter table public.notificaciones enable row level security;

-- Asesorías: lectura pública para selección en registro de cliente; escritura mediante server actions/service role.
drop policy if exists asesorias_select_public on public.asesorias;
create policy asesorias_select_public on public.asesorias
for select to public
using (estado = 'activo');

drop policy if exists asesorias_update on public.asesorias;
create policy asesorias_update on public.asesorias
for update to authenticated
using (
  id in (select ua.asesoria_id from public.usuarios_asesoria ua where ua.user_id = auth.uid())
)
with check (
  id in (select ua.asesoria_id from public.usuarios_asesoria ua where ua.user_id = auth.uid())
);

-- Usuarios de asesoría: se crean con service role; cada usuario solo lee/modifica su vínculo.
drop policy if exists usuarios_asesoria_select on public.usuarios_asesoria;
create policy usuarios_asesoria_select on public.usuarios_asesoria
for select to authenticated
using (user_id = auth.uid());

drop policy if exists usuarios_asesoria_update on public.usuarios_asesoria;
create policy usuarios_asesoria_update on public.usuarios_asesoria
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Clientes.
drop policy if exists clientes_select_asesoria on public.clientes;
create policy clientes_select_asesoria on public.clientes
for select to authenticated
using (
  asesoria_id in (select ua.asesoria_id from public.usuarios_asesoria ua where ua.user_id = auth.uid())
);

drop policy if exists clientes_select_own on public.clientes;
create policy clientes_select_own on public.clientes
for select to authenticated
using (user_id = auth.uid());

drop policy if exists clientes_insert on public.clientes;
create policy clientes_insert on public.clientes
for insert to authenticated
with check (
  user_id = auth.uid()
  or asesoria_id in (select ua.asesoria_id from public.usuarios_asesoria ua where ua.user_id = auth.uid())
);

drop policy if exists clientes_update_asesoria on public.clientes;
create policy clientes_update_asesoria on public.clientes
for update to authenticated
using (
  asesoria_id in (select ua.asesoria_id from public.usuarios_asesoria ua where ua.user_id = auth.uid())
)
with check (
  asesoria_id in (select ua.asesoria_id from public.usuarios_asesoria ua where ua.user_id = auth.uid())
);

drop policy if exists clientes_update_own on public.clientes;
create policy clientes_update_own on public.clientes
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Configuración de plantilla.
drop policy if exists configuracion_plantilla_select_asesoria on public.configuracion_plantilla;
create policy configuracion_plantilla_select_asesoria on public.configuracion_plantilla
for select to authenticated
using (asesoria_id in (select ua.asesoria_id from public.usuarios_asesoria ua where ua.user_id = auth.uid()));

drop policy if exists configuracion_plantilla_insert_asesoria on public.configuracion_plantilla;
create policy configuracion_plantilla_insert_asesoria on public.configuracion_plantilla
for insert to authenticated
with check (asesoria_id in (select ua.asesoria_id from public.usuarios_asesoria ua where ua.user_id = auth.uid()));

drop policy if exists configuracion_plantilla_update_asesoria on public.configuracion_plantilla;
create policy configuracion_plantilla_update_asesoria on public.configuracion_plantilla
for update to authenticated
using (asesoria_id in (select ua.asesoria_id from public.usuarios_asesoria ua where ua.user_id = auth.uid()))
with check (asesoria_id in (select ua.asesoria_id from public.usuarios_asesoria ua where ua.user_id = auth.uid()));

-- Solicitudes.
drop policy if exists solicitudes_insert on public.solicitudes_factura;
create policy solicitudes_insert on public.solicitudes_factura
for insert to authenticated
with check (cliente_id in (select c.id from public.clientes c where c.user_id = auth.uid()));

drop policy if exists solicitudes_select_cliente on public.solicitudes_factura;
create policy solicitudes_select_cliente on public.solicitudes_factura
for select to authenticated
using (cliente_id in (select c.id from public.clientes c where c.user_id = auth.uid()));

drop policy if exists solicitudes_select_asesoria on public.solicitudes_factura;
create policy solicitudes_select_asesoria on public.solicitudes_factura
for select to authenticated
using (
  cliente_id in (
    select c.id from public.clientes c
    where c.asesoria_id in (select ua.asesoria_id from public.usuarios_asesoria ua where ua.user_id = auth.uid())
  )
);

drop policy if exists solicitudes_update_asesoria on public.solicitudes_factura;
create policy solicitudes_update_asesoria on public.solicitudes_factura
for update to authenticated
using (
  cliente_id in (
    select c.id from public.clientes c
    where c.asesoria_id in (select ua.asesoria_id from public.usuarios_asesoria ua where ua.user_id = auth.uid())
  )
)
with check (
  cliente_id in (
    select c.id from public.clientes c
    where c.asesoria_id in (select ua.asesoria_id from public.usuarios_asesoria ua where ua.user_id = auth.uid())
  )
);

-- Facturas.
drop policy if exists facturas_insert on public.facturas;
create policy facturas_insert on public.facturas
for insert to authenticated
with check (asesoria_id in (select ua.asesoria_id from public.usuarios_asesoria ua where ua.user_id = auth.uid()));

drop policy if exists facturas_select_asesoria on public.facturas;
create policy facturas_select_asesoria on public.facturas
for select to authenticated
using (asesoria_id in (select ua.asesoria_id from public.usuarios_asesoria ua where ua.user_id = auth.uid()));

drop policy if exists facturas_select_cliente on public.facturas;
create policy facturas_select_cliente on public.facturas
for select to authenticated
using (cliente_id in (select c.id from public.clientes c where c.user_id = auth.uid()));

drop policy if exists facturas_update_asesoria on public.facturas;
create policy facturas_update_asesoria on public.facturas
for update to authenticated
using (asesoria_id in (select ua.asesoria_id from public.usuarios_asesoria ua where ua.user_id = auth.uid()))
with check (asesoria_id in (select ua.asesoria_id from public.usuarios_asesoria ua where ua.user_id = auth.uid()));

-- Líneas de factura.
drop policy if exists lineas_select_asesoria on public.lineas_factura;
create policy lineas_select_asesoria on public.lineas_factura
for select to authenticated
using (
  factura_id in (
    select f.id from public.facturas f
    where f.asesoria_id in (select ua.asesoria_id from public.usuarios_asesoria ua where ua.user_id = auth.uid())
  )
);

drop policy if exists lineas_select_cliente on public.lineas_factura;
create policy lineas_select_cliente on public.lineas_factura
for select to authenticated
using (
  factura_id in (
    select f.id from public.facturas f
    where f.cliente_id in (select c.id from public.clientes c where c.user_id = auth.uid())
  )
);

drop policy if exists lineas_insert on public.lineas_factura;
create policy lineas_insert on public.lineas_factura
for insert to authenticated
with check (
  factura_id in (
    select f.id from public.facturas f
    where f.asesoria_id in (select ua.asesoria_id from public.usuarios_asesoria ua where ua.user_id = auth.uid())
  )
);

drop policy if exists lineas_update_asesoria on public.lineas_factura;
create policy lineas_update_asesoria on public.lineas_factura
for update to authenticated
using (
  factura_id in (
    select f.id from public.facturas f
    where f.asesoria_id in (select ua.asesoria_id from public.usuarios_asesoria ua where ua.user_id = auth.uid())
  )
)
with check (
  factura_id in (
    select f.id from public.facturas f
    where f.asesoria_id in (select ua.asesoria_id from public.usuarios_asesoria ua where ua.user_id = auth.uid())
  )
);

drop policy if exists lineas_delete_asesoria on public.lineas_factura;
create policy lineas_delete_asesoria on public.lineas_factura
for delete to authenticated
using (
  factura_id in (
    select f.id from public.facturas f
    where f.asesoria_id in (select ua.asesoria_id from public.usuarios_asesoria ua where ua.user_id = auth.uid())
  )
);

-- Notificaciones.
drop policy if exists notificaciones_select on public.notificaciones;
create policy notificaciones_select on public.notificaciones
for select to authenticated
using (destinatario_id = auth.uid());

drop policy if exists notificaciones_insert on public.notificaciones;
create policy notificaciones_insert on public.notificaciones
for insert to authenticated
with check (destinatario_id = auth.uid());

drop policy if exists notificaciones_update on public.notificaciones;
create policy notificaciones_update on public.notificaciones
for update to authenticated
using (destinatario_id = auth.uid())
with check (destinatario_id = auth.uid());

-- =============================
-- TRIGGERS DE INMUTABILIDAD
-- =============================

create or replace function public.prevent_update_factura_fiscal_fields()
returns trigger
language plpgsql
as $$
begin
  if old.hash_sha256 is not null then
    if new.asesoria_id is distinct from old.asesoria_id
      or new.cliente_id is distinct from old.cliente_id
      or new.solicitud_id is distinct from old.solicitud_id
      or new.numero_factura is distinct from old.numero_factura
      or new.serie is distinct from old.serie
      or new.numero is distinct from old.numero
      or new.fecha_emision is distinct from old.fecha_emision
      or new.fecha_vencimiento is distinct from old.fecha_vencimiento
      or new.base_imponible is distinct from old.base_imponible
      or new.iva_total is distinct from old.iva_total
      or new.retencion_irpf is distinct from old.retencion_irpf
      or new.total is distinct from old.total
      or new.hash_sha256 is distinct from old.hash_sha256
      or new.hash_anterior is distinct from old.hash_anterior
      or new.datos_hash is distinct from old.datos_hash
      or new.fecha_registro is distinct from old.fecha_registro
      or new.qr_data is distinct from old.qr_data
      or new.observaciones is distinct from old.observaciones
    then
      raise exception 'Factura emitida: los datos fiscales y de trazabilidad no pueden modificarse';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_update_factura_fiscal_fields on public.facturas;
create trigger trg_prevent_update_factura_fiscal_fields
before update on public.facturas
for each row
execute function public.prevent_update_factura_fiscal_fields();

create or replace function public.prevent_change_lineas_factura_emitida()
returns trigger
language plpgsql
as $$
declare
  factura_hash text;
  factura_ref uuid;
begin
  if tg_op = 'DELETE' then
    factura_ref := old.factura_id;
  else
    factura_ref := new.factura_id;
  end if;

  select f.hash_sha256 into factura_hash
  from public.facturas f
  where f.id = factura_ref;

  if factura_hash is not null then
    raise exception 'Factura emitida: las líneas no pueden modificarse';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_insert_lineas_factura_emitida on public.lineas_factura;
drop trigger if exists trg_prevent_update_lineas_factura_emitida on public.lineas_factura;
drop trigger if exists trg_prevent_delete_lineas_factura_emitida on public.lineas_factura;

create trigger trg_prevent_insert_lineas_factura_emitida
before insert on public.lineas_factura
for each row execute function public.prevent_change_lineas_factura_emitida();

create trigger trg_prevent_update_lineas_factura_emitida
before update on public.lineas_factura
for each row execute function public.prevent_change_lineas_factura_emitida();

create trigger trg_prevent_delete_lineas_factura_emitida
before delete on public.lineas_factura
for each row execute function public.prevent_change_lineas_factura_emitida();

-- =============================
-- STORAGE
-- =============================

insert into storage.buckets (id, name, public)
values
  ('logos', 'logos', true),
  ('certificados', 'certificados', false),
  ('facturas', 'facturas', false),
  ('solicitud-adjuntos', 'solicitud-adjuntos', false)
on conflict (id) do update set public = excluded.public;

-- Logos.
drop policy if exists "Público puede ver logos" on storage.objects;
create policy "Público puede ver logos" on storage.objects
for select to public
using (bucket_id = 'logos');

drop policy if exists "Asesorías insertan sus logos" on storage.objects;
create policy "Asesorías insertan sus logos" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'logos'
  and (storage.foldername(name))[1] in (select ua.asesoria_id::text from public.usuarios_asesoria ua where ua.user_id = auth.uid())
);

drop policy if exists "Asesorías actualizan sus logos" on storage.objects;
create policy "Asesorías actualizan sus logos" on storage.objects
for update to authenticated
using (
  bucket_id = 'logos'
  and (storage.foldername(name))[1] in (select ua.asesoria_id::text from public.usuarios_asesoria ua where ua.user_id = auth.uid())
)
with check (
  bucket_id = 'logos'
  and (storage.foldername(name))[1] in (select ua.asesoria_id::text from public.usuarios_asesoria ua where ua.user_id = auth.uid())
);

drop policy if exists "Asesorías borran sus logos" on storage.objects;
create policy "Asesorías borran sus logos" on storage.objects
for delete to authenticated
using (
  bucket_id = 'logos'
  and (storage.foldername(name))[1] in (select ua.asesoria_id::text from public.usuarios_asesoria ua where ua.user_id = auth.uid())
);

-- Facturas privadas.
drop policy if exists "Facturas lectura asesoría propia" on storage.objects;
create policy "Facturas lectura asesoría propia" on storage.objects
for select to authenticated
using (
  bucket_id = 'facturas'
  and (storage.foldername(name))[1] in (select ua.asesoria_id::text from public.usuarios_asesoria ua where ua.user_id = auth.uid())
);

drop policy if exists "Facturas lectura cliente propio" on storage.objects;
create policy "Facturas lectura cliente propio" on storage.objects
for select to authenticated
using (
  bucket_id = 'facturas'
  and (storage.foldername(name))[2] in (
    select f.id::text
    from public.facturas f
    join public.clientes c on c.id = f.cliente_id
    where c.user_id = auth.uid()
  )
);

drop policy if exists "Facturas insert asesoría propia" on storage.objects;
create policy "Facturas insert asesoría propia" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'facturas'
  and (storage.foldername(name))[1] in (select ua.asesoria_id::text from public.usuarios_asesoria ua where ua.user_id = auth.uid())
);

drop policy if exists "Facturas update asesoría propia" on storage.objects;
create policy "Facturas update asesoría propia" on storage.objects
for update to authenticated
using (
  bucket_id = 'facturas'
  and (storage.foldername(name))[1] in (select ua.asesoria_id::text from public.usuarios_asesoria ua where ua.user_id = auth.uid())
)
with check (
  bucket_id = 'facturas'
  and (storage.foldername(name))[1] in (select ua.asesoria_id::text from public.usuarios_asesoria ua where ua.user_id = auth.uid())
);

drop policy if exists "Facturas delete asesoría propia" on storage.objects;
create policy "Facturas delete asesoría propia" on storage.objects
for delete to authenticated
using (
  bucket_id = 'facturas'
  and (storage.foldername(name))[1] in (select ua.asesoria_id::text from public.usuarios_asesoria ua where ua.user_id = auth.uid())
);

-- Adjuntos de solicitudes.
drop policy if exists "Clientes pueden subir adjuntos" on storage.objects;
create policy "Clientes pueden subir adjuntos" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'solicitud-adjuntos'
  and (storage.foldername(name))[1] in (select c.id::text from public.clientes c where c.user_id = auth.uid())
);

drop policy if exists "Clientes ven sus adjuntos" on storage.objects;
create policy "Clientes ven sus adjuntos" on storage.objects
for select to authenticated
using (
  bucket_id = 'solicitud-adjuntos'
  and (storage.foldername(name))[1] in (select c.id::text from public.clientes c where c.user_id = auth.uid())
);

drop policy if exists "Asesorías ven adjuntos de sus clientes" on storage.objects;
create policy "Asesorías ven adjuntos de sus clientes" on storage.objects
for select to authenticated
using (
  bucket_id = 'solicitud-adjuntos'
  and (storage.foldername(name))[1] in (
    select c.id::text
    from public.clientes c
    where c.asesoria_id in (select ua.asesoria_id from public.usuarios_asesoria ua where ua.user_id = auth.uid())
  )
);

drop policy if exists "Clientes borran sus adjuntos" on storage.objects;
create policy "Clientes borran sus adjuntos" on storage.objects
for delete to authenticated
using (
  bucket_id = 'solicitud-adjuntos'
  and (storage.foldername(name))[1] in (select c.id::text from public.clientes c where c.user_id = auth.uid())
);

-- Certificados privados.
drop policy if exists "Certificados insert asesoría propia" on storage.objects;
create policy "Certificados insert asesoría propia" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'certificados'
  and (storage.foldername(name))[1] in (select ua.asesoria_id::text from public.usuarios_asesoria ua where ua.user_id = auth.uid())
);

drop policy if exists "Certificados select asesoría propia" on storage.objects;
create policy "Certificados select asesoría propia" on storage.objects
for select to authenticated
using (
  bucket_id = 'certificados'
  and (storage.foldername(name))[1] in (select ua.asesoria_id::text from public.usuarios_asesoria ua where ua.user_id = auth.uid())
);

drop policy if exists "Certificados update asesoría propia" on storage.objects;
create policy "Certificados update asesoría propia" on storage.objects
for update to authenticated
using (
  bucket_id = 'certificados'
  and (storage.foldername(name))[1] in (select ua.asesoria_id::text from public.usuarios_asesoria ua where ua.user_id = auth.uid())
)
with check (
  bucket_id = 'certificados'
  and (storage.foldername(name))[1] in (select ua.asesoria_id::text from public.usuarios_asesoria ua where ua.user_id = auth.uid())
);

drop policy if exists "Certificados delete asesoría propia" on storage.objects;
create policy "Certificados delete asesoría propia" on storage.objects
for delete to authenticated
using (
  bucket_id = 'certificados'
  and (storage.foldername(name))[1] in (select ua.asesoria_id::text from public.usuarios_asesoria ua where ua.user_id = auth.uid())
);
