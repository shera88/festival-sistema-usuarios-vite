-- ============================================================================
-- ranking_publico() + bloque y división
--
-- El portal necesita agrupar el Ranking por BLOQUE MENOR / BLOQUE MAYOR, igual
-- que el programa y los PDF. Hoy el RPC no devuelve ese dato: manda obra,
-- agrupación, modalidad, género, categoría, día, orden, nota y jurados, pero ni
-- `bloque` ni `division` (que es de donde se derivaría).
--
-- Se agregan las DOS columnas al final del objeto:
--   · bloque    — 'MENOR' | 'MAYOR' tal como está en la inscripción
--   · division  — por si el bloque viniera vacío, el cliente puede derivarlo
--
-- Es una ADICIÓN: las claves que ya consumía el portal siguen igual y en el
-- mismo lugar, así que nada se rompe mientras se despliega el cliente nuevo.
--
-- El cuerpo es idéntico al de la migración 009 salvo esas dos columnas y su
-- correspondiente GROUP BY.
--
-- Sólo CREATE OR REPLACE de una función. No toca datos ni tablas. Idempotente.
-- Correr en Supabase Studio → SQL Editor.
-- ============================================================================

create or replace function public.ranking_publico()
returns json
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v json;
begin
  select coalesce(json_agg(x order by x.nota_final desc nulls last, x.orden), '[]'::json) into v
  from (
    select r.id_inscripcion, r.nombre_de_la_obra as obra, r.agrupacion,
           r.modalidad, r.genero, r.categoria, r.dia, r.orden, r.enlace_del_logo,
           r.bloque, r.division,
           round(avg(n.total)::numeric, 2) as nota_final,
           count(*) as jurados
    from public.registro_de_inscripcion_2026 r
    join public.recepcion_notas_2026 n
      on n.id_inscripcion = r.id_inscripcion and n.estado in ('enviada','bloqueada')
    where r.orden is not null
    group by r.id_inscripcion, r.nombre_de_la_obra, r.agrupacion, r.modalidad,
             r.genero, r.categoria, r.dia, r.orden, r.enlace_del_logo,
             r.bloque, r.division
  ) x;
  return json_build_object('status','ok','data', v);
end; $$;

revoke all on function public.ranking_publico() from public;
grant execute on function public.ranking_publico() to anon;

notify pgrst, 'reload schema';

-- Verificación: deben aparecer bloque y division, y el reparto por bloque.
select (public.ranking_publico() -> 'data' -> 0) as primera_fila;

select x ->> 'bloque' as bloque, count(*)
from json_array_elements(public.ranking_publico() -> 'data') x
group by 1 order by 2 desc;
-- ============================================================================
