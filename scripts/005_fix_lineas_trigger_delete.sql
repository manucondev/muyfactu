-- 005_fix_lineas_trigger_delete.sql
-- Ajuste defensivo del trigger de líneas de factura.
-- Evita referenciar NEW en operaciones DELETE y mantiene la inmutabilidad de líneas.

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
