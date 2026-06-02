-- 003_hash_inmutabilidad_facturas.sql
-- Mejora del registro técnico de facturas: SHA-256, encadenamiento e inmutabilidad.
-- Ejecutar después de 002_private_storage_and_integrity.sql.

-- 1) Nuevos campos para trazabilidad técnica.
alter table public.facturas
  add column if not exists hash_anterior text,
  add column if not exists datos_hash jsonb,
  add column if not exists fecha_registro timestamp with time zone,
  add column if not exists registro_version text default 'MF-SIF-1';

-- 2) Índices útiles para recuperar la cadena de facturación por asesoría/serie.
create index if not exists facturas_cadena_idx
on public.facturas (asesoria_id, serie, numero);

create index if not exists facturas_hash_idx
on public.facturas (hash_sha256)
where hash_sha256 is not null;

-- 3) Restricciones de integridad adicionales.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'facturas_hash_sha256_format_check'
  ) then
    alter table public.facturas
      add constraint facturas_hash_sha256_format_check
      check (hash_sha256 is null or hash_sha256 ~ '^[A-Fa-f0-9]{64}$') not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'facturas_hash_anterior_format_check'
  ) then
    alter table public.facturas
      add constraint facturas_hash_anterior_format_check
      check (hash_anterior is null or hash_anterior ~ '^[A-Fa-f0-9]{64}$') not valid;
  end if;
end $$;

-- 4) Trigger de inmutabilidad de cabecera de factura.
-- Una vez que una factura tiene hash, no se pueden modificar datos fiscales o de trazabilidad.
-- Se siguen permitiendo cambios administrativos como estado, fecha_cobro, pdf_url o xml_url.
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

-- 5) Trigger de inmutabilidad de líneas.
-- Mientras la factura no tenga hash, se pueden insertar líneas durante el proceso de generación.
-- Cuando el hash existe, ya no se pueden añadir, editar ni borrar líneas.
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

  select f.hash_sha256
    into factura_hash
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
for each row
execute function public.prevent_change_lineas_factura_emitida();

create trigger trg_prevent_update_lineas_factura_emitida
before update on public.lineas_factura
for each row
execute function public.prevent_change_lineas_factura_emitida();

create trigger trg_prevent_delete_lineas_factura_emitida
before delete on public.lineas_factura
for each row
execute function public.prevent_change_lineas_factura_emitida();
