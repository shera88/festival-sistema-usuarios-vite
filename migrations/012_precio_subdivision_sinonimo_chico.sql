-- ============================================================================
-- MIGRACIÓN 012 — precio_subdivision: "Grupo Pequeño" == "Grupo Chico"
-- Ejecutar en Supabase Studio SQL Editor. Idempotente (CREATE OR REPLACE).
--
-- PROBLEMA: las inscripciones se guardan con subdivision = "GRUPO PEQUEÑO"
-- (php-backend mapea grupo_pequeno -> "Grupo Pequeño"), pero el arancel en
-- convocatoria_secciones está bajo el nombre "Grupo Chico" (100 Bs). Como la
-- función matchea por nombre, "GRUPO PEQUEÑO" != "GRUPO CHICO" -> devolvía 0,
-- y todas las inscripciones de grupo chico quedaban con deuda 0.
--
-- FIX: normalizar "Grupo Pequeño"/"Pequeño" -> "GRUPO CHICO" antes de buscar el
-- arancel. No toca datos (gestión sigue filtrando por "GRUPO PEQUEÑO") ni el
-- backend; solo corrige el cálculo del precio (existentes + futuras).
-- Resultado: Grupo Chico = 100 Bs/bailarín (8 bailarines = 800 Bs).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.precio_subdivision(p_sub text, p_ano integer DEFAULT 2026)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH s AS (
    -- "Grupo Pequeño" y "Grupo Chico" son la misma subdivisión.
    SELECT CASE
             WHEN UPPER(unaccent(p_sub)) IN ('GRUPO PEQUENO', 'PEQUENO')
               THEN 'GRUPO CHICO'
             ELSE UPPER(unaccent(p_sub))
           END AS norm
  )
  SELECT COALESCE((
    SELECT regexp_replace((item->>'arancel'), '[^0-9.]', '', 'g')::numeric
    FROM convocatoria_secciones,
         jsonb_array_elements(payload->'subdivisiones') AS item,
         s
    WHERE slug = 'categorias'
      AND ano = p_ano
      AND UPPER(unaccent(item->>'nombre')) = s.norm
    LIMIT 1
  ), 0);
$$;

NOTIFY pgrst, 'reload schema';

-- ── Verificar (correr tras el COMMIT) ──
--   SELECT precio_subdivision('GRUPO PEQUEÑO');  -- 100
--   SELECT precio_subdivision('GRUPO CHICO');    -- 100
--   SELECT precio_subdivision('SOLO');           -- 400
--   -- la vista deudas_2026 recalcula sola; revisar una agrupación con grupo chico:
--   SELECT descripcion, subdivision, bailarines, monto_total
--     FROM deudas_2026 WHERE id_agrupacion = 'fadd8b7e' ORDER BY monto_total;
