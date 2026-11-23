-- LABFIS | Registro y evidencia original en una sola operación.
-- Ejecutar después de 02_objetos_perdidosB.sql.
begin;

alter table public.objetos_perdidos_b
  add column persona_reporta text check (
    persona_reporta ~ '[^[:space:]]' and char_length(persona_reporta) <= 160
  ),
  alter column ubicacion_custodia drop not null;

-- Permite subir fotos antes de crear el expediente. Las rutas pendientes
-- siguen limitadas a su encargado y se cierran al registrar el objeto en custodia.
create or replace function objetos_perdidos_b_privado.puede_cargar_foto(ruta text)
returns boolean
language sql stable
set search_path = ''
as $$
  select case
    when ruta ~ (
      '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f-]+/'
      || '[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.](jpg|jpeg|png|webp)$'
    )
    then split_part(ruta, '/', 2) = (select auth.uid())::text
      and exists (
        select 1 from public.objetos_perdidos_b_encargados where usuario_id = (select auth.uid())
      )
      and not exists (
        select 1 from public.objetos_perdidos_b
        where id = split_part(ruta, '/', 1)::uuid and estado <> 'En recepción'
      )
    else false
  end;
$$;

create function public.registrar_objeto_perdido_b(
  p_objeto_id uuid, p_descripcion text, p_lugar_hallazgo text, p_fecha_hallazgo date,
  p_persona_reporta text, p_observaciones text, p_rutas text[]
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
begin
  if not exists (
    select 1 from public.objetos_perdidos_b_encargados where usuario_id = v_usuario
  ) then
    raise exception using errcode = '42501', message = 'Se requiere una cuenta de encargado.';
  end if;

  if p_persona_reporta is null or p_persona_reporta !~ '[^[:space:]]'
    or char_length(p_persona_reporta) > 160 then
    raise exception using errcode = '22023', message = 'Ingresa quién reportó el hallazgo (hasta 160 caracteres).';
  end if;

  insert into public.objetos_perdidos_b (
    id, descripcion, lugar_hallazgo, fecha_hallazgo, persona_reporta, registrado_por
  ) values (
    p_objeto_id, p_descripcion, p_lugar_hallazgo, p_fecha_hallazgo, p_persona_reporta, v_usuario
  ) on conflict (id) do nothing;

  -- El mismo UUID solo admite repetir un registro con los mismos datos y la misma cuenta.
  if not found and not exists (
    select 1 from public.objetos_perdidos_b
    where id = p_objeto_id and registrado_por = v_usuario
      and descripcion = p_descripcion and lugar_hallazgo = p_lugar_hallazgo
      and fecha_hallazgo = p_fecha_hallazgo and persona_reporta = p_persona_reporta
  ) then
    raise exception using errcode = '55000',
      message = 'Ese identificador ya corresponde a otro registro. Consulta el listado.';
  end if;

  -- La inserción se revierte si falta una fotografía o falla la confirmación de la evidencia.
  perform public.confirmar_custodia_objeto_perdido_b(p_objeto_id, p_observaciones, p_rutas);
  return p_objeto_id;
end;
$$;

revoke all on function public.registrar_objeto_perdido_b(uuid, text, text, date, text, text, text[])
  from public, anon, authenticated;
grant execute on function public.registrar_objeto_perdido_b(uuid, text, text, date, text, text, text[])
  to authenticated;

commit;
