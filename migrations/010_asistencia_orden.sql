-- 010_asistencia_orden.sql
-- Agrega el ORDEN de la obra a la asistencia (para mostrarlo al escanear) + backfill
-- de lo ya registrado + la RPC ahora lo guarda. Aditivo/idempotente. Correr en Studio.

alter table public.asistencia_2026 add column if not exists orden text;

-- Backfill: completar orden en las filas ya marcadas desde la inscripción.
update public.asistencia_2026 a
   set orden = r.orden::text
  from public.registro_de_inscripcion_2026 r
 where r.id_inscripcion = a.id_inscripcion
   and (a.orden is null or a.orden = '');

-- RPC: ahora deriva y guarda el orden; lo devuelve junto al resto.
create or replace function public.marcar_asistencia(
  p_id_inscripcion text,
  p_persona_nombre text default null,
  p_persona_rol    text default null
) returns json
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; a record; v_existia boolean;
begin
  select id_inscripcion, agrupacion, id_agrupacion, nombre_de_la_obra, dia, orden
    into r from public.registro_de_inscripcion_2026
   where id_inscripcion = p_id_inscripcion
   limit 1;
  if not found then
    return json_build_object('status','error','message','Inscripción no encontrada');
  end if;

  select exists(select 1 from public.asistencia_2026 where id_inscripcion = p_id_inscripcion)
    into v_existia;

  insert into public.asistencia_2026
    (id_inscripcion, id_agrupacion, agrupacion, obra, dia_obra, orden, persona_nombre, persona_rol)
  values
    (r.id_inscripcion, r.id_agrupacion, r.agrupacion, r.nombre_de_la_obra, r.dia, r.orden::text,
     nullif(trim(coalesce(p_persona_nombre,'')),''),
     nullif(trim(coalesce(p_persona_rol,'')),''))
  on conflict (id_inscripcion) do nothing;

  select * into a from public.asistencia_2026 where id_inscripcion = p_id_inscripcion limit 1;
  return json_build_object('status','ok','data', json_build_object(
    'id_inscripcion', a.id_inscripcion,
    'agrupacion',     a.agrupacion,
    'obra',           a.obra,
    'dia_obra',       a.dia_obra,
    'orden',          a.orden,
    'persona_nombre', a.persona_nombre,
    'persona_rol',    a.persona_rol,
    'marcada_at',     a.marcada_at,
    'ya_estaba',      v_existia));
end; $$;

revoke all on function public.marcar_asistencia(text,text,text) from public;
grant execute on function public.marcar_asistencia(text,text,text) to anon, authenticated;

notify pgrst, 'reload schema';
