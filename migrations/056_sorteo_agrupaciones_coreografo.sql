-- ============================================================================
-- 056_sorteo_agrupaciones_coreografo.sql
-- Festival Danzarte · Portal de participantes
--
-- El programa del portal (pestaña PROGRAMA, y su modo Ensayos) ahora despliega
-- cada acto para mostrar los datos de la obra y el COREÓGRAFO con su foto.
-- El RPC `sorteo_agrupaciones` no traía esos dos campos, así que se agregan:
--   · coreografo        → nombre, ya vive en registro_de_inscripcion_2026 (sin JOIN nuevo)
--   · coreografo_foto   → coreografos.foto, con respaldo en
--                          festival_contactos_global.imagen_contacto
--
-- Cobertura medida sobre los 218 actos con día asignado: 117 con foto
-- (85 directas + 32 por el respaldo); el resto cae a iniciales en la UI.
--
-- COMPATIBILIDAD: este RPC lo comparten el portal y la App de Sorteo
-- (APP SORTEO DANZARTE/data.js → getAgrupaciones). Las 16 columnas previas
-- quedan EXACTAMENTE iguales, en el mismo orden; las dos nuevas van al final.
-- Ambos consumidores mapean por nombre de propiedad, así que no se rompe nada.
-- Se requiere DROP porque cambia el return type.
--
-- Solo cambia una función (no toca datos). Correr en Supabase Studio.
-- ============================================================================

drop function if exists public.sorteo_agrupaciones(text, text);

create or replace function public.sorteo_agrupaciones(p_dia text, p_bloque text)
returns table (
  id_inscripcion    text,
  id_agrupacion     text,
  nombre_agrupacion text,
  agrupacion        text,
  obra              text,
  ciudad            text,
  integrantes       int,
  subdivision       text,
  dia               text,
  bloque            text,
  logo_url          text,
  orden             int,
  duracion          text,
  modalidad         text,
  categoria         text,
  genero            text,
  -- nuevas (al final, para no alterar a los consumidores existentes)
  coreografo        text,
  coreografo_foto   text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    r.id_inscripcion::text,
    r.id_agrupacion::text,
    coalesce(nullif(i.nombre_agrupacion, ''), r.agrupacion) as nombre_agrupacion,
    r.agrupacion,
    r.nombre_de_la_obra as obra,
    r.ciudad,
    nullif(r.cantidad::text, '')::int as integrantes,
    r.subdivision,
    r.dia,
    r.bloque,
    coalesce(nullif(r.enlace_del_logo, ''), i.enlace_del_logo) as logo_url,
    nullif(r.orden::text, '')::int as orden,
    nullif(r.duracion, '') as duracion,
    nullif(r.modalidad, '') as modalidad,
    nullif(r.categoria, '') as categoria,
    nullif(r.genero, '') as genero,
    -- nombre del coreógrafo: ya está denormalizado en la inscripción;
    -- si viniera vacío, se cae al de la ficha del coreógrafo.
    coalesce(nullif(r.coreografo, ''), nullif(co.nombre_y_apellido, '')) as coreografo,
    -- foto: ficha del coreógrafo y, si no tiene, la imagen del contacto global
    coalesce(nullif(co.foto, ''), nullif(fc.imagen_contacto, ''))        as coreografo_foto
  from registro_de_inscripcion_2026 r
  left join instituciones i             on i.id_agrupacion = r.id_agrupacion
  left join coreografos co              on co.id_coreografo::text = r.id_coreografo::text
  left join festival_contactos_global fc on fc.id_contacto::text  = co.id_contacto::text
  where upper(coalesce(r.dia, ''))    = upper(p_dia)   -- requiere día asignado (Mar–Vie)
    and upper(coalesce(r.bloque, '')) = upper(p_bloque)
  order by nullif(r.orden::text, '')::int nulls last, r.numero nulls last;
$$;

grant execute on function public.sorteo_agrupaciones(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
-- ============================================================================
