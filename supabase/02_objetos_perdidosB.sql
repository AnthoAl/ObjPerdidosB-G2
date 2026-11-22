-- LABFIS | ObjetosPerdidosB
-- Ejecutar una vez en SQL Editor del proyecto Supabase de pruebas.
begin;

create table public.objetos_perdidos_b_encargados (
  usuario_id uuid primary key references auth.users(id) on delete cascade
);

create table public.objetos_perdidos_b (
  id uuid primary key default gen_random_uuid(),
  descripcion text not null check (descripcion ~ '[^[:space:]]' and char_length(descripcion) <= 500),
  lugar_hallazgo text not null check (lugar_hallazgo ~ '[^[:space:]]' and char_length(lugar_hallazgo) <= 160),
  fecha_hallazgo date not null,
  ubicacion_custodia text not null check (
    ubicacion_custodia ~ '[^[:space:]]' and char_length(ubicacion_custodia) <= 160
  ),
  estado text not null default 'En recepción' check (estado in ('En recepción', 'En custodia')),
  registrado_por uuid not null default auth.uid() references auth.users(id),
  registrado_en timestamptz not null default now()
);

create table public.objetos_perdidos_b_evidencias (
  objeto_id uuid primary key references public.objetos_perdidos_b(id),
  observaciones text not null check (
    observaciones ~ '[^[:space:]]' and char_length(observaciones) <= 2000
  ),
  confirmado_por uuid not null references auth.users(id),
  confirmado_en timestamptz not null default now()
);

create table public.objetos_perdidos_b_fotos (
  ruta text primary key,
  objeto_id uuid not null references public.objetos_perdidos_b_evidencias(objeto_id),
  check (split_part(ruta, '/', 1) = objeto_id::text)
);

create index objetos_perdidos_b_fotos_objeto_idx on public.objetos_perdidos_b_fotos(objeto_id);

alter table public.objetos_perdidos_b_encargados enable row level security;
alter table public.objetos_perdidos_b enable row level security;
alter table public.objetos_perdidos_b_evidencias enable row level security;
alter table public.objetos_perdidos_b_fotos enable row level security;

revoke all on public.objetos_perdidos_b_encargados, public.objetos_perdidos_b,
  public.objetos_perdidos_b_evidencias, public.objetos_perdidos_b_fotos
  from public, anon, authenticated;

grant select on public.objetos_perdidos_b_encargados, public.objetos_perdidos_b,
  public.objetos_perdidos_b_evidencias, public.objetos_perdidos_b_fotos to authenticated;
grant insert (id, descripcion, lugar_hallazgo, fecha_hallazgo, ubicacion_custodia)
  on public.objetos_perdidos_b to authenticated;
grant update (ubicacion_custodia) on public.objetos_perdidos_b to authenticated;

-- Cada usuario puede consultar únicamente su propia habilitación.
create policy objetos_b_encargados_leer_propio on public.objetos_perdidos_b_encargados
  for select to authenticated using (usuario_id = (select auth.uid()));

create policy objetos_b_leer on public.objetos_perdidos_b
  for select to authenticated
  using (exists (select 1 from public.objetos_perdidos_b_encargados));

create policy objetos_b_registrar on public.objetos_perdidos_b
  for insert to authenticated
  with check (exists (select 1 from public.objetos_perdidos_b_encargados));

create policy objetos_b_editar_ubicacion on public.objetos_perdidos_b
  for update to authenticated
  using (exists (select 1 from public.objetos_perdidos_b_encargados))
  with check (exists (select 1 from public.objetos_perdidos_b_encargados));

create policy objetos_b_evidencias_leer on public.objetos_perdidos_b_evidencias
  for select to authenticated
  using (exists (select 1 from public.objetos_perdidos_b_encargados));

create policy objetos_b_fotos_leer on public.objetos_perdidos_b_fotos
  for select to authenticated
  using (exists (select 1 from public.objetos_perdidos_b_encargados));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'objetos-perdidos-b-evidencias', 'objetos-perdidos-b-evidencias', false,
  5242880, array['image/jpeg', 'image/png', 'image/webp']
);

create schema objetos_perdidos_b_privado;
revoke all on schema objetos_perdidos_b_privado from public, anon, authenticated;
grant usage on schema objetos_perdidos_b_privado to authenticated;

-- Las rutas siguen el formato <objeto_uuid>/<usuario_uuid>/<foto_uuid>.<extensión>.
create function objetos_perdidos_b_privado.puede_cargar_foto(ruta text)
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
        select 1 from public.objetos_perdidos_b
        where id = split_part(ruta, '/', 1)::uuid and estado = 'En recepción'
      )
    else false
  end;
$$;

revoke all on function objetos_perdidos_b_privado.puede_cargar_foto(text)
  from public, anon, authenticated;
grant execute on function objetos_perdidos_b_privado.puede_cargar_foto(text) to authenticated;

-- Las políticas restrictivas de este bucket se combinan con las que ya tenga el proyecto.
create policy objetos_b_storage_bloquear_anon on storage.objects
  as restrictive for all to anon
  using (bucket_id <> 'objetos-perdidos-b-evidencias')
  with check (bucket_id <> 'objetos-perdidos-b-evidencias');

create policy objetos_b_storage_restringir on storage.objects
  as restrictive for all to authenticated
  using (
    bucket_id <> 'objetos-perdidos-b-evidencias'
    or objetos_perdidos_b_privado.puede_cargar_foto(name)
    or exists (select 1 from public.objetos_perdidos_b_fotos where ruta = name)
  )
  with check (
    bucket_id <> 'objetos-perdidos-b-evidencias'
    or objetos_perdidos_b_privado.puede_cargar_foto(name)
  );

create policy objetos_b_storage_leer on storage.objects
  for select to authenticated using (bucket_id = 'objetos-perdidos-b-evidencias');

create policy objetos_b_storage_subir on storage.objects
  for insert to authenticated with check (bucket_id = 'objetos-perdidos-b-evidencias');

create policy objetos_b_storage_impedir_reemplazo on storage.objects
  as restrictive for update to authenticated
  using (bucket_id <> 'objetos-perdidos-b-evidencias')
  with check (bucket_id <> 'objetos-perdidos-b-evidencias');

create policy objetos_b_storage_impedir_borrado on storage.objects
  as restrictive for delete to authenticated
  using (bucket_id <> 'objetos-perdidos-b-evidencias');

-- La RPC confirma una sola evidencia y devuelve la misma fila ante un reintento idéntico.
create function public.confirmar_custodia_objeto_perdido_b(
  p_objeto_id uuid, p_observaciones text, p_rutas text[]
)
returns public.objetos_perdidos_b_evidencias
language plpgsql security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_estado text;
  v_evidencia public.objetos_perdidos_b_evidencias%rowtype;
  v_rutas_ordenadas text[];
begin
  if not exists (
    select 1 from public.objetos_perdidos_b_encargados where usuario_id = v_usuario
  ) then
    raise exception using errcode = '42501', message = 'Se requiere una cuenta de encargado.';
  end if;

  if p_observaciones is null or p_observaciones !~ '[^[:space:]]'
    or char_length(p_observaciones) > 2000 then
    raise exception using errcode = '22023', message = 'Ingresa observaciones de hasta 2000 caracteres.';
  end if;

  if coalesce(array_ndims(p_rutas), 0) <> 1 or cardinality(p_rutas) not between 1 and 5 then
    raise exception using errcode = '22023', message = 'Adjunta entre una y cinco fotografías.';
  end if;

  v_rutas_ordenadas := array(select distinct ruta from unnest(p_rutas) as foto(ruta)
    where ruta is not null order by ruta);
  if cardinality(v_rutas_ordenadas) <> cardinality(p_rutas) then
    raise exception using errcode = '22023', message = 'Las fotografías deben ser distintas y tener una ruta.';
  end if;

  select estado into v_estado from public.objetos_perdidos_b where id = p_objeto_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'No se encontró el objeto.';
  end if;

  if v_estado = 'En custodia' then
    select * into v_evidencia from public.objetos_perdidos_b_evidencias where objeto_id = p_objeto_id;
    if v_evidencia.confirmado_por = v_usuario and v_evidencia.observaciones = p_observaciones
      and v_rutas_ordenadas = array(
        select ruta from public.objetos_perdidos_b_fotos where objeto_id = p_objeto_id order by ruta
      ) then
      return v_evidencia;
    end if;
    raise exception using errcode = '55000', message = 'La evidencia de custodia ya fue confirmada.';
  end if;

  if exists (
    select 1 from unnest(v_rutas_ordenadas) as foto(ruta)
    where split_part(foto.ruta, '/', 1) <> p_objeto_id::text
      or not objetos_perdidos_b_privado.puede_cargar_foto(foto.ruta)
      or not exists (
        select 1 from storage.objects as archivo
        where archivo.bucket_id = 'objetos-perdidos-b-evidencias' and archivo.name = foto.ruta
      )
  ) then
    raise exception using errcode = '22023', message = 'Faltan fotografías cargadas para este objeto y esta cuenta.';
  end if;

  insert into public.objetos_perdidos_b_evidencias (objeto_id, observaciones, confirmado_por)
  values (p_objeto_id, p_observaciones, v_usuario)
  returning * into v_evidencia;

  insert into public.objetos_perdidos_b_fotos (objeto_id, ruta)
  select p_objeto_id, ruta from unnest(v_rutas_ordenadas) as foto(ruta);

  update public.objetos_perdidos_b set estado = 'En custodia' where id = p_objeto_id;
  return v_evidencia;
end;
$$;

revoke all on function public.confirmar_custodia_objeto_perdido_b(uuid, text, text[])
  from public, anon, authenticated;
grant execute on function public.confirmar_custodia_objeto_perdido_b(uuid, text, text[]) to authenticated;

commit;
