-- ============================================================================
-- MIGRACIÓN 013 — "Grupo Chico" -> "Grupo Pequeño" también en la BD
-- Ejecutar en Supabase Studio SQL Editor. Idempotente.
--
-- CONTEXTO: la página /convocatoria lee los nombres de subdivisión desde
-- convocatoria_secciones (no del código). Ahí seguía "Grupo Chico". Renombramos
-- a "Grupo Pequeño" (el rango "5 a 14" y el arancel "100 Bs" ya estaban bien).
--
-- Como ahora el config dice "Grupo Pequeño" y coincide con cómo se guardan las
-- inscripciones ("GRUPO PEQUEÑO"), REVERTIMOS precio_subdivision al match por
-- nombre directo (sin el sinónimo de la 012, que ahora buscaría un "Grupo Chico"
-- inexistente y daría 0).
-- ============================================================================

BEGIN;

-- 1) Renombrar la subdivisión en el config de convocatoria (slug=categorias).
UPDATE public.convocatoria_secciones
SET payload = jsonb_set(
  payload,
  '{subdivisiones}',
  (
    SELECT jsonb_agg(
      CASE WHEN item->>'nombre' = 'Grupo Chico'
           THEN jsonb_set(item, '{nombre}', '"Grupo Pequeño"'::jsonb)
           ELSE item END
    )
    FROM jsonb_array_elements(payload->'subdivisiones') AS item
  )
)
WHERE slug = 'categorias'
  AND ano = 2026
  AND payload->'subdivisiones' @> '[{"nombre": "Grupo Chico"}]'::jsonb;

-- 2) precio_subdivision: volver al match por nombre directo (sin sinónimo).
--    Ahora config="Grupo Pequeño" coincide con la data "GRUPO PEQUEÑO".
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.precio_subdivision(p_sub text, p_ano integer DEFAULT 2026)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((
    SELECT regexp_replace((item->>'arancel'), '[^0-9.]', '', 'g')::numeric
    FROM convocatoria_secciones,
         jsonb_array_elements(payload->'subdivisiones') AS item
    WHERE slug = 'categorias'
      AND ano = p_ano
      AND UPPER(unaccent(item->>'nombre')) = UPPER(unaccent(p_sub))
    LIMIT 1
  ), 0);
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── Verificar ──
--   SELECT precio_subdivision('GRUPO PEQUEÑO');  -- 100
--   SELECT precio_subdivision('SOLO');           -- 400
--   SELECT item->>'nombre' FROM convocatoria_secciones,
--          jsonb_array_elements(payload->'subdivisiones') item
--    WHERE slug='categorias' AND ano=2026;       -- ...Grupo Pequeño...
