-- Refuerzo de seguridad e integridad para MuyFactu
-- Ejecutar después de comprobar que el frontend usa createSignedUrl para facturas.

-- 1) Hacer privado el bucket de facturas.
update storage.buckets
set public = false
where id = 'facturas';

-- 2) Sustituir lectura pública de facturas por lectura autenticada controlada.
drop policy if exists "Facturas lectura pública" on storage.objects;
drop policy if exists "Facturas lectura asesoría propia" on storage.objects;
drop policy if exists "Facturas lectura cliente propio" on storage.objects;

create policy "Facturas lectura asesoría propia"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'facturas'
  and (storage.foldername(name))[1] in (
    select ua.asesoria_id::text
    from public.usuarios_asesoria ua
    where ua.user_id = auth.uid()
  )
);

create policy "Facturas lectura cliente propio"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'facturas'
  and (storage.foldername(name))[2] in (
    select f.id::text
    from public.facturas f
    join public.clientes c on c.id = f.cliente_id
    where c.user_id = auth.uid()
  )
);

-- 3) Asegurar que una solicitud solo puede generar una factura.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'facturas_solicitud_id_unique'
  ) then
    alter table public.facturas
    add constraint facturas_solicitud_id_unique unique (solicitud_id);
  end if;
end $$;

-- 4) Evitar duplicados de usuario dentro de una misma asesoría.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'usuarios_asesoria_user_asesoria_unique'
  ) then
    alter table public.usuarios_asesoria
    add constraint usuarios_asesoria_user_asesoria_unique unique (user_id, asesoria_id);
  end if;
end $$;

-- 5) Evitar dos líneas con el mismo orden dentro de una factura.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'lineas_factura_factura_orden_unique'
  ) then
    alter table public.lineas_factura
    add constraint lineas_factura_factura_orden_unique unique (factura_id, orden);
  end if;
end $$;
