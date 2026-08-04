-- 009_asistencia_2026.sql
-- Asistencia de inscripciones (portal). Flujo elegido: el representante/coreógrafo/
-- director genera un QR por inscripción; el SUPER-ADMIN lo escanea y ESE escaneo
-- REGISTRA la asistencia (marcada_at = hora del escaneo). Realtime para que el
-- representante y el super-admin lo vean al instante.
--
-- Aditivo + idempotente. Correr en Supabase Studio → SQL Editor.

create table if not exists public.asistencia_2026 (
  id             uuid primary key default gen_random_uuid(),
  id_inscripcion text not null unique,
  id_agrupacion  text,
  agrupacion     text,
  obra           text,
  dia_obra       text,
  persona_nombre text,
  persona_rol    text,             -- representante | coreografo | director
  marcada_at     timestamptz not null default now(),
  ano            int not null default 2026
);
create index if not exists asistencia_2026_agr_idx on public.asistencia_2026 (id_agrupacion);

alter table public.asistencia_2026 enable row level security;

-- Lectura pública: datos NO sensibles (agrupación, obra, día, hora). Sin PII.
drop policy if exists asistencia_2026_sel on public.asistencia_2026;
create policy asistencia_2026_sel on public.asistencia_2026
  for select to anon, authenticated using (true);
-- Sin INSERT/UPDATE/DELETE directo para anon: solo vía la RPC SECURITY DEFINER de abajo.

-- RPC: registra la asistencia. La llama el super-admin al escanear el QR.
-- Deriva agrupación/obra/día de la inscripción (fuente de verdad); persona/rol
-- vienen del QR (quién lo generó). Idempotente: si ya estaba, no la pisa.
create or replace function public.marcar_asistencia(
  p_id_inscripcion text,
  p_persona_nombre text default null,
  p_persona_rol    text default null
) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; a record; v_existia boolean;
begin
  select id_inscripcion, agrupacion, id_agrupacion, nombre_de_la_obra, dia
    into r from public.registro_de_inscripcion_2026
   where id_inscripcion = p_id_inscripcion
   limit 1;
  if not found then
    return json_build_object('status','error','message','Inscripción no encontrada');
  end if;

  select exists(select 1 from public.asistencia_2026 where id_inscripcion = p_id_inscripcion)
    into v_existia;

  insert into public.asistencia_2026
    (id_inscripcion, id_agrupacion, agrupacion, obra, dia_obra, persona_nombre, persona_rol)
  values
    (r.id_inscripcion, r.id_agrupacion, r.agrupacion, r.nombre_de_la_obra, r.dia,
     nullif(trim(coalesce(p_persona_nombre,'')),''),
     nullif(trim(coalesce(p_persona_rol,'')),''))
  on conflict (id_inscripcion) do nothing;

  select * into a from public.asistencia_2026 where id_inscripcion = p_id_inscripcion limit 1;
  return json_build_object('status','ok','data', json_build_object(
    'id_inscripcion', a.id_inscripcion,
    'agrupacion',     a.agrupacion,
    'obra',           a.obra,
    'dia_obra',       a.dia_obra,
    'persona_nombre', a.persona_nombre,
    'persona_rol',    a.persona_rol,
    'marcada_at',     a.marcada_at,
    'ya_estaba',      v_existia));
end; $$;

revoke all on function public.marcar_asistencia(text,text,text) from public;
grant execute on function public.marcar_asistencia(text,text,text) to anon, authenticated;

-- Realtime
alter table public.asistencia_2026 replica identity full;
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'asistencia_2026'
  ) then
    alter publication supabase_realtime add table public.asistencia_2026;
  end if;
end $$;

notify pgrst, 'reload schema';
