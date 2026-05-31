-- 004_adjuntos_certificados_limpieza.sql
-- Refuerzos para la fase de limpieza funcional:
-- 1) Certificados digitales almacenados por carpeta de asesoría en bucket privado.
-- 2) Adjuntos de solicitudes usando el patrón cliente_id/solicitud_id/archivo.
-- 3) La pantalla de configuración usa las columnas certificado_url y certificado_password_encrypted de asesorias.

-- Asegurar que el bucket de certificados sigue siendo privado.
update storage.buckets
set public = false
where id = 'certificados';

-- Policies de certificados: cada asesoría solo puede gestionar objetos dentro de su carpeta.
drop policy if exists "Certificados insert asesoría propia" on storage.objects;
drop policy if exists "Certificados select asesoría propia" on storage.objects;
drop policy if exists "Certificados update asesoría propia" on storage.objects;
drop policy if exists "Certificados delete asesoría propia" on storage.objects;

create policy "Certificados insert asesoría propia"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'certificados'
  and (storage.foldername(name))[1] in (
    select ua.asesoria_id::text
    from public.usuarios_asesoria ua
    where ua.user_id = auth.uid()
  )
);

create policy "Certificados select asesoría propia"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'certificados'
  and (storage.foldername(name))[1] in (
    select ua.asesoria_id::text
    from public.usuarios_asesoria ua
    where ua.user_id = auth.uid()
  )
);

create policy "Certificados update asesoría propia"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'certificados'
  and (storage.foldername(name))[1] in (
    select ua.asesoria_id::text
    from public.usuarios_asesoria ua
    where ua.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'certificados'
  and (storage.foldername(name))[1] in (
    select ua.asesoria_id::text
    from public.usuarios_asesoria ua
    where ua.user_id = auth.uid()
  )
);

create policy "Certificados delete asesoría propia"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'certificados'
  and (storage.foldername(name))[1] in (
    select ua.asesoria_id::text
    from public.usuarios_asesoria ua
    where ua.user_id = auth.uid()
  )
);

-- La policy existente ya permite que el cliente suba adjuntos si la primera carpeta es su id.
-- Añadimos borrado por el propio cliente para poder limpiar adjuntos si se cancela una funcionalidad futura.
drop policy if exists "Clientes borran sus adjuntos" on storage.objects;

create policy "Clientes borran sus adjuntos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'solicitud-adjuntos'
  and (storage.foldername(name))[1] in (
    select c.id::text
    from public.clientes c
    where c.user_id = auth.uid()
  )
);
